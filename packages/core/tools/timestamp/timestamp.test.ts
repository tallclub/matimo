import { execSync } from 'child_process';
import path from 'path';

describe('Timestamp Tool', () => {
  it('should return a valid JSON with a timestamp', () => {
    // This finds the path to your timestamp.ts file
    const filePath = path.resolve(__dirname, 'timestamp.ts');
    
    // This executes it using ts-node (which Jest/Matimo uses)
    const output = execSync(`pnpm ts-node ${filePath}`).toString();
    
    // This parses the console.log output
    const result = JSON.parse(output);

    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('string');
    // Verifies it's a valid date
    expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
  });
});