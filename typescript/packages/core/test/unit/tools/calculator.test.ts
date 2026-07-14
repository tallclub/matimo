import path from 'path';
import fs from 'fs';
import { ToolLoader } from '../../../src/core/tool-loader';
import type { Parameter } from '../../../src/core/types';
import { MatimoError } from '../../../src/errors/matimo-error';

type CalculatorParams = {
  operation?: string;
  a?: number;
  b?: number;
  expression?: string;
  precision?: number;
};

type CalculatorResult = {
  result: number;
  operation: string;
  original_operation: string;
  operands: Record<string, unknown>;
};

describe('Calculator Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  describe('Tool Definition', () => {
    it('should have valid calculator tool definition file', () => {
      const defPath = path.join(coreToolsPath, 'calculator', 'definition.yaml');
      expect(fs.existsSync(defPath)).toBe(true);
    });

    it('should load calculator tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const calc = tools.get('calculator');

      expect(calc).toBeDefined();
      expect(calc!.name).toBe('calculator');
      expect(calc!.version).toBe('1.1.0');
      expect(calc!.description).toBeDefined();
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const calc = tools.get('calculator');

      expect(calc!.execution.type).toBe('function');
      expect(calc!.execution).toHaveProperty('code');
      expect((calc!.execution as Record<string, unknown>).code).toBe('./calculator.js');
    });
  });

  describe('Parameters', () => {
    it('should have all calculator parameters defined', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const calc = tools.get('calculator')!;

      expect(calc.parameters).toBeDefined();
      const params = calc.parameters as Record<string, Parameter>;
      expect(params.operation).toBeDefined();
      expect(params.a).toBeDefined();
      expect(params.b).toBeDefined();
      expect(params.expression).toBeDefined();
      expect(params.precision).toBeDefined();
    });

    it('should mark all parameters as optional (mode is validated at runtime)', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const calc = tools.get('calculator')!;
      const params = calc.parameters as Record<string, Parameter>;

      expect(params.operation.required).toBeFalsy();
      expect(params.a.required).toBeFalsy();
      expect(params.b.required).toBeFalsy();
      expect(params.expression.required).toBeFalsy();
      expect(params.precision.required).toBeFalsy();
    });
  });

  describe('Output Schema', () => {
    it('should define output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const calc = tools.get('calculator')!;

      expect(calc.output_schema).toBeDefined();
      expect(calc.output_schema!.properties).toBeDefined();
    });

    it('should define result, operation, original_operation and operands', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const calc = tools.get('calculator')!;

      const props = calc.output_schema!.properties as Record<string, unknown>;
      expect(props).toHaveProperty('result');
      expect(props).toHaveProperty('operation');
      expect(props).toHaveProperty('original_operation');
      expect(props).toHaveProperty('operands');
    });
  });

  describe('Implementation', () => {
    it('should have implementation file', () => {
      const implPath = path.join(coreToolsPath, 'calculator', 'calculator.ts');
      expect(fs.existsSync(implPath)).toBe(true);
    });

    it('implementation should export default async function', () => {
      const implPath = path.join(coreToolsPath, 'calculator', 'calculator.ts');
      const content = fs.readFileSync(implPath, 'utf-8');

      expect(content).toContain('export default async function calculator');
    });

    it('implementation should use mathjs evaluate (not raw eval/Function)', () => {
      const implPath = path.join(coreToolsPath, 'calculator', 'calculator.ts');
      const content = fs.readFileSync(implPath, 'utf-8');

      expect(content).toContain("from 'mathjs'");
      expect(content).not.toMatch(/[^.\w]eval\(/);
      expect(content).not.toContain('new Function(');
    });
  });

  describe('Examples', () => {
    it('should include examples in tool definition', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const calc = tools.get('calculator')!;

      expect(calc.examples).toBeDefined();
      expect(Array.isArray(calc.examples)).toBe(true);
      expect((calc.examples as Array<unknown>).length).toBeGreaterThan(0);
    });

    it('should include an expression-mode example', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const calc = tools.get('calculator')!;

      const examples = calc.examples as Array<Record<string, unknown>>;
      const exprExample = examples.find(
        (ex) => (ex.params as Record<string, unknown>).expression !== undefined
      );
      expect(exprExample).toBeDefined();
    });
  });
});

