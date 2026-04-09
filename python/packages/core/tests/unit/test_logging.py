"""Unit tests for logging/__init__.py."""
from __future__ import annotations

import logging

import pytest

from matimo.logging import (
    MatimoLogger,
    _JsonFormatter,
    get_global_matimo_logger,
    set_global_matimo_logger,
    setup_logger,
)


class TestMatimoLogger:
    def _make_logger(self, level: str = "debug") -> tuple[MatimoLogger, list[str]]:
        """Create a logger that captures messages."""
        stdlib_logger = logging.getLogger(f"test_{level}_{id(self)}")
        stdlib_logger.setLevel(logging.DEBUG)
        handler = logging.handlers.MemoryHandler(capacity=1000)
        stdlib_logger.addHandler(handler)
        return MatimoLogger(stdlib_logger), []

    def test_debug_does_not_raise(self) -> None:
        stdlib_logger = logging.getLogger("test_debug_level")
        stdlib_logger.setLevel(logging.DEBUG)
        ml = MatimoLogger(stdlib_logger)
        ml.debug("debug message")

    def test_info_does_not_raise(self) -> None:
        stdlib_logger = logging.getLogger("test_info_level")
        stdlib_logger.setLevel(logging.INFO)
        ml = MatimoLogger(stdlib_logger)
        ml.info("info message")

    def test_warn_does_not_raise(self) -> None:
        stdlib_logger = logging.getLogger("test_warn_level")
        ml = MatimoLogger(stdlib_logger)
        ml.warn("warning message")

    def test_error_does_not_raise(self) -> None:
        stdlib_logger = logging.getLogger("test_error_level")
        ml = MatimoLogger(stdlib_logger)
        ml.error("error message")

    def test_is_silent_when_level_high(self) -> None:
        stdlib_logger = logging.getLogger("test_silent")
        stdlib_logger.setLevel(logging.CRITICAL + 10)
        ml = MatimoLogger(stdlib_logger)
        assert ml.is_silent() is True

    def test_is_not_silent_when_debug(self) -> None:
        stdlib_logger = logging.getLogger("test_not_silent")
        stdlib_logger.setLevel(logging.DEBUG)
        ml = MatimoLogger(stdlib_logger)
        assert ml.is_silent() is False

    def test_level_property_returns_level(self) -> None:
        stdlib_logger = logging.getLogger("test_level_prop")
        stdlib_logger.setLevel(logging.WARNING)
        ml = MatimoLogger(stdlib_logger)
        assert ml.level == logging.WARNING

    def test_debug_with_meta(self) -> None:
        stdlib_logger = logging.getLogger("test_meta")
        stdlib_logger.setLevel(logging.DEBUG)
        ml = MatimoLogger(stdlib_logger)
        ml.debug("message with meta", key="value", count=42)

    def test_info_with_meta(self) -> None:
        stdlib_logger = logging.getLogger("test_info_meta")
        stdlib_logger.setLevel(logging.DEBUG)
        ml = MatimoLogger(stdlib_logger)
        ml.info("info with meta", tool="my_tool")


class TestSetupLogger:
    def test_returns_matimo_logger(self) -> None:
        log = setup_logger("info")
        assert isinstance(log, MatimoLogger)

    def test_debug_level(self) -> None:
        log = setup_logger("debug")
        assert log.level == logging.DEBUG

    def test_error_level(self) -> None:
        log = setup_logger("error")
        assert log.level == logging.ERROR

    def test_warn_level(self) -> None:
        log = setup_logger("warn")
        assert log.level == logging.WARNING

    def test_silent_level(self) -> None:
        log = setup_logger("silent")
        assert log.is_silent() is True

    def test_env_var_overrides_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MATIMO_LOG_LEVEL", "debug")
        # Temporarily use a fresh logger name to bypass handler check
        import matimo.logging as mlog
        original = mlog._global_logger
        try:
            log = setup_logger()
            assert log.level == logging.DEBUG
        finally:
            mlog._global_logger = original

    def test_json_format(self) -> None:
        # Remove any existing handlers to allow fresh setup
        stdlib_logger = logging.getLogger("matimo")
        for h in list(stdlib_logger.handlers):
            stdlib_logger.removeHandler(h)
        log = setup_logger("info", log_format="json")
        assert isinstance(log, MatimoLogger)
        # Restore
        for h in list(stdlib_logger.handlers):
            stdlib_logger.removeHandler(h)

    def test_simple_format_default(self) -> None:
        log = setup_logger("info", log_format="simple")
        assert isinstance(log, MatimoLogger)

    def test_unknown_level_defaults_to_info(self) -> None:
        log = setup_logger("unknownlevel")
        # Should not raise, defaults to INFO
        assert isinstance(log, MatimoLogger)

    def test_setup_logger_reconfigures_handlers_on_second_call(self) -> None:
        # Clean up existing matimo logger
        stdlib_logger = logging.getLogger("matimo")
        for h in list(stdlib_logger.handlers):
            stdlib_logger.removeHandler(h)

        # First call: set to INFO, simple format
        log1 = setup_logger("info", log_format="simple")
        assert log1.level == logging.INFO
        handler1 = stdlib_logger.handlers[0]
        assert isinstance(handler1.formatter, logging.Formatter)
        assert not isinstance(handler1.formatter, _JsonFormatter)

        # Second call: change to DEBUG, JSON format
        log2 = setup_logger("debug", log_format="json")
        assert log2.level == logging.DEBUG
        # Should still have only 1 handler (reconfigured, not added)
        assert len(stdlib_logger.handlers) == 1
        handler2 = stdlib_logger.handlers[0]
        assert isinstance(handler2.formatter, _JsonFormatter)
        assert handler2.level == logging.DEBUG

    def test_setup_logger_updates_handler_level_on_reconfigure(self) -> None:
        stdlib_logger = logging.getLogger("matimo")
        for h in list(stdlib_logger.handlers):
            stdlib_logger.removeHandler(h)

        # First call: ERROR level
        log1 = setup_logger("error")
        assert log1.level == logging.ERROR
        handler1 = stdlib_logger.handlers[0]
        assert handler1.level == logging.ERROR

        # Second call: INFO level
        log2 = setup_logger("info")
        assert log2.level == logging.INFO
        handler2 = stdlib_logger.handlers[0]
        # Handler should have updated level
        assert handler2.level == logging.INFO


