import { run } from "../src/tools/slack-messaging/index";

async function testSlackTool() {
  // Mocking the environment variable purely for the example execution
  process.env.SLACK_BOT_TOKEN = "xoxb-your-mock-token";

  console.log("Testing Slack Messaging Tool...");
  
  try {
    const result = await run({
      channel: "#agent-updates",
      message: "Hello team! I just completed my data processing run safely. 🚀"
    });

    if (result.success) {
      console.log(`✅ Message sent successfully at timestamp: ${result.timestamp}`);
    } else {
      console.error(`❌ Failed to send message: ${result.error}`);
    }
  } catch (error) {
    console.error("Crash during tool execution:", error);
  }
}

testSlackTool();
