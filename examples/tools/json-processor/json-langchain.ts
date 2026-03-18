import { ChatOpenAI } from '@langchain/openai';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { jsonProcessor } from '../../../packages/core/tools/json-processor/jsonProcessor';

async function main() {
  const model = new ChatOpenAI({
    temperature: 0,
  });

  const tools = [
    {
      name: 'json_processor',
      description: 'Process JSON and extract values',
      func: jsonProcessor,
    },
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: 'zero-shot-react-description',
  });

  const result = await executor.call({
    input: 'Extract the name from {"user": {"name": "Alice"}}',
  });

  console.log(result);
}

main();