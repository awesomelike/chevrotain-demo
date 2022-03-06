const {
  Lexer,
  createToken,
  tokenMatcher,
  CstParser
} = require('chevrotain');
const numberToWords = require('number-to-words');

const wordToNum = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  zero: 0
}

const AdditionOperator = createToken({
  name: "AdditionOperator",
  pattern: Lexer.NA
});
const Plus = createToken({
  name: "Plus",
  pattern: /\+|plus/,
  categories: AdditionOperator
});
const Minus = createToken({
  name: "Minus",
  pattern: /-|minus/,
  categories: AdditionOperator
});

const MultiplicationOperator = createToken({
  name: "MultiplicationOperator",
  pattern: Lexer.NA
});
const Multi = createToken({
  name: "Multi",
  pattern: /\*|times/,
  categories: MultiplicationOperator
});
const Div = createToken({
  name: "Div",
  pattern: /\/|by/,
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
  pattern: new RegExp(`[1-9]\d*|${Object.keys(wordToNum).join('|')}`)
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
      const { image } = ctx.NumberLiteral[0];
      const normalNumber = parseInt(image, 10);
      if (isNaN(normalNumber)) {
        return wordToNum[image];
      }
      return normalNumber;
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

if (!INPUT) {
  throw new Error('Please provide valid input');
}

parser.input = calculatorLexer.tokenize(INPUT)?.tokens || [];
const calculatorInterpreter = new CalculatorInterpreter();

console.log(numberToWords.toWords(calculatorInterpreter.visit(parser.expression())));
