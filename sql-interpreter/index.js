/**
 * SELECT column1 FROM table2
 * SELECT name, age FROM persons WHERE age > 100
 */
const { createToken, Lexer, CstParser } = require('chevrotain');
const { writeFile } = require('../utils');
const input = 'SELECT id, name FROM users WHERE id > 124';

const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z]\w*/ });
const Integer = createToken({ name: 'Integer', pattern: /0|[1-9]\d*/ });
const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED
});
const Select  = createToken({ name: 'Select', pattern: /SELECT/, longer_alt: Identifier });
const From = createToken({ name: 'From', pattern: /FROM/, longer_alt: Identifier });
const Where = createToken({ name: 'Where', pattern: /WHERE/, longer_alt: Identifier });
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const GreaterThan = createToken({ name: 'GreaterThan', pattern: />/ });
const LessThan = createToken({ name: 'LessThan', pattern: /</ });

const allTokens = [
  WhiteSpace,
  From,
  Where,
  Select,
  Comma,
  // Identifier should come after keywords, as any keyword can be a valid identifier
  Identifier,
  Integer,
  GreaterThan,
  LessThan
];

const SelectLexer = new Lexer(allTokens);
const lexingResult = SelectLexer.tokenize(input);

class SelectParser extends CstParser {
  constructor() {
    super(allTokens);
    const $ = this;

    $.RULE('selectStatement', () => {
      $.SUBRULE($.selectClause)
      $.SUBRULE($.fromClause)
      $.OPTION(() => {
        $.SUBRULE($.whereClause)
      })
    })

    $.RULE('selectClause', () => {
      $.CONSUME(Select)
      $.AT_LEAST_ONE_SEP({
        SEP: Comma,
        DEF: () => {
          $.CONSUME(Identifier)
        }
      })
    })

    $.RULE('fromClause', () => {
      $.CONSUME(From)
      $.CONSUME(Identifier)
    })

    $.RULE('whereClause', () => {
      $.CONSUME(Where)
      $.SUBRULE($.expression)
    })

    $.RULE('expression', () => {
      $.SUBRULE($.atomicExpression, { LABEL: 'lhs' });
      $.SUBRULE($.relationalOperator);
      $.SUBRULE2($.atomicExpression, { LABEL: 'rhs' });
    });

    $.RULE('atomicExpression', () => {
      $.OR([
        { ALT: () => $.CONSUME(Integer) },
        { ALT: () => $.CONSUME(Identifier) }
      ]);
    });

    $.RULE('relationalOperator', () => {
      $.OR([
        { ALT: () => $.CONSUME(GreaterThan) },
        { ALT: () => $.CONSUME(LessThan) }
      ]);
    });

    this.performSelfAnalysis();
  }
}

const selectParser = new SelectParser();

const BaseSQLVisitor = selectParser.getBaseCstVisitorConstructor();

class SQLToAstVisitor extends BaseSQLVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  selectClause(ctx) {
    const columns = ctx.Identifier.map((identToken) => identToken.image);
    return {
      type: 'SELECT_CLAUSE',
      columns
    }
  }

  selectStatement(ctx) {
    const select = this.visit(ctx.selectClause);
    const from = this.visit(ctx.fromClause);
    const where = this.visit(ctx.whereClause);

    return {
      type: 'SELECT_STMT',
      selectClause: select,
      fromClause: from,
      whereClause: where
    };
  }

  fromClause(ctx) {
    const tableName = ctx.Identifier[0].image;

    return  {
      type: 'FROM_CLAUSE',
      table: tableName
    };
  }

  whereClause(ctx) {
    const condition = this.visit(ctx.expression);

    return  {
      type: 'WHERE_CLAUSE',
      condition
    };
  }

  expression(ctx) {
    const lhs = this.visit(ctx.lhs[0]);
    const operator = this.visit(ctx.relationalOperator);
    const rhs = this.visit(ctx.rhs[0]);

    return {
      type: 'EXPRESSION',
      lhs,
      operator,
      rhs
    };
  }

  atomicExpression(ctx) {
    if (ctx.Integer) {
      return ctx.Integer[0].image;
    }
    return ctx.Identifier[0].image;
  }

  relationalOperator(ctx) {
    if (ctx.GreaterThan) {
      return ctx.GreaterThan[0].image;
    }

    return ctx.LessThan[0].image;
  }
}

function parseInput(text) {
  const lexingResult = SelectLexer.tokenize(text);
  selectParser.input = lexingResult.tokens;

  const cst = selectParser.selectStatement();

  if (selectParser.errors.length > 0) {
    throw new Error('parsing error', selectParser.errors);
  }
  const toAstVisitorInstance = new SQLToAstVisitor();

  const ast = toAstVisitorInstance.visit(cst);
  return ast;
}

console.time('ast')
console.log(parseInput(input));
writeFile('./result.json', parseInput(input))
console.timeEnd('ast')