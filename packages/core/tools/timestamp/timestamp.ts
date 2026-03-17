interface TimestampResult {
  timestamp: string;
}

const result: TimestampResult = {
  timestamp: new Date().toISOString(),
};

console.log(JSON.stringify(result));