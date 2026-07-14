/**
 * Calculator Tool - Perform arithmetic operations
 * Pattern: Function-based tool (same as execute)
 *
 * Two mutually exclusive modes:
 *  1. Binary mode:     { operation, a, b? } — add/subtract/multiply/divide/power/modulo (binary)
 *                                             or sqrt/sin/cos/tan/log/log10 (unary, `b` ignored)
 *  2. Expression mode: { expression }        — a full math expression string, e.g.
 *                                             "sqrt(16) + 2^3 - sin(pi/2)"
 *
 * Security: expression mode is evaluated with mathjs's sandboxed expression parser
 * (`evaluate()`), never raw `eval`/`Function`. Each call gets a fresh, empty scope
 * object (never reused/mutated across invocations) and expressions are capped at
 * MAX_EXPRESSION_LENGTH characters to avoid pathological inputs.
 */

import { evaluate } from 'mathjs';
import { MatimoError, ErrorCode, getGlobalMatimoLogger } from '@matimo/core/runtime';

const MAX_EXPRESSION_LENGTH = 500;
const MIN_PRECISION = 0;
const MAX_PRECISION = 15;

interface CalculatorParams {
  operation?: string;
  a?: number;
  b?: number;
  expression?: string;
  precision?: number;
}

type BinaryOperands = { a: number; b: number };
type UnaryOperands = { a: number };
type ExpressionOperands = { expression: string };

interface CalculatorResult {
  result: number;
  operation: string;
  original_operation: string;
  operands: BinaryOperands | UnaryOperands | ExpressionOperands;
}

/** Binary operations that require both `a` and `b`. */
const BINARY_OPERATIONS = new Set(['add', 'subtract', 'multiply', 'divide', 'power', 'modulo']);

/** Unary operations that only use `a`; `b` is optional/ignored. */
const UNARY_OPERATIONS = new Set(['sqrt', 'sin', 'cos', 'tan', 'log', 'log10']);

const VALID_OPERATIONS = [...BINARY_OPERATIONS, ...UNARY_OPERATIONS];

/**
 * Normalize operation name to handle variations
 */
function normalizeOperation(op: string): string {
  const normalized = op.toLowerCase().trim();

  // Map variations to canonical operation names
  const operationMap: Record<string, string> = {
    // Addition variants
    add: 'add',
    addition: 'add',
    sum: 'add',
    plus: 'add',
    '+': 'add',

    // Subtraction variants
    subtract: 'subtract',
    subtraction: 'subtract',
    minus: 'subtract',
    sub: 'subtract',
    '-': 'subtract',

    // Multiplication variants
    multiply: 'multiply',
    multiplication: 'multiply',
    times: 'multiply',
    product: 'multiply',
    mul: 'multiply',
    '*': 'multiply',
    x: 'multiply',

    // Division variants
    divide: 'divide',
    division: 'divide',
    div: 'divide',
    '/': 'divide',

    // Power variants
    power: 'power',
    pow: 'power',
    exponent: 'power',
    exponentiation: 'power',
    '^': 'power',
    '**': 'power',

    // Square root variants
    sqrt: 'sqrt',
    'square root': 'sqrt',
    square_root: 'sqrt',

    // Modulo variants
    modulo: 'modulo',
    mod: 'modulo',
    remainder: 'modulo',
    '%': 'modulo',

    // Trigonometric variants
    sin: 'sin',
    sine: 'sin',
    cos: 'cos',
    cosine: 'cos',
    tan: 'tan',
    tangent: 'tan',

    // Logarithm variants
    log: 'log',
    ln: 'log',
    'natural log': 'log',
    log10: 'log10',
    'log base 10': 'log10',
  };

  return operationMap[normalized] || normalized;
}

/**
 * Validate the `precision` parameter. Returns `undefined` when not supplied
 * (meaning: do not round). Throws for any non-integer or out-of-range value.
 */
function validatePrecision(precision: unknown): number | undefined {
  if (precision === undefined || precision === null) {
    return undefined;
  }

  if (
    typeof precision !== 'number' ||
    !Number.isInteger(precision) ||
    precision < MIN_PRECISION ||
    precision > MAX_PRECISION
  ) {
    throw new MatimoError(
      `Parameter \`precision\` must be an integer between ${MIN_PRECISION} and ${MAX_PRECISION}`,
      ErrorCode.INVALID_PARAMETER,
      { precision }
    );
  }

  return precision;
}

