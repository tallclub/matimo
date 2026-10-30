const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockQuery = jest.fn().mockResolvedValue({ rows: [{ one: 1 }], rowCount: 1 });
const mockEnd = jest.fn().mockResolvedValue(undefined);
const MockClient = jest.fn().mockImplementation(() => ({
  connect: mockConnect,
  query: mockQuery,
  end: mockEnd,
}));
jest.mock('pg', () => ({ Client: MockClient }));

import executeSql from '../../tools/execute-sql/execute-sql';

describe('postgres execute-sql runtime', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MATIMO_POSTGRES_URL = 'postgresql://u:p@db.example.com:5432/app';
    delete process.env.MATIMO_POSTGRES_SSL;
  });

  afterAll(() => {
    process.env = saved;
  });

  it('does not force TLS options when MATIMO_POSTGRES_SSL is unset', async () => {
    await executeSql({ sql: 'SELECT 1' });
    expect(MockClient).toHaveBeenCalledWith({
      connectionString: 'postgresql://u:p@db.example.com:5432/app',
    });
  });

  it.each([
    ['disable', undefined],
    ['require', { rejectUnauthorized: false }],
    ['verify-ca', true],
    ['verify-full', true],
    ['VERIFY-FULL', true],
  ])('maps MATIMO_POSTGRES_SSL=%s', async (mode, expected) => {
    process.env.MATIMO_POSTGRES_SSL = mode;
    await executeSql({ sql: 'SELECT 1' });
    const config = MockClient.mock.calls[0][0];
    if (expected === undefined) expect(config).not.toHaveProperty('ssl');
    else expect(config.ssl).toEqual(expected);
  });

  it('rejects an unknown SSL mode instead of silently connecting unencrypted', async () => {
    process.env.MATIMO_POSTGRES_SSL = 'sometimes';
    await expect(executeSql({ sql: 'SELECT 1' })).rejects.toThrow('Invalid MATIMO_POSTGRES_SSL');
    expect(MockClient).not.toHaveBeenCalled();
  });

  it('passes values as bound parameters', async () => {
    await executeSql({ sql: 'SELECT * FROM t WHERE id = $1', params: [7] });
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM t WHERE id = $1', [7]);
  });
});
