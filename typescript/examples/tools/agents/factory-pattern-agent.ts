#!/usr/bin/env node
/**
 * Matimo Factory Pattern - True AI Agent with Tool Decision Making
 *
 * The agent receives a prompt, uses OpenAI to decide which tool to use,
 * then executes that tool via Matimo.
 *
 * Run: npm run agent:factory
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Factory Pattern Agent - Uses AI to decide which tool to call
 */
class FactoryPatternAgent {
  private matimo: MatimoInstance;
  private llm: ChatOpenAI;

  constructor(matimo: MatimoInstance, llm: ChatOpenAI) {
    this.matimo = matimo;
    this.llm = llm;
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
   * Process a prompt - AI decides which tool to use
   */
  async process(prompt: string): Promise<void> {
    console.log(`\n❓ Prompt: "${prompt}"`);

    try {
      // Prepare system message for tool calling
      const systemMessage = `You are an AI assistant with access to tools. 
Based on the user's request, decide which tool to use and extract the required parameters.
Extract the tool name and parameters, then respond with JSON.`;

      // Get tool schemas dynamically from Matimo
      const toolSchemas = this.getToolSchemas();

      // Create a message with proper formatting for function calling
      const messages = [
        {
          type: 'system',
          content: systemMessage,
        },
        {
          type: 'human',
          content: `User request: ${prompt}\n\nAvailable tools: ${toolSchemas.map((t) => `${t.function.name}: ${t.function.description}`).join(', ')}\n\nRespond with JSON: {"tool": "<tool_name>", "parameters": {...}}`,
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

      // If we found a tool, execute it
      if (toolName && toolParams) {
        await this.executeTool(toolName, toolParams);
      } else {
        console.log(`\n⚠️  No tool call detected in response`);
        console.log(
          `Response: ${typeof content === 'string' ? content.substring(0, 200) : content}`
        );
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a tool via Matimo
   * Normalize parameters to match tool schema expectations
   */
  private async executeTool(toolName: string, params: Record<string, unknown>): Promise<void> {
    try {
      const tool = this.matimo.getTool(toolName);
      if (!tool) {
        console.log(`\n❌ Tool '${toolName}' not found`);
        return;
      }

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

      console.log(`\n🔧 Using tool: ${toolName}`);
      console.log(`   Parameters: ${JSON.stringify(normalizedParams)}`);

      const result = await this.matimo.execute(toolName, normalizedParams);

      // Format result
      if (typeof result === 'object' && result !== null) {
        const resultData = result as any;
        if (resultData.stdout) {
          try {
            const parsed = JSON.parse(resultData.stdout);
            console.log(`\n✅ Result:`, parsed);
          } catch {
            console.log(`\n✅ Result:`, resultData.stdout);
          }
        } else if (resultData.data) {
          // HTTP response
          console.log(
            `\n✅ Result (HTTP ${resultData.statusCode}):`,
            typeof resultData.data === 'string'
              ? resultData.data.substring(0, 200)
              : JSON.stringify(resultData.data).substring(0, 200)
          );
        } else {
          console.log(`\n✅ Result:`, result);
        }
      }
    } catch (error) {
      console.error(`\n❌ Tool Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Run factory pattern agent with prompts
 */
async function runFactoryPatternAgent() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Matimo Factory Pattern - True AI Agent               ║');
  console.log('║   (AI decides which tool to use based on prompt)       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: OPENAI_API_KEY not set in .env');
      process.exit(1);
    }

    // Initialize Matimo
    console.log('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });

    const matimoTools = matimo.listTools();
    console.log(`📦 Loaded ${matimoTools.length} tools:\n`);
    matimoTools.forEach((t) => {
      console.log(`  • ${t.name}`);
      console.log(`    ${t.description}\n`);
    });

    // Initialize OpenAI LLM
    console.log('🤖 Initializing OpenAI LLM (gpt-3.5-turbo)...\n');
    const llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: apiKey,
    });

    // Create agent
    const agent = new FactoryPatternAgent(matimo, llm);

    // Test prompts - each should trigger a different tool
    const prompts = [
      '🧮 What is 42 plus 8?',
      '🔊 Echo the message: "Factory pattern works perfectly!"',
      '🌐 Fetch the GitHub user profile for octocat using HTTP GET',
    ];

    console.log('🧪 Testing AI Agent with 3 Different Prompts');
    console.log('═'.repeat(60));

    for (const prompt of prompts) {
      await agent.process(prompt);
      console.log('\n' + '─'.repeat(60));
    }

    console.log('\n✅ Factory pattern AI agent test complete!\n');
  } catch (error) {
    console.error('❌ Agent failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the agent
runFactoryPatternAgent().catch(console.error);