/** Round `value` to `precision` decimal places. No-op when `precision` is undefined. */
function applyPrecision(value: number, precision: number | undefined): number {
  if (precision === undefined) {
    return value;
  }
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/** Ensure a computed result is a real, finite number (not NaN/±Infinity). */
function assertFiniteResult(
  value: number,
  context: Record<string, unknown>,
  logger: ReturnType<typeof getGlobalMatimoLogger>
): void {
  if (!Number.isFinite(value)) {
    logger.error('Calculator produced a non-finite result', context);
    throw new MatimoError(
      'Result is not a finite number (division by zero, overflow, or an invalid domain)',
      ErrorCode.EXECUTION_FAILED,
      context
    );
  }
}

/**
 * Evaluate a full math expression string using mathjs's sandboxed expression parser.
 * Supports +, -, *, /, ^ (power), % (modulo), parentheses, sqrt/sin/cos/tan/log/log10,
 * and the constants pi and e.
 */
function evaluateExpression(
  expression: string,
  precision: number | undefined,
  logger: ReturnType<typeof getGlobalMatimoLogger>
): CalculatorResult {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new MatimoError(
      `Expression exceeds maximum length of ${MAX_EXPRESSION_LENGTH} characters`,
      ErrorCode.INVALID_PARAMETER,
      { length: expression.length, maxLength: MAX_EXPRESSION_LENGTH }
    );
  }

  logger.debug('Calculator tool invoked in expression mode', { expression });

  let rawResult: unknown;
  try {
    // Fresh, minimal scope object per call — never reused or mutated across invocations.
    rawResult = evaluate(expression, {});
  } catch (error) {
    logger.error('Failed to evaluate calculator expression', {
      expression,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new MatimoError(
      `Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCode.INVALID_PARAMETER,
      { expression },
      error
    );
  }

  if (typeof rawResult !== 'number') {
    throw new MatimoError(
      'Expression did not evaluate to a real number (it may involve complex numbers, ' +
        'units, matrices, or an undefined domain)',
      ErrorCode.EXECUTION_FAILED,
      { expression, resultType: typeof rawResult }
    );
  }

  assertFiniteResult(rawResult, { expression }, logger);

  const result = applyPrecision(rawResult, precision);

  const returnValue: CalculatorResult = {
    result,
    operation: 'expression',
    original_operation: 'expression',
    operands: { expression },
  };

  logger.info('Calculator expression evaluated', { expression, result });

  return returnValue;
}

/**
 * Evaluate a binary/unary operation using the classic `operation` + `a` (+ `b`) parameters.
 */
function evaluateBinary(
  operationInput: string,
  a: number | undefined,
  b: number | undefined,
  precision: number | undefined,
  logger: ReturnType<typeof getGlobalMatimoLogger>
): CalculatorResult {
  logger.debug('Calculator tool invoked in binary mode', { operation: operationInput, a, b });

  if (typeof a !== 'number' || Number.isNaN(a)) {
    logger.error('Invalid calculator parameters', { a, expectedType: 'number' });
    throw new MatimoError('Parameter `a` must be a number', ErrorCode.INVALID_PARAMETER, { a });
  }

  const normalizedOp = normalizeOperation(operationInput);
  const isUnary = UNARY_OPERATIONS.has(normalizedOp);
  const isBinary = BINARY_OPERATIONS.has(normalizedOp);

  if (!isUnary && !isBinary) {
    logger.error('Unsupported calculator operation', {
      operation: normalizedOp,
      requested: operationInput,
    });
    throw new MatimoError('Invalid operation', ErrorCode.INVALID_PARAMETER, {
      operation: operationInput,
      normalizedOperation: normalizedOp,
      validOperations: VALID_OPERATIONS,
    });
  }

  if (isBinary && (typeof b !== 'number' || Number.isNaN(b))) {
    logger.error('Invalid calculator parameters', {
      b,
      operation: normalizedOp,
      expectedType: 'number',
    });
    throw new MatimoError(
      `Parameter \`b\` is required and must be a number for operation \`${normalizedOp}\``,
      ErrorCode.INVALID_PARAMETER,
      { operation: normalizedOp, b }
    );
  }

  let result: number;

  switch (normalizedOp) {
    case 'add':
      result = a + (b as number);
      break;
    case 'subtract':
      result = a - (b as number);
      break;
    case 'multiply':
      result = a * (b as number);
      break;
    case 'divide':
      if ((b as number) === 0) {
        logger.error('Division by zero attempted', { a, b });
        throw new MatimoError('Division by zero', ErrorCode.EXECUTION_FAILED, { a, b });
      }
      result = a / (b as number);
      break;
    case 'power':
      result = Math.pow(a, b as number);
      break;
    case 'modulo':
      if ((b as number) === 0) {
        logger.error('Modulo by zero attempted', { a, b });
        throw new MatimoError('Modulo by zero', ErrorCode.EXECUTION_FAILED, { a, b });
      }
      result = a % (b as number);
      break;
    case 'sqrt':
      if (a < 0) {
        logger.error('Square root of negative number attempted', { a });
        throw new MatimoError(
          'Cannot compute the square root of a negative number',
          ErrorCode.EXECUTION_FAILED,
          { a }
        );
      }
      result = Math.sqrt(a);
      break;
    case 'sin':
      result = Math.sin(a);
      break;
    case 'cos':
      result = Math.cos(a);
      break;
    case 'tan':
      result = Math.tan(a);
      break;
    case 'log':
      if (a <= 0) {
        logger.error('Logarithm of non-positive number attempted', { a, operation: 'log' });
        throw new MatimoError(
          'Logarithm is undefined for non-positive numbers',
          ErrorCode.EXECUTION_FAILED,
          { a }
        );
      }
      result = Math.log(a);
      break;
    case 'log10':
      if (a <= 0) {
        logger.error('Logarithm of non-positive number attempted', { a, operation: 'log10' });
        throw new MatimoError(
          'Logarithm is undefined for non-positive numbers',
          ErrorCode.EXECUTION_FAILED,
          { a }
        );
      }
      result = Math.log10(a);
      break;
    default:
      // Unreachable — guarded above — kept for exhaustiveness/type-safety.
      throw new MatimoError('Invalid operation', ErrorCode.INVALID_PARAMETER, {
        operation: operationInput,
        normalizedOperation: normalizedOp,
        validOperations: VALID_OPERATIONS,
      });
  }

  assertFiniteResult(result, { operation: normalizedOp, a, b }, logger);

  result = applyPrecision(result, precision);

  const returnValue: CalculatorResult = {
    result,
    operation: normalizedOp,
    original_operation: operationInput,
    operands: isUnary ? { a } : { a, b: b as number },
  };

  logger.info('Calculator operation completed', {
    operation: normalizedOp,
    operands: returnValue.operands,
    result,
  });

  return returnValue;
}

/**
 * Perform an arithmetic calculation.
 *
 * Exactly one of the following must be provided:
 *  - `expression`: a full math expression string
 *  - `operation` (+ `a`, and `b` for binary operations)
 */
export default async function calculator(params: CalculatorParams): Promise<CalculatorResult> {
  const logger = getGlobalMatimoLogger();
  const { operation, a, b, expression } = params;

  const precision = validatePrecision(params.precision);

  const hasExpression = typeof expression === 'string' && expression.trim().length > 0;
  const hasOperation = typeof operation === 'string' && operation.trim().length > 0;
  const hasOperands = a !== undefined || b !== undefined;

  if (hasExpression && (hasOperation || hasOperands)) {
    throw new MatimoError(
      'Provide either `expression` OR `operation` (with `a`/`b`) — not both.',
      ErrorCode.INVALID_PARAMETER,
      { expression, operation, a, b }
    );
  }

  if (!hasExpression && !hasOperation) {
    throw new MatimoError(
      'Must provide either `expression`, or `operation` (with `a` and, for binary ' +
        'operations, `b`).',
      ErrorCode.INVALID_PARAMETER,
      {}
    );
  }

  if (hasExpression) {
    return evaluateExpression(expression as string, precision, logger);
  }

  return evaluateBinary(operation as string, a, b, precision, logger);
}
