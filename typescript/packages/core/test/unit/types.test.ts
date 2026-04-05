import { Parameter, AuthConfig, HttpExecution, CommandExecution } from '../../src/core/types';

describe('Core Types', () => {
  it('should have Parameter type defined', () => {
    const param: Parameter = {
      type: 'string',
      description: 'Test parameter',
      required: true,
    };
    expect(param).toBeDefined();
    expect(param.type).toBe('string');
  });

  it('should have AuthConfig type defined', () => {
    const auth: AuthConfig = {
      type: 'api_key',
      location: 'header',
      name: 'Authorization',
    };
    expect(auth).toBeDefined();
    expect(auth.type).toBe('api_key');
  });

  it('should have HttpExecution type defined', () => {
    const http: HttpExecution = {
      type: 'http',
      method: 'GET',
      url: 'https://api.example.com/test',
    };
    expect(http).toBeDefined();
    expect(http.type).toBe('http');
  });

  it('should have CommandExecution type defined', () => {
    const cmd: CommandExecution = {
      type: 'command',
      command: 'echo',
      args: ['hello'],
    };
    expect(cmd).toBeDefined();
    expect(cmd.type).toBe('command');
  });
});