class TestGlobalMatimoLogger:
    def setup_method(self) -> None:
        import matimo.logging as mlog
        mlog._global_logger = None

    def test_get_global_initializes_if_none(self) -> None:
        import matimo.logging as mlog
        mlog._global_logger = None
        log = get_global_matimo_logger()
        assert isinstance(log, MatimoLogger)

    def test_get_global_returns_same_instance(self) -> None:
        log1 = get_global_matimo_logger()
        log2 = get_global_matimo_logger()
        assert log1 is log2

    def test_set_global_replaces_instance(self) -> None:
        new_logger = MatimoLogger(logging.getLogger("replacement"))
        set_global_matimo_logger(new_logger)
        assert get_global_matimo_logger() is new_logger


class TestJsonFormatter:
    def _make_record(
        self,
        level: int = logging.INFO,
        message: str = "test message",
        exc_info: object = None,
    ) -> logging.LogRecord:
        record = logging.LogRecord(
            name="matimo",
            level=level,
            pathname="",
            lineno=0,
            msg=message,
            args=None,
            exc_info=exc_info,
        )
        return record

    def test_format_returns_json_string(self) -> None:
        import json
        formatter = _JsonFormatter()
        record = self._make_record()
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["message"] == "test message"
        assert "timestamp" in parsed
        assert "level" in parsed
        assert "logger" in parsed

    def test_level_is_lowercase(self) -> None:
        import json
        formatter = _JsonFormatter()
        record = self._make_record(level=logging.ERROR)
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["level"] == "error"

    def test_meta_included_when_present(self) -> None:
        import json
        formatter = _JsonFormatter()
        record = self._make_record()
        record.meta = {"tool": "my_tool", "count": 5}  # type: ignore[attr-defined]
        output = formatter.format(record)
        parsed = json.loads(output)
        assert "meta" in parsed
        assert parsed["meta"]["tool"] == "my_tool"

    def test_exception_included_when_present(self) -> None:
        import json
        formatter = _JsonFormatter()
        try:
            raise ValueError("test error")
        except ValueError:
            import sys
            record = self._make_record(exc_info=sys.exc_info())
        output = formatter.format(record)
        parsed = json.loads(output)
        assert "exception" in parsed
        assert "ValueError" in parsed["exception"]

    def test_token_redacted_in_meta(self) -> None:
        import json
        formatter = _JsonFormatter()
        record = self._make_record()
        record.meta = {"token": "secret_token_abc123", "user": "john"}  # type: ignore[attr-defined]
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["meta"]["token"] == "[REDACTED]"
        assert parsed["meta"]["user"] == "john"

    def test_api_key_redacted_in_meta(self) -> None:
        import json
        formatter = _JsonFormatter()
        record = self._make_record()
        record.meta = {"api_key": "key_xyz789", "status": "active"}  # type: ignore[attr-defined]
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["meta"]["api_key"] == "[REDACTED]"
        assert parsed["meta"]["status"] == "active"

    def test_password_redacted_in_meta(self) -> None:
        import json
        formatter = _JsonFormatter()
        record = self._make_record()
        record.meta = {"password": "super_secret", "username": "admin"}  # type: ignore[attr-defined]
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["meta"]["password"] == "[REDACTED]"
        assert parsed["meta"]["username"] == "admin"

    def test_multiple_sensitive_keys_redacted(self) -> None:
        import json
        formatter = _JsonFormatter()
        record = self._make_record()
        record.meta = {  # type: ignore[attr-defined]
            "access_token": "token1",
            "refresh_token": "token2",
            "api_secret": "secret1",
            "client_secret": "secret2",
            "webhook_secret": "secret3",
            "data": "public",
        }
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["meta"]["access_token"] == "[REDACTED]"
        assert parsed["meta"]["refresh_token"] == "[REDACTED]"
        assert parsed["meta"]["api_secret"] == "[REDACTED]"
        assert parsed["meta"]["client_secret"] == "[REDACTED]"
        assert parsed["meta"]["webhook_secret"] == "[REDACTED]"
        assert parsed["meta"]["data"] == "public"

    def test_case_insensitive_secret_detection(self) -> None:
        import json
        formatter = _JsonFormatter()
        record = self._make_record()
        record.meta = {"SECRET": "hidden", "Token": "also_hidden", "data": "visible"}  # type: ignore[attr-defined]
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["meta"]["SECRET"] == "[REDACTED]"
        assert parsed["meta"]["Token"] == "[REDACTED]"
        assert parsed["meta"]["data"] == "visible"


# Need to import logging.handlers for MemoryHandler used in tests
import logging.handlers  # noqa: E402
