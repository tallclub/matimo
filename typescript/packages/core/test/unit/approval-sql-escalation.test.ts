import { ApprovalHandler } from '../../src/approval/approval-handler';

describe('ApprovalHandler SQL escalation paths', () => {
  const handler = new ApprovalHandler();

  it.each([
    "COPY (SELECT 1) TO PROGRAM 'id'",
    'COPY users FROM STDIN',
    "SELECT pg_read_file('/etc/passwd')",
    "SELECT pg_ls_dir('/')",
    "SELECT lo_import('/etc/passwd')",
    "SELECT lo_export(1234, '/tmp/x')",
    "SELECT * FROM dblink('host=evil', 'select 1') AS t(x int)",
    "SELECT set_config('role', 'postgres', false)",
    'SELECT pg_terminate_backend(42)',
    "DO $$ BEGIN PERFORM 1; END $$",
    "do language plpgsql 'begin end'",
    'CALL cleanup()',
    'VACUUM FULL',
    'REINDEX TABLE t',
  ])('asks for approval: %s', (sql) => {
    expect(handler.requiresApproval(undefined, sql)).toBe(true);
  });

  it.each(['SELECT 1', 'SELECT id, name FROM users WHERE id = $1', 'SELECT count(*) FROM orders'])(
    'leaves plain reads alone: %s',
    (sql) => {
      expect(handler.requiresApproval(undefined, sql)).toBe(false);
    }
  );
});
