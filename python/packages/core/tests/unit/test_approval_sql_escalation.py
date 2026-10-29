"""SQL statements/functions that escape plain row access must ask for approval."""
from __future__ import annotations

import pytest

from matimo.approval.handler import ApprovalHandler


@pytest.mark.parametrize(
    "sql",
    [
        "COPY (SELECT 1) TO PROGRAM 'id'",
        "COPY users FROM STDIN",
        "SELECT pg_read_file('/etc/passwd')",
        "SELECT pg_ls_dir('/')",
        "SELECT lo_import('/etc/passwd')",
        "SELECT lo_export(1234, '/tmp/x')",
        "SELECT * FROM dblink('host=evil', 'select 1') AS t(x int)",
        "SELECT set_config('role', 'postgres', false)",
        "SELECT pg_terminate_backend(42)",
        "DO $$ BEGIN PERFORM 1; END $$",
        "do language plpgsql 'begin end'",
        "CALL cleanup()",
        "VACUUM FULL",
        "REINDEX TABLE t",
    ],
)
def test_escalation_paths_ask_for_approval(sql: str) -> None:
    assert ApprovalHandler().requires_approval(None, sql) is True


@pytest.mark.parametrize(
    "sql",
    ["SELECT 1", "SELECT id, name FROM users WHERE id = $1", "SELECT count(*) FROM orders"],
)
def test_plain_reads_are_left_alone(sql: str) -> None:
    assert ApprovalHandler().requires_approval(None, sql) is False
