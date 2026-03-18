export default async function run(params: any) {
  const { issueIdOrKey, transitionId } = params;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const domain = process.env.JIRA_DOMAIN;

  if (!email || !apiToken || !domain) {
    throw new Error("Missing Jira credentials (JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN)");
  }

  const response = await fetch(`https://${domain}/rest/api/3/issue/${issueIdOrKey}/transitions`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transition: { id: transitionId }
    })
  });

  if (!response.ok) {
    if (response.status === 204) return { success: true };
    try {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.errors || errorData.errorMessages || response.statusText
      };
    } catch {
      return {
        success: false,
        error: response.statusText
      };
    }
  }

  return { success: true };
}
