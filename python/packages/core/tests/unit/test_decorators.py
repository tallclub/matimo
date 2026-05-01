"""Unit tests for decorators/__init__.py."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from matimo.decorators import (
    _build_params,
    _resolve_instance,
    get_global_matimo_instance,
    set_global_matimo_instance,
    tool,
)
from matimo.errors import ErrorCode, MatimoError


def _make_matimo_mock(return_value: object = None) -> MagicMock:
    mock = MagicMock()
    mock.execute = AsyncMock(return_value=return_value or {"ok": True})
    return mock


# ---------------------------------------------------------------------------
# Global instance helpers
# ---------------------------------------------------------------------------


class TestGlobalInstance:
    def setup_method(self) -> None:
        # Reset global to None before each test
        set_global_matimo_instance(None)  # type: ignore[arg-type]

    def test_set_and_get(self) -> None:
        mock = _make_matimo_mock()
        set_global_matimo_instance(mock)
        assert get_global_matimo_instance() is mock

    def test_get_without_set_returns_none(self) -> None:
        assert get_global_matimo_instance() is None


# ---------------------------------------------------------------------------
# _resolve_instance
# ---------------------------------------------------------------------------


class TestResolveInstance:
    def setup_method(self) -> None:
        set_global_matimo_instance(None)  # type: ignore[arg-type]

    def test_prefers_self_matimo(self) -> None:
        mock = _make_matimo_mock()
        obj = MagicMock()
        obj._matimo = mock
        result = _resolve_instance(obj)
        assert result is mock

    def test_falls_back_to_global(self) -> None:
        mock = _make_matimo_mock()
        set_global_matimo_instance(mock)
        obj = MagicMock(spec=[])  # no _matimo attribute
        result = _resolve_instance(obj)
        assert result is mock

    def test_raises_when_no_instance(self) -> None:
        obj = MagicMock(spec=[])  # no _matimo attribute
        with pytest.raises(MatimoError) as exc_info:
            _resolve_instance(obj)
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER
        assert "set_global_matimo_instance" in str(exc_info.value)


# ---------------------------------------------------------------------------
# _build_params
# ---------------------------------------------------------------------------


class TestBuildParams:
    def test_positional_args(self) -> None:
        def fn(self: object, channel: str, text: str) -> None: ...  # noqa: ANN001
        result = _build_params(fn, ("#general", "hello"), {})
        assert result == {"channel": "#general", "text": "hello"}

    def test_keyword_args(self) -> None:
        def fn(self: object, channel: str, text: str) -> None: ...  # noqa: ANN001
        result = _build_params(fn, (), {"channel": "#dev", "text": "hi"})
        assert result == {"channel": "#dev", "text": "hi"}

    def test_mixed_args(self) -> None:
        def fn(self: object, a: str, b: str, c: str) -> None: ...  # noqa: ANN001
        result = _build_params(fn, ("val_a",), {"b": "val_b", "c": "val_c"})
        assert result == {"a": "val_a", "b": "val_b", "c": "val_c"}

    def test_excludes_self(self) -> None:
        def fn(self: object, param: str) -> None: ...  # noqa: ANN001
        result = _build_params(fn, ("value",), {})
        assert "self" not in result

    def test_excludes_var_positional(self) -> None:
        def fn(self: object, a: str, *args: object) -> None: ...  # noqa: ANN001
        result = _build_params(fn, ("hello",), {})
        assert result == {"a": "hello"}

    def test_excludes_var_keyword(self) -> None:
        def fn(self: object, a: str, **kwargs: object) -> None: ...  # noqa: ANN001
        result = _build_params(fn, ("hello",), {"extra": "val"})
        assert result == {"a": "hello", "extra": "val"}

    def test_no_params_beyond_self(self) -> None:
        def fn(self: object) -> None: ...
        result = _build_params(fn, (), {})
        assert result == {}


# ---------------------------------------------------------------------------
# @tool decorator — async
# ---------------------------------------------------------------------------


class TestToolDecoratorAsync:
    @pytest.mark.asyncio
    async def test_async_method_executes_tool(self) -> None:
        mock_matimo = _make_matimo_mock({"result": "done"})
        set_global_matimo_instance(mock_matimo)

        class MyAgent:
            @tool("slack_send_message")
            async def send(self, channel: str, text: str) -> object:
                return None

        agent = MyAgent()
        result = await agent.send("#general", "hello")  # type: ignore[call-arg]
        mock_matimo.execute.assert_called_once_with(
            "slack_send_message", {"channel": "#general", "text": "hello"}
        )
        assert result == {"result": "done"}

    @pytest.mark.asyncio
    async def test_async_tool_uses_self_matimo(self) -> None:
        mock_matimo = _make_matimo_mock()

        class MyAgent:
            def __init__(self) -> None:
                self._matimo = mock_matimo

            @tool("my_tool")
            async def run(self, value: str) -> object:
                return None

        agent = MyAgent()
        await agent.run("test")  # type: ignore[call-arg]
        mock_matimo.execute.assert_called_once_with("my_tool", {"value": "test"})

    @pytest.mark.asyncio
    async def test_async_tool_no_instance_raises(self) -> None:
        set_global_matimo_instance(None)  # type: ignore[arg-type]

        class MyAgent:
            @tool("my_tool")
            async def run(self, value: str) -> object:
                return None

        agent = MyAgent()
        with pytest.raises(MatimoError) as exc_info:
            await agent.run("test")  # type: ignore[call-arg]
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    def setup_method(self) -> None:
        set_global_matimo_instance(None)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# @tool decorator — sync
# ---------------------------------------------------------------------------


class TestToolDecoratorSync:
    def setup_method(self) -> None:
        set_global_matimo_instance(None)  # type: ignore[arg-type]

    def test_sync_method_decorated(self) -> None:
        mock_matimo = _make_matimo_mock({"value": 42})
        set_global_matimo_instance(mock_matimo)

        class MyAgent:
            @tool("calculator")
            def calculate(self, x: float, y: float) -> object:
                return None

        agent = MyAgent()
        agent.calculate(1.0, 2.0)  # type: ignore[call-arg]
        mock_matimo.execute.assert_called_once_with(
            "calculator", {"x": 1.0, "y": 2.0}
        )

    def test_sync_tool_uses_self_matimo(self) -> None:
        mock_matimo = _make_matimo_mock()

        class MyAgent:
            def __init__(self) -> None:
                self._matimo = mock_matimo

            @tool("my_tool")
            def run(self, val: str) -> object:
                return None

        agent = MyAgent()
        agent.run("hello")  # type: ignore[call-arg]
        mock_matimo.execute.assert_called_once_with("my_tool", {"val": "hello"})

    def test_sync_tool_no_instance_raises(self) -> None:
        class MyAgent:
            @tool("my_tool")
            def run(self, v: str) -> object:
                return None

        agent = MyAgent()
        with pytest.raises(MatimoError) as exc_info:
            agent.run("x")  # type: ignore[call-arg]
        assert exc_info.value.code == ErrorCode.INVALID_PARAMETER

    def test_decorator_preserves_function_metadata(self) -> None:
        mock_matimo = _make_matimo_mock()
        set_global_matimo_instance(mock_matimo)

        class MyAgent:
            @tool("my_tool")
            async def documented_method(self, x: str) -> object:
                """Original docstring."""
                return None

        agent = MyAgent()
        assert agent.documented_method.__name__ == "documented_method"


# ---------------------------------------------------------------------------
# @tool decorator — sync edge cases (exception and running-loop branches)
# ---------------------------------------------------------------------------


class TestToolDecoratorSyncEdgeCases:
    def setup_method(self) -> None:
        set_global_matimo_instance(None)  # type: ignore[arg-type]

    def test_sync_wrapper_no_event_loop_creates_new(self) -> None:
        """Cover lines 72-74: except RuntimeError branch — no event loop exists."""
        from unittest.mock import patch

        mock_matimo = _make_matimo_mock({"result": "ok"})
        set_global_matimo_instance(mock_matimo)

        class MyAgent:
            @tool("my_tool")
            def run(self, x: str) -> object:
                return None

        agent = MyAgent()

        with patch("asyncio.get_event_loop", side_effect=RuntimeError("no loop")):
            result = agent.run("test")  # type: ignore[call-arg]

        assert result == {"result": "ok"}

    @pytest.mark.asyncio
    async def test_sync_wrapper_in_running_loop_uses_thread(self) -> None:
        """Cover lines 76-81: concurrent.futures branch when loop.is_running()."""
        mock_matimo = _make_matimo_mock({"ok": True})
        set_global_matimo_instance(mock_matimo)

        class MyAgent:
            @tool("my_tool")
            def run(self, val: str) -> object:
                return None

        agent = MyAgent()
        # This async test runs inside a live event loop so loop.is_running() == True
        result = agent.run("hello")  # type: ignore[call-arg]
        assert result == {"ok": True}
        mock_matimo.execute.assert_called_once_with("my_tool", {"val": "hello"})
