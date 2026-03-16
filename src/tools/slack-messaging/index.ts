/**
 * Slack Messaging Tool
 * Allows the agent to post messages securely to a Slack workspace.
 */

export interface SlackMessagingArgs {
  channel: string;
  message: string;
}

export interface SlackMessagingResult {
  success: boolean;
  timestamp?: string;
  error?: string;
}

export async function run(args: SlackMessagingArgs): Promise<SlackMessagingResult> {
  const token = process.env.SLACK_BOT_TOKEN;

  if (!token) {
    throw new Error("Missing SLACK_BOT_TOKEN in environment variables.");
  }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        channel: args.channel,
        text: args.message
      })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    if (!data.ok) {
      return {
        success: false,
        error: typeof data.error === 'string' ? data.error : "Unknown Slack API error"
      };
    }

    return {
      success: true,
      timestamp: typeof data.ts === 'string' ? data.ts : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

export default run;