describe('Calculator Implementation', () => {
  let calculator: (params: CalculatorParams) => Promise<CalculatorResult>;

  beforeAll(async () => {
    const calculatorModule = await import('../../../tools/calculator/calculator');
    calculator = calculatorModule.default;
  });

  describe('Binary mode — backward-compatible core operations', () => {
    it('adds two numbers (canonical operation name)', async () => {
      const result = await calculator({ operation: 'add', a: 5, b: 3 });
      expect(result).toEqual({
        result: 8,
        operation: 'add',
        original_operation: 'add',
        operands: { a: 5, b: 3 },
      });
    });

    it('adds two numbers using an alias', async () => {
      const result = await calculator({ operation: 'addition', a: 10, b: 20 });
      expect(result.result).toBe(30);
      expect(result.operation).toBe('add');
      expect(result.original_operation).toBe('addition');
      expect(result.operands).toEqual({ a: 10, b: 20 });
    });

    it('adds using symbol alias "+"', async () => {
      const result = await calculator({ operation: '+', a: 1, b: 2 });
      expect(result.result).toBe(3);
      expect(result.operation).toBe('add');
    });

    it('subtracts two numbers', async () => {
      const result = await calculator({ operation: 'subtract', a: 10, b: 3 });
      expect(result).toEqual({
        result: 7,
        operation: 'subtract',
        original_operation: 'subtract',
        operands: { a: 10, b: 3 },
      });
    });

    it('subtracts using "minus" alias', async () => {
      const result = await calculator({ operation: 'minus', a: 10, b: 3 });
      expect(result.result).toBe(7);
      expect(result.operation).toBe('subtract');
    });

    it('multiplies two numbers', async () => {
      const result = await calculator({ operation: 'multiply', a: 4, b: 7 });
      expect(result).toEqual({
        result: 28,
        operation: 'multiply',
        original_operation: 'multiply',
        operands: { a: 4, b: 7 },
      });
    });

    it('multiplies using "times" alias', async () => {
      const result = await calculator({ operation: 'times', a: 4, b: 7 });
      expect(result.result).toBe(28);
      expect(result.operation).toBe('multiply');
    });

    it('divides two numbers', async () => {
      const result = await calculator({ operation: 'divide', a: 10, b: 2 });
      expect(result).toEqual({
        result: 5,
        operation: 'divide',
        original_operation: 'divide',
        operands: { a: 10, b: 2 },
      });
    });

    it('divides using "div" alias', async () => {
      const result = await calculator({ operation: 'div', a: 9, b: 3 });
      expect(result.result).toBe(3);
      expect(result.operation).toBe('divide');
    });

    it('throws MatimoError on division by zero', async () => {
      await expect(calculator({ operation: 'divide', a: 1, b: 0 })).rejects.toThrow(
        'Division by zero'
      );
    });

    it('throws MatimoError with EXECUTION_FAILED code on division by zero', async () => {
      try {
        await calculator({ operation: 'divide', a: 1, b: 0 });
        fail('Should have thrown');
      } catch (error) {
        const matimoError = error as MatimoError;
        expect(matimoError.code).toBe('EXECUTION_FAILED');
      }
    });
  });

  describe('Binary mode — new operations', () => {
    it('computes power', async () => {
      const result = await calculator({ operation: 'power', a: 2, b: 10 });
      expect(result.result).toBe(1024);
      expect(result.operation).toBe('power');
      expect(result.operands).toEqual({ a: 2, b: 10 });
    });

    it('computes power using "^" alias', async () => {
      const result = await calculator({ operation: '^', a: 3, b: 2 });
      expect(result.result).toBe(9);
      expect(result.operation).toBe('power');
    });

    it('computes power using "pow" alias', async () => {
      const result = await calculator({ operation: 'pow', a: 2, b: 3 });
      expect(result.result).toBe(8);
    });

    it('computes modulo', async () => {
      const result = await calculator({ operation: 'modulo', a: 10, b: 3 });
      expect(result.result).toBe(1);
      expect(result.operation).toBe('modulo');
    });

    it('computes modulo using "%" alias', async () => {
      const result = await calculator({ operation: '%', a: 10, b: 3 });
      expect(result.result).toBe(1);
    });

    it('computes modulo using "mod" alias', async () => {
      const result = await calculator({ operation: 'mod', a: 7, b: 4 });
      expect(result.result).toBe(3);
    });

    it('throws on modulo by zero', async () => {
      await expect(calculator({ operation: 'modulo', a: 5, b: 0 })).rejects.toThrow(
        'Modulo by zero'
      );
    });

    it('computes square root (unary — omits b)', async () => {
      const result = await calculator({ operation: 'sqrt', a: 144 });
      expect(result.result).toBe(12);
      expect(result.operation).toBe('sqrt');
      expect(result.operands).toEqual({ a: 144 });
      expect(result.operands).not.toHaveProperty('b');
    });

    it('computes square root and ignores a provided b', async () => {
      const result = await calculator({ operation: 'sqrt', a: 25, b: 999 });
      expect(result.result).toBe(5);
      expect(result.operands).toEqual({ a: 25 });
    });

    it('throws on square root of a negative number', async () => {
      await expect(calculator({ operation: 'sqrt', a: -4 })).rejects.toThrow(
        'Cannot compute the square root of a negative number'
      );
    });

    it('computes sine', async () => {
      const result = await calculator({ operation: 'sin', a: 0 });
      expect(result.result).toBe(0);
      expect(result.operation).toBe('sin');
    });

    it('computes sine using "sine" alias', async () => {
      const result = await calculator({ operation: 'sine', a: 0 });
      expect(result.result).toBe(0);
    });

    it('computes cosine', async () => {
      const result = await calculator({ operation: 'cos', a: 0 });
      expect(result.result).toBe(1);
    });

    it('computes cosine using "cosine" alias', async () => {
      const result = await calculator({ operation: 'cosine', a: 0 });
      expect(result.result).toBe(1);
    });

    it('computes tangent', async () => {
      const result = await calculator({ operation: 'tan', a: 0 });
      expect(result.result).toBe(0);
    });

    it('computes tangent using "tangent" alias', async () => {
      const result = await calculator({ operation: 'tangent', a: 0 });
      expect(result.result).toBe(0);
    });

    it('computes natural log', async () => {
      const result = await calculator({ operation: 'log', a: Math.E });
      expect(result.result).toBeCloseTo(1, 10);
      expect(result.operation).toBe('log');
    });

    it('computes natural log using "ln" alias', async () => {
      const result = await calculator({ operation: 'ln', a: 1 });
      expect(result.result).toBe(0);
      expect(result.operation).toBe('log');
    });

    it('throws on log of zero', async () => {
      await expect(calculator({ operation: 'log', a: 0 })).rejects.toThrow(
        'Logarithm is undefined for non-positive numbers'
      );
    });

    it('throws on log of a negative number', async () => {
      await expect(calculator({ operation: 'log', a: -5 })).rejects.toThrow(
        'Logarithm is undefined for non-positive numbers'
      );
    });

    it('computes log10', async () => {
      const result = await calculator({ operation: 'log10', a: 100 });
      expect(result.result).toBe(2);
      expect(result.operation).toBe('log10');
    });

    it('throws on log10 of a non-positive number', async () => {
      await expect(calculator({ operation: 'log10', a: -1 })).rejects.toThrow(
        'Logarithm is undefined for non-positive numbers'
      );
    });
  });

  describe('Binary mode — validation errors', () => {
    it('throws when a is missing', async () => {
      await expect(calculator({ operation: 'add', b: 3 })).rejects.toThrow(
        'Parameter `a` must be a number'
      );
    });

    it('throws when a is not a number', async () => {
      await expect(
        calculator({ operation: 'add', a: 'nope' as unknown as number, b: 3 })
      ).rejects.toThrow('Parameter `a` must be a number');
    });

    it('throws when b is missing for a binary operation', async () => {
      await expect(calculator({ operation: 'add', a: 5 })).rejects.toThrow(
        'Parameter `b` is required and must be a number for operation `add`'
      );
    });

    it('throws when b is not a number for a binary operation', async () => {
      await expect(
        calculator({ operation: 'multiply', a: 5, b: 'nope' as unknown as number })
      ).rejects.toThrow('Parameter `b` is required and must be a number for operation `multiply`');
    });

    it('throws on an invalid/unrecognized operation', async () => {
      await expect(calculator({ operation: 'frobnicate', a: 1, b: 2 })).rejects.toThrow(
        'Invalid operation'
      );
    });

    it('throws a non-finite-result error for a non-finite binary result', async () => {
      await expect(calculator({ operation: 'power', a: 0, b: -1 })).rejects.toThrow(
        'Result is not a finite number'
      );
    });
  });

  describe('Expression mode', () => {
    it('evaluates a simple arithmetic expression', async () => {
      const result = await calculator({ expression: '2 + 3 * 4' });
      expect(result.result).toBe(14);
      expect(result.operation).toBe('expression');
      expect(result.original_operation).toBe('expression');
      expect(result.operands).toEqual({ expression: '2 + 3 * 4' });
    });

    it('respects parentheses for precedence', async () => {
      const result = await calculator({ expression: '(2 + 3) * 4' });
      expect(result.result).toBe(20);
    });

    it('evaluates power via ^', async () => {
      const result = await calculator({ expression: '2^10' });
      expect(result.result).toBe(1024);
    });

    it('evaluates modulo via %', async () => {
      const result = await calculator({ expression: '10 % 3' });
      expect(result.result).toBe(1);
    });

    it('evaluates functions and constants together', async () => {
      const result = await calculator({ expression: 'sqrt(16) + 2^3 - sin(pi/2)' });
      expect(result.result).toBe(11);
    });

    it('supports the constant e', async () => {
      const result = await calculator({ expression: 'e' });
      expect(result.result).toBeCloseTo(Math.E, 10);
    });

    it('supports the constant pi', async () => {
      const result = await calculator({ expression: 'pi' });
      expect(result.result).toBeCloseTo(Math.PI, 10);
    });

    it('supports log10 function', async () => {
      const result = await calculator({ expression: 'log10(1000)' });
      expect(result.result).toBe(3);
    });

    it('supports natural log function', async () => {
      const result = await calculator({ expression: 'log(e)' });
      expect(result.result).toBeCloseTo(1, 10);
    });

    it('throws for a syntactically invalid expression', async () => {
      await expect(calculator({ expression: '2 + + + ' })).rejects.toThrow(
        'Failed to evaluate expression'
      );
    });

    it('throws for an expression exceeding the max length', async () => {
      const longExpr = '1+'.repeat(300) + '1';
      await expect(calculator({ expression: longExpr })).rejects.toThrow(
        'Expression exceeds maximum length'
      );
    });

    it('throws when the expression evaluates to a complex number', async () => {
      await expect(calculator({ expression: 'sqrt(-1)' })).rejects.toThrow(
        'Expression did not evaluate to a real number'
      );
    });

    it('throws when the expression evaluates to a non-finite number', async () => {
      await expect(calculator({ expression: '1/0' })).rejects.toThrow(
        'Result is not a finite number'
      );
    });
  });

  describe('Mode validation', () => {
    it('throws when both expression and operation are provided', async () => {
      await expect(calculator({ expression: '1+1', operation: 'add', a: 1, b: 2 })).rejects.toThrow(
        'Provide either `expression` OR `operation`'
      );
    });

    it('throws when expression and bare operands (no operation) are provided', async () => {
      await expect(calculator({ expression: '1+1', a: 5 })).rejects.toThrow(
        'Provide either `expression` OR `operation`'
      );
    });

    it('throws when neither expression nor operation is provided', async () => {
      await expect(calculator({})).rejects.toThrow(
        'Must provide either `expression`, or `operation`'
      );
    });

    it('throws when neither expression nor operation is provided, even with bare a/b', async () => {
      await expect(calculator({ a: 1, b: 2 })).rejects.toThrow(
        'Must provide either `expression`, or `operation`'
      );
    });
  });

  describe('Precision', () => {
    it('rounds a binary-mode result to the given precision', async () => {
      const result = await calculator({ operation: 'divide', a: 10, b: 3, precision: 2 });
      expect(result.result).toBe(3.33);
    });

    it('rounds an expression-mode result to the given precision', async () => {
      const result = await calculator({ expression: '10 / 3', precision: 4 });
      expect(result.result).toBe(3.3333);
    });

    it('rounds to zero decimal places', async () => {
      const result = await calculator({ operation: 'divide', a: 10, b: 3, precision: 0 });
      expect(result.result).toBe(3);
    });

    it('leaves the result unrounded when precision is omitted', async () => {
      const result = await calculator({ operation: 'divide', a: 10, b: 3 });
      expect(result.result).toBe(10 / 3);
    });

    it('throws when precision is not an integer', async () => {
      await expect(calculator({ operation: 'add', a: 1, b: 2, precision: 2.5 })).rejects.toThrow(
        'Parameter `precision` must be an integer between 0 and 15'
      );
    });

    it('throws when precision is negative', async () => {
      await expect(calculator({ operation: 'add', a: 1, b: 2, precision: -1 })).rejects.toThrow(
        'Parameter `precision` must be an integer between 0 and 15'
      );
    });

    it('throws when precision is greater than 15', async () => {
      await expect(calculator({ operation: 'add', a: 1, b: 2, precision: 16 })).rejects.toThrow(
        'Parameter `precision` must be an integer between 0 and 15'
      );
    });

    it('throws when precision is not a number', async () => {
      await expect(
        calculator({
          operation: 'add',
          a: 1,
          b: 2,
          precision: 'two' as unknown as number,
        })
      ).rejects.toThrow('Parameter `precision` must be an integer between 0 and 15');
    });
  });
});
