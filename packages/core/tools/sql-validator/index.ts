export function sqlValidator(inputs: any) {
  const { query } = inputs;

  if (!query) {
    throw new Error("SQL query is required");
  }

  const lowerQuery = query.toLowerCase().trim();

  let warnings: { message: string; severity: "INFO" | "WARNING" | "ERROR" }[] = [];
  let optimizedQuery = query;

  let type = "UNKNOWN";
  let isValid = true;

  // 🔹 STEP 1: Detect Query Type
  if (lowerQuery.startsWith("select")) type = "SELECT";
  else if (lowerQuery.startsWith("update")) type = "UPDATE";
  else if (lowerQuery.startsWith("delete")) type = "DELETE";
  else {
    warnings.push({
      message: "Unsupported or unknown SQL operation",
      severity: "ERROR"
    });
    isValid = false;
  }

  // 🔹 STEP 2: Basic Syntax Validation
  if (type === "SELECT" && !lowerQuery.includes("from")) {
    warnings.push({
      message: "Invalid SQL: missing FROM clause",
      severity: "ERROR"
    });
    isValid = false;
  }

  // 🔹 Rule 1: SELECT *
  if (lowerQuery.includes("select *")) {
    warnings.push({
      message: "Avoid using SELECT * (performance issue)",
      severity: "WARNING"
    });

    // safer replacement (only first occurrence)
    optimizedQuery = optimizedQuery.replace(/\*/, "<specify_columns>");
  }

  // 🔹 Rule 2: Missing WHERE (only for SELECT)
  if (type === "SELECT" && !lowerQuery.includes("where")) {
    warnings.push({
      message: "No WHERE clause (full table scan)",
      severity: "WARNING"
    });
  }

  // 🔹 Rule 3: DELETE without WHERE
  if (type === "DELETE" && !lowerQuery.includes("where")) {
    warnings.push({
      message: "DELETE without WHERE will remove all records",
      severity: "ERROR"
    });
    isValid = false;
  }

  // 🔹 Rule 4: UPDATE without WHERE
  if (type === "UPDATE" && !lowerQuery.includes("where")) {
    warnings.push({
      message: "UPDATE without WHERE will affect all rows",
      severity: "ERROR"
    });
    isValid = false;
  }

  // 🔹 Rule 5: Too many JOINs
  const joinCount = (lowerQuery.match(/join/g) || []).length;
  if (joinCount > 2) {
    warnings.push({
      message: "Too many JOINs may impact performance",
      severity: "WARNING"
    });
  }

  // 🔹 Rule 6: Add LIMIT (only if valid SELECT)
  if (type === "SELECT" && isValid && !lowerQuery.includes("limit")) {
    optimizedQuery = optimizedQuery.replace(/;?$/, " LIMIT 100;");
  }

  // 🔹 Final message if no issues
  if (warnings.length === 0) {
    warnings.push({
      message: "Query looks good",
      severity: "INFO"
    });
  }

  // 🔹 Final Output
  return {
    valid: isValid,
    type,
    warnings,
    optimized_query: optimizedQuery
  };
}