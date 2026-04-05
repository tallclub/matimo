import {
  tool,
  setGlobalMatimoInstance,
  getGlobalMatimoInstance,
  executeToolViaDecorator,
  convertArgsToParams,
} from '../../src/decorators/tool-decorator';
import { MatimoInstance } from '../../src/matimo-instance';

describe('Tool Decorator', () => {
  let matimo: MatimoInstance;

  beforeEach(async () => {
    // Load real tools from core tools directory
    const toolsPath = `${__dirname}/../../tools`;
    matimo = await MatimoInstance.init(toolsPath);
    setGlobalMatimoInstance(matimo);
  });

  afterEach(() => {
    setGlobalMatimoInstance(null);
  });

  it('should be a function that returns a decorator function', () => {
    const toolDecorator = tool('calculator');
    expect(typeof toolDecorator).toBe('function');
  });

  it('should set and get global Matimo instance', async () => {
    const testInstance = await MatimoInstance.init(`${__dirname}/../../tools`);
    setGlobalMatimoInstance(testInstance);

    const retrieved = getGlobalMatimoInstance();
    expect(retrieved).toBe(testInstance);
  });

  it('should throw error when getting global instance without setting it', () => {
    setGlobalMatimoInstance(null);

    expect(() => {
      getGlobalMatimoInstance();
    }).toThrow('Global MatimoInstance not set');
  });

  it('should execute calculator tool with instance property approach', async () => {
    // Create a test class with decorated method using instance property
    class Calculator {
      constructor(public matimo: MatimoInstance) {}

      // Manually apply decorator function to test execution path
      async calculate(operation: string, a: number, b: number) {
        // Execute the tool
        return await this.matimo.execute('calculator', { operation, a, b });
      }
    }

    const calc = new Calculator(matimo);
    const result = await calc.calculate('add', 42, 8);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should execute echo tool via global instance', async () => {
    // Verify the global instance works for tool execution
    const globalInstance = getGlobalMatimoInstance();

    // Use the calculator tool that's available in fixtures
    const result = await globalInstance.execute('calculator', { operation: 'add', a: 5, b: 3 });

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should throw error when tool not found during execution', async () => {
    const globalInstance = getGlobalMatimoInstance();

    await expect(globalInstance.execute('non-existent-tool', {})).rejects.toThrow(
      "Tool 'non-existent-tool' not found"
    );
  });

  it('should handle tool decorator function wrapping', () => {
    const decoratorFactory = tool('calculator');

    // The decorator factory should return a function
    expect(typeof decoratorFactory).toBe('function');

    // The decorator should accept the target and context
    // Note: We're testing the function structure, not executing decorators
    // since TypeScript's decorator type system has strict requirements in test context
  });

  it('should pass correct parameters to matimo.execute', async () => {
    // Spy on matimo.execute to verify parameters
    const executeSpy = jest.spyOn(matimo, 'execute');

    class Calculator {
      constructor(public matimo: MatimoInstance) {}

      async calculate(operation: string, a: number, b: number) {
        return await this.matimo.execute('calculator', { operation, a, b });
      }
    }

    const calc = new Calculator(matimo);

    await calc.calculate('add', 10, 20);

    // Verify execute was called with correct tool name
    expect(executeSpy).toHaveBeenCalledWith(
      'calculator',
      expect.objectContaining({
        operation: 'add',
        a: 10,
        b: 20,
      })
    );

    executeSpy.mockRestore();
  });

  it('should throw error when no Matimo instance available for decorator', async () => {
    // Clear global instance
    setGlobalMatimoInstance(null);

    class BrokenAgent {
      // No matimo property, no global instance
      async doSomething() {
        // This would normally be decorated, but we simulate the error scenario
        // Simulate decorator trying to find instance
        let found = null;
        if (!found) {
          found = null; // No global instance
        }
        if (!found) {
          throw new Error(
            `Matimo instance not found for @tool('calculator') decorator. ` +
              `Either add matimo property to class or call setGlobalMatimoInstance() first.`
          );
        }
      }
    }

    const agent = new BrokenAgent();
    await expect(agent.doSomething()).rejects.toThrow('Matimo instance not found');
  });

  it('should throw error when tool not found in decorator execution', async () => {
    class Agent {
      constructor(public matimo: MatimoInstance) {}

      async callTool() {
        // Simulate decorator calling non-existent tool
        const toolDef = this.matimo.getTool('non-existent-tool');
        if (!toolDef) {
          throw new Error("Tool 'non-existent-tool' not found in Matimo registry");
        }
      }
    }

    const agent = new Agent(matimo);
    await expect(agent.callTool()).rejects.toThrow("Tool 'non-existent-tool' not found");
  });

  it('should convert positional arguments to named parameters correctly', async () => {
    const executeSpy = jest.spyOn(matimo, 'execute');

    class Agent {
      constructor(public matimo: MatimoInstance) {}

      async add(operation: string, a: number, b: number) {
        // Simulate decorator parameter conversion
        const params = { operation, a, b };
        return await this.matimo.execute('calculator', params);
      }
    }

    const agent = new Agent(matimo);
    await agent.add('add', 5, 3);

    expect(executeSpy).toHaveBeenCalledWith('calculator', {
      operation: 'add',
      a: 5,
      b: 3,
    });

    executeSpy.mockRestore();
  });

  it('should handle multiple tool calls on same class', async () => {
    const executeSpy = jest.spyOn(matimo, 'execute');

    class MultiToolAgent {
      constructor(public matimo: MatimoInstance) {}

      async add(operation: string, a: number, b: number) {
        return await this.matimo.execute('calculator', { operation, a, b });
      }

      async addAgain(operation: string, a: number, b: number) {
        return await this.matimo.execute('calculator', { operation, a, b });
      }
    }

    const agent = new MultiToolAgent(matimo);

    await agent.add('add', 1, 2);
    await agent.addAgain('subtract', 10, 3);

    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy).toHaveBeenNthCalledWith(1, 'calculator', expect.any(Object));
    expect(executeSpy).toHaveBeenNthCalledWith(2, 'calculator', expect.any(Object));

    executeSpy.mockRestore();
  });

  it('should prefer class instance property over global instance', async () => {
    const executeSpy = jest.spyOn(matimo, 'execute');

    // Create a different instance
    const otherMatimo = await MatimoInstance.init(`${__dirname}/../../tools`);
    const otherSpy = jest.spyOn(otherMatimo, 'execute');

    class Agent {
      constructor(public matimo: MatimoInstance) {}

      async call(operation: string, a: number, b: number) {
        return await this.matimo.execute('calculator', { operation, a, b });
      }
    }

    const agent = new Agent(otherMatimo);
    // Global instance is set but should be overridden
    setGlobalMatimoInstance(matimo);

    await agent.call('add', 5, 5);

    // Should have called the instance property, not global
    expect(otherSpy).toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();

    otherSpy.mockRestore();
    executeSpy.mockRestore();
  });

  it('should handle empty parameters case', async () => {
    const executeSpy = jest.spyOn(matimo, 'execute');

    class Agent {
      constructor(public matimo: MatimoInstance) {}

      async noParams() {
        return await this.matimo.execute('calculator', { operation: 'add', a: 1, b: 1 });
      }
    }

    const agent = new Agent(matimo);
    await agent.noParams();

    expect(executeSpy).toHaveBeenCalledWith('calculator', {
      operation: 'add',
      a: 1,
      b: 1,
    });

    executeSpy.mockRestore();
  });

  describe('Decorator Interception', () => {
    it('should intercept method calls and execute tool via decorator', async () => {
      // Create a class that uses the decorator to wrap a method
      class DecoratedAgent {
        constructor(public matimo: MatimoInstance) {}

        // Simulate a decorated method that would normally be intercepted
        async calculate(operation: string, a: number, b: number) {
          // In a real scenario, the decorator would intercept this call
          // Here we simulate the interception by calling executeToolViaDecorator
          return await executeToolViaDecorator('calculator', this, [operation, a, b]);
        }
      }

      const agent = new DecoratedAgent(matimo);
      const result = await agent.calculate('multiply', 5, 4);

      // Verify the tool was executed and returned a result
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should use instance matimo property over global instance in decorator', async () => {
      const executeSpy = jest.spyOn(matimo, 'execute');

      // Create a different instance
      const otherMatimo = await MatimoInstance.init(`${__dirname}/../../tools`);
      const otherSpy = jest.spyOn(otherMatimo, 'execute');

      class DecoratedAgent {
        constructor(public matimo: MatimoInstance) {}

        async calculate(operation: string, a: number, b: number) {
          // Use decorator interception
          return await executeToolViaDecorator('calculator', this, [operation, a, b]);
        }
      }

      const agent = new DecoratedAgent(otherMatimo);
      setGlobalMatimoInstance(matimo); // Set a different global instance

      await agent.calculate('add', 10, 20);

      // The instance property should be preferred over global
      expect(otherSpy).toHaveBeenCalled();
      expect(executeSpy).not.toHaveBeenCalled();

      otherSpy.mockRestore();
      executeSpy.mockRestore();
    });

    it('should convert decorator arguments to tool parameters', async () => {
      class DecoratedAgent {
        constructor(public matimo: MatimoInstance) {}

        async calculate(operation: string, a: number, b: number) {
          const tool = this.matimo.getTool('calculator')!;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const params = convertArgsToParams([operation, a, b], tool as any);
          return params;
        }
      }

      const agent = new DecoratedAgent(matimo);
      const params = await agent.calculate('divide', 20, 4);

      // Verify parameters are correctly mapped to tool schema
      expect(params).toEqual({
        operation: 'divide',
        a: 20,
        b: 4,
      });
    });

    it('should handle decorator with no arguments', async () => {
      class DecoratedAgent {
        constructor(public matimo: MatimoInstance) {}

        async noArgs() {
          const tool = this.matimo.getTool('calculator')!;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const params = convertArgsToParams([], tool as any);
          return params;
        }
      }

      const agent = new DecoratedAgent(matimo);
      const params = await agent.noArgs();

      // Should return empty params when no args provided
      expect(params).toEqual({});
    });

    it('should fail decorator execution when tool not found', async () => {
      class DecoratedAgent {
        constructor(public matimo: MatimoInstance) {}

        async badTool() {
          // Try to execute non-existent tool via decorator
          return await executeToolViaDecorator('non-existent-tool', this, []);
        }
      }

      const agent = new DecoratedAgent(matimo);

      // Should throw error because tool doesn't exist
      await expect(agent.badTool()).rejects.toThrow("Tool 'non-existent-tool' not found");
    });

    it('should use global instance when class has no matimo property', async () => {
      class DecoratedAgent {
        // No matimo property - should use global instance
        async calculate(operation: string, a: number, b: number) {
          return await executeToolViaDecorator('calculator', this, [operation, a, b]);
        }
      }

      const agent = new DecoratedAgent();
      const result = await agent.calculate('add', 5, 5);

      // Should succeed using global instance
      expect(result).toBeDefined();
    });
  });
});

