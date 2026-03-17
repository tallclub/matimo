// Define the structure of the output
interface TimestampResult {
  timestamp: string;
}

// Create the result with a real ISO date
const result: TimestampResult = {
  timestamp: new Date().toISOString(),
};

// Log it as a string so the tool-runner can read it
console.log(JSON.stringify(result));