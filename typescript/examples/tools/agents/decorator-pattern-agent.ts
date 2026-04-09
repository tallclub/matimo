#!/usr/bin/env node
/**
 * Matimo Decorator Pattern - True AI Agent with TypeScript @tool Decorators
 *
 * The agent receives a prompt, uses OpenAI to decide which tool to use,
 * then executes that tool via Matimo using real TypeScript @tool decorators.
 *
 * Run: npm run agent:decorator
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Decorator Pattern Agent - Uses @tool decorators for automatic execution
 */
class DecoratorPatternAgent {
  private llm: ChatOpenAI;

  constructor(
    private matimo: MatimoInstance,
    llm: ChatOpenAI
  ) {
    this.llm = llm;
  }

  /**
   * Calculator tool - automatically executes via @tool decorator
   * Parameters map to tool parameters in order: operation, a, b
   */
  @tool('calculator')
  async calculate(operation: string, a: number, b: number): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('calculator', { operation, a, b })
    // Method body is not executed - decorator intercepts the call
    return undefined;
  }

  /**
   * Echo tool - automatically executes via @tool decorator
   * Parameters map to tool parameter: message
   */
  @tool('echo-tool')
  async echo(message: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('echo-tool', { message })
    return undefined;
  }

  /**
   * HTTP client tool - automatically executes via @tool decorator
   * Parameters map to tool parameters: method, url
   */
  @tool('http-client')
  async fetch(method: string, url: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('http-client', { method, url })
    return undefined;
  }

  /**
   * Generate OpenAI function schemas from Matimo tool definitions
   * Single source of truth - schemas come from tool YAML, not duplicated here
   */
  private getToolSchemas() {
    return this.matimo.listTools().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.entries(tool.parameters || {}).reduce(
            (acc, [paramName, param]) => ({
              ...acc,
              [paramName]: {
                type: param.type,
                enum: param.enum,
                description: param.description,
              },
            }),
            {}
          ),
          required: Object.entries(tool.parameters || {})
            .filter(([_, param]) => param.required)
            .map(([paramName]) => paramName),
        },
      },
    }));
  }

  /**
   * Process a prompt - AI decides which tool to call
   */
  async process(prompt: string): Promise<void> {
    console.info(`\n❓ Prompt: "${prompt}"`);

    try {
      // Prepare system message for tool calling
      const systemMessage = `You are an AI assistant with access to tools. 
Based on the user's request, decide which tool to use and extract the EXACT required parameters.
IMPORTANT: Use exact parameter names and enum values as specified.
Respond ONLY with valid JSON in this format: {"tool": "<tool_name>", "parameters": {<exact_params>}}`;

      // Get tool schemas dynamically from Matimo
      const toolSchemas = this.getToolSchemas();

      // Build detailed tool specifications for the prompt
      const toolSpecifications = toolSchemas
        .map((t) => {
          const paramSpecs = Object.entries(t.function.parameters.properties)
            .map(([paramName, prop]: [string, any]) => {
              let spec = `${paramName} (${prop.type})`;
              if (prop.enum) {
                spec += ` - valid values: [${prop.enum.join(', ')}]`;
              }
              spec += ` - ${prop.description}`;
              return spec;
            })
            .join('; ');
          return `${t.function.name}: ${t.function.description}\n    Parameters: ${paramSpecs}`;
        })
        .join('\n\n');

      // Create a message with proper formatting for function calling
      const messages = [
        {
          type: 'system',
          content: systemMessage,
        },
        {
          type: 'human',
          content: `User request: "${prompt}"\n\nAvailable tools:\n${toolSpecifications}`,
        },
      ];

      // Call LLM with tool definitions
      const response = await this.llm.invoke(messages as any);

      // Parse the LLM response
      let toolName: string | null = null;
      let toolParams: Record<string, unknown> | null = null;

      // Try to extract tool call from response
      const content = response.content;

      if (typeof content === 'string') {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(content);
          toolName = parsed.tool || parsed.function?.name;
          toolParams = parsed.parameters || parsed.function?.parameters || parsed;
        } catch {
          // If not JSON, try to extract from text
          const jsonMatch = content.match(/\{[^{}]*"tool"[^{}]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              toolName = parsed.tool;
              toolParams = parsed.parameters;
            } catch {
              // Continue without params
            }
          }
        }
      }

      // If we found a tool, execute it via decorated method
      if (toolName && toolParams) {
        await this.executeTool(toolName, toolParams);
      } else {
        console.info(`\n⚠️  No tool call detected in response`);
        console.info(
          `Response: ${typeof content === 'string' ? content.substring(0, 200) : content}`
        );
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Map of tool names to their decorated methods
   * Built at runtime to discover which tools this agent supports
   */
  private getToolMethodMap(): Map<string, string> {
    const toolMap = new Map<string, string>();

    // Get all methods decorated with @tool
    // The decorator stores tool name in a metadata property
    for (const [methodName, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this))
    )) {
      if (typeof descriptor.value === 'function') {
        // Check if method has tool metadata (added by decorator)
        const method = descriptor.value as any;
        if (method.__toolName) {
          toolMap.set(method.__toolName, methodName);
        }
      }
    }

    // Manual mapping as fallback (decorators should set __toolName)
    // This ensures we catch all @tool decorated methods
    toolMap.set('calculator', 'calculate');
    toolMap.set('echo-tool', 'echo');
    toolMap.set('http-client', 'fetch');

    return toolMap;
  }

  /**
   * Execute a tool via decorated method
   * Uses reflection to dynamically call the appropriate decorated method
   * This keeps decorators as the source of truth for agent API
   */
  private async executeTool(toolName: string, params: Record<string, unknown>): Promise<void> {
    try {
      // Normalize parameters based on tool
      let normalizedParams = params;

      // Calculator: Handle "operands" array format by converting to a, b
      if (toolName === 'calculator' && params.operands && Array.isArray(params.operands)) {
        const [a, b] = params.operands as number[];
        normalizedParams = {
          operation: params.operation,
          a,
          b,
        };
      }

      console.info(`\n🔧 Using tool: ${toolName}`);
      console.info(`   Parameters: ${JSON.stringify(normalizedParams)}`);

      // Find the decorated method for this tool
      const toolMethodMap = this.getToolMethodMap();
      const methodName = toolMethodMap.get(toolName);

      if (!methodName) {
        console.info(`\n❌ Tool '${toolName}' not in agent's API`);
        console.info(`Available tools: ${Array.from(toolMethodMap.keys()).join(', ')}`);
        return;
      }

      // Dynamically call the decorated method
      // The decorator intercepts the call and executes the tool
      const method = (this as any)[methodName];
      if (typeof method !== 'function') {
        console.info(`\n❌ Method '${methodName}' for tool '${toolName}' not found`);
        return;
      }

      // Convert params object to positional args matching method signature
      const args = this.getMethodArgsFromParams(toolName, normalizedParams);
      const result = await method.apply(this, args);

      // Format result
      if (typeof result === 'object' && result !== null) {
        const resultData = result as any;
        if (resultData.stdout) {
          try {
            const parsed = JSON.parse(resultData.stdout);
            console.info(`\n✅ Result:`, parsed);
          } catch {
            console.info(`\n✅ Result:`, resultData.stdout);
          }
        } else if (resultData.data) {
          // HTTP response
          console.info(
            `\n✅ Result (HTTP ${resultData.statusCode}):`,
            typeof resultData.data === 'string'
              ? resultData.data.substring(0, 200)
              : JSON.stringify(resultData.data).substring(0, 200)
          );
        } else {
          console.info(`\n✅ Result:`, result);
        }
      }
    } catch (error) {
      console.error(`\n❌ Tool Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert parameter object to positional arguments for method call
   * Maps normalized params to the decorated method's parameter order
   */
  private getMethodArgsFromParams(toolName: string, params: Record<string, unknown>): unknown[] {
    switch (toolName) {
      case 'calculator':
        return [params.operation, params.a, params.b];
      case 'echo-tool':
        return [params.message];
      case 'http-client':
        return [params.method, params.url];
      default:
        return [];
    }
  }
}

/**
 * Run decorator pattern agent with prompts
 */
async function runDecoratorPatternAgent() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Matimo Decorator Pattern - True AI Agent             ║');
  console.info('║   (AI decides which tool to use based on prompt)       ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: OPENAI_API_KEY not set in .env');
      process.exit(1);
    }

    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    // Set global Matimo instance for @tool decorators
    setGlobalMatimoInstance(matimo);

    const matimoTools = matimo.listTools();
    console.info(`📦 Loaded ${matimoTools.length} tools:\n`);
    matimoTools.forEach((t) => {
      console.info(`  • ${t.name}`);
      console.info(`    ${t.description}\n`);
    });

    // Initialize OpenAI LLM
    console.info('🤖 Initializing OpenAI LLM (gpt-3.5-turbo)...\n');
    const llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: apiKey,
    });

    // Create agent
    const agent = new DecoratorPatternAgent(matimo, llm);

    // Test prompts - each should trigger a different tool
    const prompts = [
      '🧮 What is 42 plus 8?',
      '🔊 Echo the message: "Decorator pattern is elegant and powerful!"',
      '🌐 Fetch the GitHub user profile for octocat using HTTP GET',
    ];

    console.info('🧪 Testing AI Agent with 3 Different Prompts');
    console.info('═'.repeat(60));

    for (const prompt of prompts) {
      await agent.process(prompt);
      console.info('\n' + '─'.repeat(60));
    }

    console.info('\n✅ Decorator pattern AI agent test complete!\n');
  } catch (error) {
    console.error('❌ Agent failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the agent
runDecoratorPatternAgent().catch(console.error);
