export default async function run(params: any) {
  const { cardJson } = params;
  const webhookUrl = process.env.MSTEAMS_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("Missing MSTEAMS_WEBHOOK_URL in environment variables.");
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: cardJson
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: errorText || response.statusText
    };
  }

  return { success: true };
}
