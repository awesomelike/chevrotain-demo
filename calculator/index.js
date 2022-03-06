const {
  Lexer,
  createToken,
  tokenMatcher,
  CstParser
} = require('chevrotain');

const AdditionOperator = createToken({
  name: "AdditionOperator",
  pattern: Lexer.NA
});
const Plus = createToken({
  name: "Plus",
  pattern: /\+/,
  categories: AdditionOperator
});
const Minus = createToken({
  name: "Minus",
  pattern: /-/,
  categories: AdditionOperator
});

const MultiplicationOperator = createToken({
  name: "MultiplicationOperator",
  pattern: Lexer.NA
});
const Multi = createToken({
  name: "Multi",
  pattern: /\*/,
  categories: MultiplicationOperator
});
const Div = createToken({
  name: "Div",
  pattern: /\//,
  categories: MultiplicationOperator
});

const LParen = createToken({
  name: "LParen",
  pattern: /\(/
});
const RParen = createToken({
  name: "RParen",
  pattern: /\)/
});
const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /[1-9]\d*/
});

const PowerFunc = createToken({
  name: "PowerFunc",
  pattern: /power/
});
const Comma = createToken({
  name: "Comma",
  pattern: /,/
});
const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED
});

const allTokens = [WhiteSpace, Plus, Minus, Multi, Div, LParen, RParen, NumberLiteral, AdditionOperator, MultiplicationOperator, PowerFunc, Comma];

const calculatorLexer = new Lexer(allTokens);

class CalculatorParser extends CstParser {
  constructor() {
    super(allTokens);

    const $ = this;

    $.RULE('expression', () => {
      $.SUBRULE($.additionExpression);
    });

    $.RULE('additionExpression', () => {
      $.SUBRULE($.multiplicationExpression, { LABEL: 'lhs' })
      $.MANY(() => {
        $.CONSUME(AdditionOperator);
        $.SUBRULE2($.multiplicationExpression, { LABEL: 'rhs' });
      });
    });

    $.RULE('multiplicationExpression', () => {
      $.SUBRULE($.atomicExpression, { LABEL: 'lhs' });
      $.MANY(() => {
        $.CONSUME(MultiplicationOperator);
        $.SUBRULE2($.atomicExpression, { LABEL: 'rhs' });       
      })
    });

    $.RULE('atomicExpression', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.parenthesisExpression) },
        { ALT: () => $.CONSUME(NumberLiteral) },
        { ALT: () => $.SUBRULE($.powerFunction) }
      ])
    });

    $.RULE('parenthesisExpression', () => {
      $.CONSUME(LParen);
      $.SUBRULE($.expression);
      $.CONSUME(RParen);
    });

    $.RULE('powerFunction', () => {
      $.CONSUME(PowerFunc);
      $.CONSUME(LParen);
      $.SUBRULE($.expression, { LABEL: 'base' });
      $.CONSUME(Comma);
      $.SUBRULE2($.expression, { LABEL: 'exponent' });
      $.CONSUME(RParen);
    });

    this.performSelfAnalysis();
  }
}

const parser = new CalculatorParser();

// Interpreter
const BaseCstVisitor = parser.getBaseCstVisitorConstructor();

class CalculatorInterpreter extends BaseCstVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  expression(ctx) {
    return this.visit(ctx.additionExpression);
  }

  additionExpression(ctx) {
    let result = this.visit(ctx.lhs);
    if (ctx.rhs) {
      ctx.rhs.forEach((rhsOperand, index) => {
        const rhsValue = this.visit(rhsOperand);
        const operator = ctx.AdditionOperator[index];

        if (tokenMatcher(operator, Plus)) {
          result += rhsValue;
        } else if (tokenMatcher(operator, Minus)) {
          result -= rhsValue;
        }
      });
    }
    return result;
  }

  multiplicationExpression(ctx) {
    let result = this.visit(ctx.lhs);
    if (ctx.rhs) {
      ctx.rhs.forEach((rhsOperand, index) => {
        const rhsValue = this.visit(rhsOperand);
        const operator = ctx.MultiplicationOperator[index];

        if (tokenMatcher(operator, Multi)) {
          result *= rhsValue;
        } else {
          result /= rhsValue;
        }
      });
    }
    return result;
  }

  atomicExpression(ctx) {
    if (ctx.parenthesisExpression) {
      return this.visit(ctx.parenthesisExpression);
    }
    if (ctx.NumberLiteral) {
      return parseInt(ctx.NumberLiteral[0].image, 10);
    }
    if (ctx.powerFunction) {
      return this.visit(ctx.powerFunction);
    }
  }

  parenthesisExpression(ctx) {
    return this.visit(ctx.expression);
  }

  powerFunction(ctx) {
    const base = this.visit(ctx.base);
    const exponent = this.visit(ctx.exponent);

    return Math.pow(base, exponent);
  } 
}

const INPUT = process.argv[2];

parser.input = calculatorLexer.tokenize(INPUT)?.tokens || [];
const calculatorInterpreter = new CalculatorInterpreter();

console.log(calculatorInterpreter.visit(parser.expression()));
