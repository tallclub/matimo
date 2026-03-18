export default async function run(params: any) {
  const { projectKey, summary, description, issueType } = params;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const domain = process.env.JIRA_DOMAIN;

  if (!email || !apiToken || !domain) {
    throw new Error("Missing Jira credentials (JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN)");
  }

  const response = await fetch(`https://${domain}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary,
        description: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }]
        },
        issuetype: { name: issueType }
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    return {
      success: false,
      error: errorData.errors || errorData.errorMessages || response.statusText
    };
  }

  return await response.json();
}
