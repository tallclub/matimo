export default async function sqlValidator(input: { query: string }) {
  const query = input.query.trim().toLowerCase();

  let issues: string[] = [];
  let suggestions: string[] = [];

  // 1. Check if query is empty
  if (!query) {
    return {
      valid: false,
      issues: ["Query is empty"],
      suggestions: []
    };
  }

  // 2. Check valid starting keyword
  const validStart = ["select", "insert", "update", "delete"];
  const startsValid = validStart.some(cmd => query.startsWith(cmd));

  if (!startsValid) {
    issues.push("Query does not start with a valid SQL command");
  }

  // 3. Detect SELECT *
  if (query.includes("select *")) {
    suggestions.push("Avoid using SELECT *. Specify only required columns.");
  }

  // 4. Dangerous DELETE/UPDATE without WHERE
  if (
    (query.startsWith("delete") || query.startsWith("update")) &&
    !query.includes("where")
  ) {
    issues.push("Missing WHERE clause in DELETE/UPDATE");
  }

  // 5. Suggest LIMIT
  if (query.startsWith("select") && !query.includes("limit")) {
    suggestions.push("Consider adding LIMIT to restrict results.");
  }

  return {
    valid: issues.length === 0,
    issues,
    suggestions
  };
}