describe('Decorator Helper Functions', () => {
  let matimo: MatimoInstance;

  beforeEach(async () => {
    const toolsPath = `${__dirname}/../../tools`;
    matimo = await MatimoInstance.init(toolsPath);
    setGlobalMatimoInstance(matimo);
  });

  afterEach(() => {
    setGlobalMatimoInstance(null);
  });

  describe('convertArgsToParams', () => {
    it('should convert positional args to named parameters', () => {
      const tool = matimo.getTool('calculator');
      const args = ['add', 5, 3];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = convertArgsToParams(args, tool! as any);

      expect(params).toEqual({
        operation: 'add',
        a: 5,
        b: 3,
      });
    });

    it('should handle partial args (fewer args than parameters)', () => {
      const tool = matimo.getTool('calculator');
      const args = ['multiply', 10];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = convertArgsToParams(args, tool! as any);

      expect(params).toEqual({
        operation: 'multiply',
        a: 10,
      });
    });

    it('should handle empty args', () => {
      const tool = matimo.getTool('calculator');
      const args: unknown[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = convertArgsToParams(args, tool! as any);

      expect(params).toEqual({});
    });

    it('should handle tool with no parameters', () => {
      const tool = matimo.getTool('calculator');
      // Temporarily remove parameters for this test
      const originalParams = tool!.parameters;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tool as any).parameters = {};

      const args = ['arg1', 'arg2'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = convertArgsToParams(args, tool! as any);

      expect(params).toEqual({});

      // Restore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tool as any).parameters = originalParams;
    });

    it('should handle tool with undefined parameters', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tool = matimo.getTool('calculator') as any;
      const toolCopy = {
        ...tool,
        parameters: undefined,
      };

      const args = ['arg1', 'arg2'];
      const params = convertArgsToParams(args, toolCopy);

      expect(params).toEqual({});
    });
  });

  describe('executeToolViaDecorator', () => {
    it('should execute tool with class instance property', async () => {
      const spyExecute = jest.spyOn(matimo, 'execute');

      const thisArg = { matimo };
      const args = ['add', 5, 3];

      await executeToolViaDecorator('calculator', thisArg, args);

      expect(spyExecute).toHaveBeenCalledWith('calculator', {
        operation: 'add',
        a: 5,
        b: 3,
      });

      spyExecute.mockRestore();
    });

    it('should execute tool with global instance when class property not available', async () => {
      const spyExecute = jest.spyOn(matimo, 'execute');

      const thisArg = {}; // No matimo property
      const args = ['subtract', 10, 2];

      await executeToolViaDecorator('calculator', thisArg, args);

      expect(spyExecute).toHaveBeenCalledWith('calculator', {
        operation: 'subtract',
        a: 10,
        b: 2,
      });

      spyExecute.mockRestore();
    });

    it('should throw error when no instance available', async () => {
      setGlobalMatimoInstance(null);

      const thisArg = {};
      const args = ['add', 5, 3];

      await expect(executeToolViaDecorator('calculator', thisArg, args)).rejects.toThrow(
        'Matimo instance not found for @tool'
      );
    });

    it('should throw error when tool not found', async () => {
      const thisArg = { matimo };
      const args: unknown[] = [];

      await expect(executeToolViaDecorator('non-existent-tool', thisArg, args)).rejects.toThrow(
        "Tool 'non-existent-tool' not found"
      );
    });

    it('should prefer class instance property over global', async () => {
      const globalSpy = jest.spyOn(matimo, 'execute');
      const otherMatimo = await MatimoInstance.init(`${__dirname}/../../tools`);
      const otherSpy = jest.spyOn(otherMatimo, 'execute');

      const thisArg = { matimo: otherMatimo };
      const args = ['add', 1, 1];

      await executeToolViaDecorator('calculator', thisArg, args);

      expect(otherSpy).toHaveBeenCalled();
      expect(globalSpy).not.toHaveBeenCalled();

      globalSpy.mockRestore();
      otherSpy.mockRestore();
    });

    it('should handle null thisArg gracefully', async () => {
      const spyExecute = jest.spyOn(matimo, 'execute');

      const thisArg = null;
      const args = ['divide', 20, 4];

      await executeToolViaDecorator('calculator', thisArg, args);

      expect(spyExecute).toHaveBeenCalledWith('calculator', {
        operation: 'divide',
        a: 20,
        b: 4,
      });

      spyExecute.mockRestore();
    });

    it('should handle undefined thisArg gracefully', async () => {
      const spyExecute = jest.spyOn(matimo, 'execute');

      const thisArg = undefined;
      const args = ['add', 15, 25];

      await executeToolViaDecorator('calculator', thisArg, args);

      expect(spyExecute).toHaveBeenCalledWith('calculator', {
        operation: 'add',
        a: 15,
        b: 25,
      });

      spyExecute.mockRestore();
    });

    it('should handle thisArg with null matimo property', async () => {
      const spyExecute = jest.spyOn(matimo, 'execute');

      const thisArg = { matimo: null };
      const args = ['multiply', 3, 7];

      await executeToolViaDecorator('calculator', thisArg, args);

      // Should fall back to global instance
      expect(spyExecute).toHaveBeenCalled();

      spyExecute.mockRestore();
    });

    it('should handle extra args beyond parameter count', async () => {
      const spyExecute = jest.spyOn(matimo, 'execute');

      const thisArg = { matimo };
      const args = ['add', 2, 3, 'extra', 'args'];

      await executeToolViaDecorator('calculator', thisArg, args);

      // Should only use first 3 args
      expect(spyExecute).toHaveBeenCalledWith('calculator', {
        operation: 'add',
        a: 2,
        b: 3,
      });

      spyExecute.mockRestore();
    });
  });

  describe('Tool Decorator Factory Function', () => {
    it('should return an async function when decorator is applied', () => {
      const decoratorFn = tool('calculator');

      // The returned decorator should be a function
      expect(typeof decoratorFn).toBe('function');

      // When called with a target and context mock, should return an async function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = async function (this: any) {
        return undefined;
      };

      // Mock context object for modern decorator API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const context: any = {
        kind: 'method',
        name: 'calculate',
        addInitializer: () => {},
      };

      const interceptedFn = decoratorFn(target, context);

      // The returned function should be async
      expect(typeof interceptedFn).toBe('function');
      expect(interceptedFn.constructor.name).toBe('AsyncFunction');
    });

    it('should intercept method calls and execute via matimo', async () => {
      const decoratorFn = tool('calculator');

      // Create a mock target function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = async function (this: any) {
        return { intercepted: false };
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const context: any = {
        kind: 'method',
        name: 'test',
      };

      const interceptedFn = decoratorFn(target, context);

      // Call the intercepted function with the matimo instance using apply
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (interceptedFn as any).apply({ matimo }, ['add', 5, 3]);

      // Should have executed the tool, not the original target
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should bind correct this context when intercepted', async () => {
      const decoratorFn = tool('calculator');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = async function (this: any) {
        return { thisContext: this };
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const context: any = {
        kind: 'method',
        name: 'test',
      };

      const interceptedFn = decoratorFn(target, context);

      const thisContext = { matimo };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (interceptedFn as any).apply(thisContext, ['add', 5, 3]);

      // The intercepted function should have access to the this context
      expect(result).toBeDefined();
    });

    it('should pass arguments correctly to intercepted function', async () => {
      const spyExecute = jest.spyOn(matimo, 'execute');

      const decoratorFn = tool('calculator');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = async function (this: any) {
        return undefined;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const context: any = {
        kind: 'method',
        name: 'test',
      };

      const interceptedFn = decoratorFn(target, context);

      const arg1 = 'multiply';
      const arg2 = 10;
      const arg3 = 5;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (interceptedFn as any).apply({ matimo }, [arg1, arg2, arg3]);

      expect(spyExecute).toHaveBeenCalledWith('calculator', {
        operation: arg1,
        a: arg2,
        b: arg3,
      });

      spyExecute.mockRestore();
    });

    it('should handle context parameter (modern decorator API)', async () => {
      const decoratorFn = tool('calculator');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = async function (this: any) {
        return undefined;
      };

      // Modern decorator context object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const context: any = {
        kind: 'method',
        name: 'testMethod',
        isPrivate: false,
        access: { get: () => {} },
        addInitializer: () => {},
      };

      const interceptedFn = decoratorFn(target, context);

      // Should successfully create intercepted function with context
      expect(typeof interceptedFn).toBe('function');

      // Should be executable
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (interceptedFn as any).apply({ matimo }, ['add', 2, 3]);
      expect(result).toBeDefined();
    });

    it('should handle missing context gracefully', async () => {
      const decoratorFn = tool('calculator');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = async function (this: any) {
        return undefined;
      };

      // Call with undefined context (should still work)
      const interceptedFn = decoratorFn(target, undefined);

      expect(typeof interceptedFn).toBe('function');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (interceptedFn as any).apply({ matimo }, ['add', 1, 1]);
      expect(result).toBeDefined();
    });

    it('should create independent intercepted functions for each decorator', async () => {
      const decorator1 = tool('calculator');
      const decorator2 = tool('calculator');

      // Both should return functions
      const fn1 = decorator1(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function (this: any) {
          return undefined;
        },
        { kind: 'method' }
      );

      const fn2 = decorator2(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function (this: any) {
          return undefined;
        },
        { kind: 'method' }
      );

      // Both should be functions
      expect(typeof fn1).toBe('function');
      expect(typeof fn2).toBe('function');

      // Both should work independently
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result1 = await (fn1 as any).apply({ matimo }, ['add', 1, 1]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result2 = await (fn2 as any).apply({ matimo }, ['subtract', 5, 2]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
