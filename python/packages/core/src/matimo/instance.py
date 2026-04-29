"""
Matimo — Main entry point for the Python SDK.
Mirrors: packages/core/src/matimo-instance.ts (MatimoInstance class)

Usage:
    # Factory pattern
    matimo = await Matimo.init('./tools')
    result = await matimo.execute('calculator', {'operation': 'add', 'a': 5, 'b': 3})

    # Multi-tenant (per-call credentials)
    result = await matimo.execute('slack_send_channel_message', params,
                                   credentials={'SLACK_BOT_TOKEN': token})

    # With LangChain
    from matimo.integrations.langchain import convert_tools_to_langchain
    lc_tools = convert_tools_to_langchain(matimo.list_tools(), matimo)
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC
from typing import Any

from matimo.auth.injection import inject_auth_parameters
from matimo.core.loader import ToolLoader
from matimo.core.models import (
    PolicyContext,
    SkillContentOptions,
    SkillDefinition,
    SkillSummary,
    ToolDefinition,
)
from matimo.core.registry import ToolRegistry
from matimo.core.skill_loader import SkillLoader
from matimo.core.skill_registry import SemanticSearchResult, SkillRegistry
from matimo.errors import ErrorCode, MatimoError
from matimo.executors.command_executor import CommandExecutor
from matimo.executors.function_executor import FunctionExecutor
from matimo.executors.http_executor import HttpExecutor
from matimo.logging import MatimoLogger, setup_logger
from matimo.policy.default_policy import DefaultPolicyEngine, PolicyEngine
from matimo.policy.types import (
    HITLCallback,
    MatimoEventHandler,
    PolicyConfig,
    PolicyDenied,
    PolicyPendingApproval,
)

logger = logging.getLogger("matimo")


@dataclass
class ReloadResult:
    """Result of a hot-reload operation. Mirrors TS ReloadResult."""

    loaded: int = 0
    removed: int = 0
    revalidated: int = 0
    rejected: list[str] = field(default_factory=list)
    rolled_back: bool = False


@dataclass
class InitOptions:
    """
    Initialisation options for Matimo.
    Mirrors: InitOptions in matimo-instance.ts
    """

    tool_paths: list[str] | None = None
    skill_paths: list[str] | None = None
    auto_discover: bool = False
    include_core: bool = True

    # Policy
    policy: PolicyEngine | None = None
    policy_config: PolicyConfig | None = None
    policy_file: str | None = None
    trusted_paths: list[str] | None = None
    untrusted_paths: list[str] | None = None

    # Approval manifest
    approval_secret: str | None = None
    approval_dir: str | None = None
    approval_ttl_seconds: int | None = None

    # Events / HITL
    on_event: MatimoEventHandler | None = None
    on_hitl: HITLCallback | None = None
    hitl_timeout_ms: int | None = None

    # Logging
    log_level: str | None = None
    log_format: str | None = None


class Matimo:
    """
    Main entry point for the Matimo Python SDK.
    Mirrors: MatimoInstance in matimo-instance.ts

    Never instantiate directly — use Matimo.init() instead.
    """

    def __init__(
        self,
        registry: ToolRegistry,
        policy_engine: PolicyEngine,
        loader: ToolLoader,
        tool_paths: list[str],
        on_event: MatimoEventHandler | None,
        on_hitl: HITLCallback | None,
        matimo_logger: MatimoLogger,
        hitl_timeout_ms: int | None = None,
        skill_registry: SkillRegistry | None = None,
    ) -> None:
        self._registry = registry
        self._policy = policy_engine
        self._loader = loader
        self._tool_paths = tool_paths
        self._on_event = on_event
        self._on_hitl = on_hitl
        self._hitl_timeout_ms = hitl_timeout_ms
        self._logger = matimo_logger
        self._skill_registry: SkillRegistry = skill_registry or SkillRegistry()

        self._http_executor = HttpExecutor()
        self._command_executor = CommandExecutor()
        self._function_executor = FunctionExecutor()

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    async def init(
        cls,
        tool_paths: str | list[str] | None = None,
        *,
        auto_discover: bool = False,
        skill_paths: list[str] | None = None,
        policy: PolicyEngine | None = None,
        policy_config: PolicyConfig | None = None,
        policy_file: str | None = None,
        trusted_paths: list[str] | None = None,
        untrusted_paths: list[str] | None = None,
        approval_secret: str | None = None,
        approval_dir: str | None = None,
        approval_ttl_seconds: int | None = None,
        on_event: MatimoEventHandler | None = None,
        on_hitl: HITLCallback | None = None,
        hitl_timeout_ms: int | None = None,
        log_level: str | None = None,
        log_format: str | None = None,
    ) -> Matimo:
        """
        Initialise Matimo by loading tool definitions and configuring the policy engine.

        Args:
            tool_paths:    One or more directories containing definition.yaml files.
                           Defaults to auto-discovery if auto_discover=True.
            auto_discover: Scan installed matimo-* packages for additional tools.
            policy:        Custom PolicyEngine instance.
            policy_config: Shorthand — build a DefaultPolicyEngine with this config.
            policy_file:   Path to a policy.yaml file.
            trusted_paths: Paths considered developer-authored (skip content validation).
            untrusted_paths: Paths considered agent-created (undergo content validation).
            on_event:      Audit event handler.
            on_hitl:       Human-in-the-loop callback for quarantined tools.
            hitl_timeout_ms: Timeout in milliseconds for the HITL callback.
                           If the callback does not resolve within this time the tool
                           is auto-rejected. Defaults to None (waits indefinitely).
            log_level:     One of 'silent' | 'error' | 'warn' | 'info' | 'debug'.
            log_format:    'json' | 'simple'.

        Returns:
            Configured Matimo instance.
        """
        matimo_logger = setup_logger(level=log_level, log_format=log_format)

        # Normalise paths
        if isinstance(tool_paths, str):
            paths: list[str] = [tool_paths]
        elif tool_paths:
            paths = list(tool_paths)
        else:
            paths = []

        loader = ToolLoader()

        if auto_discover:
            discovered = loader.auto_discover_packages()
            paths.extend(p for p in discovered if p not in paths)

        # Build policy engine
        engine = cls._build_policy_engine(
            policy, policy_config, policy_file, trusted_paths, untrusted_paths
        )

        # Load tools
        registry = ToolRegistry()
        all_tools = loader.load_tools_from_multiple_paths(paths)
        for tool in all_tools.values():
            try:
                registry.register(tool)
            except MatimoError as exc:
                matimo_logger.warn(
                    f"Failed to register tool '{tool.name}': {exc}"
                )

        matimo_logger.info(
            f"Matimo initialised — {registry.count()} tool(s) loaded from {len(paths)} path(s)"
        )

        # Load skills (optional)
        skill_reg = SkillRegistry()
        
        # Auto-discover skill paths if auto_discover=True
        skill_discovery_paths = list(skill_paths) if skill_paths else []
        # Note: auto_discover is for tools only, not skills. Skills must be passed via skill_paths.
        
        if skill_discovery_paths:
            skill_loader = SkillLoader()
            for sp in skill_discovery_paths:
                skills = skill_loader.load_skills_from_directory(sp)
                skill_reg.register_all(skills)
        
        if skill_reg.count() > 0:
            matimo_logger.info(f"{skill_reg.count()} skill(s) loaded")

        return cls(
            registry=registry,
            policy_engine=engine,
            loader=loader,
            tool_paths=paths,
            on_event=on_event,
            on_hitl=on_hitl,
            matimo_logger=matimo_logger,
            hitl_timeout_ms=hitl_timeout_ms,
            skill_registry=skill_reg,
        )


        # ------------------------------------------------------------------
    # Execute
    # ------------------------------------------------------------------

    async def execute(
        self,
        tool_name: str,
        params: dict[str, Any],
        *,
        credentials: dict[str, str] | None = None,
        context: PolicyContext | None = None,
        approved: bool = False,
    ) -> Any:  # noqa: ANN401
        """
        Execute a tool by name.

        Args:
            tool_name:   Name of the tool to execute.
            params:      Parameter values for the tool.
            credentials: Per-call credential overrides (multi-tenant).
                         SECURITY: never logged.
            context:     Policy context (agent ID, roles, environment).
            approved:    Skip approval check (use when already confirmed out-of-band).

        Returns:
            Tool execution result — arbitrary value (JSON, text, etc.).

        Raises:
            MatimoError(TOOL_NOT_FOUND)    if tool is not registered.
            MatimoError(POLICY_DENIED)     if the policy engine blocks execution.
            MatimoError(EXECUTION_FAILED)  on runtime errors.
        """
        trace_id = str(uuid.uuid4())[:8]
        start = time.monotonic()

        tool = self._registry.get_or_raise(tool_name)

        # Policy check
        if not approved:
            ctx = context or PolicyContext()
            decision = self._policy.can_execute(ctx, tool)

            if isinstance(decision, PolicyDenied):
                self._emit_event({
                    "type": "tool:execution_denied",
                    "tool_name": tool_name,
                    "reason": decision.reason,
                    "agent_id": ctx.agent_id,
                    "timestamp": _now(),
                })
                raise MatimoError(
                    f"Policy denied execution of '{tool_name}': {decision.reason}",
                    ErrorCode.POLICY_DENIED,
                    {"tool_name": tool_name, "reason": decision.reason},
                )

            if isinstance(decision, PolicyPendingApproval):
                hitl_approved = await self._resolve_hitl(decision, tool, ctx)
                if not hitl_approved:
                    raise MatimoError(
                        f"Human approval denied for tool '{tool_name}'",
                        ErrorCode.POLICY_DENIED,
                        {"tool_name": tool_name},
                    )

        # Built-in interception: matimo_reload_tools must run on the instance
        # itself because reload() clears/rebuilds the in-memory registry.
        # The function executor has no reference to the Matimo instance, so we
        # handle it directly here. Works identically for SDK, LangChain, and MCP.
        if tool_name == "matimo_reload_tools":
            reload_result = await self.reload()
            self._logger.info(
                "matimo_reload_tools: reload completed",
                loaded=reload_result.loaded,
                removed=reload_result.removed,
                rejected=len(reload_result.rejected),
            )
            return {
                "success": True,
                "loaded": reload_result.loaded,
                "removed": reload_result.removed,
                "revalidated": reload_result.revalidated,
                "rejected": reload_result.rejected,
                "message": (
                    f"Reload complete. {reload_result.loaded} tools loaded, "
                    f"{reload_result.removed} removed, {len(reload_result.rejected)} rejected."
                ),
            }

        # Auth injection
        working_params = inject_auth_parameters(tool, params, credentials)

        # Execute
        try:
            result = await self._dispatch(tool, working_params, credentials)
        except MatimoError:
            raise
        except Exception as exc:
            raise MatimoError(
                f"Unexpected error executing '{tool_name}': {exc}",
                ErrorCode.EXECUTION_FAILED,
                {"tool_name": tool_name, "trace_id": trace_id},
                cause=exc,
            ) from exc

        duration = time.monotonic() - start
        self._emit_event({
            "type": "tool:executed",
            "tool_name": tool_name,
            "agent_id": context.agent_id if context else None,
            "duration": duration,
            "success": True,
            "timestamp": _now(),
        })

        return result

    # ------------------------------------------------------------------
    # Tool discovery API
    # ------------------------------------------------------------------

    def list_tools(self) -> list[ToolDefinition]:
        """Return all registered tools."""
        return self._registry.get_all()

    def search_tools(self, query: str) -> list[ToolDefinition]:
        """Substring search over tool names and descriptions."""
        return self._registry.search(query)

    def get_tool(self, name: str) -> ToolDefinition | None:
        """Return a tool by exact name, or None."""
        return self._registry.get(name)

    def get_tools_for_agent(
        self, context: PolicyContext
    ) -> list[ToolDefinition]:
        """Return only the tools this agent context is permitted to use."""
        return self._policy.filter_for_agent(context, self._registry.get_all())

    def has_policy(self) -> bool:
        """Return True if a policy engine is configured (always True in Matimo)."""
        return True

    # ------------------------------------------------------------------
    # Skills API
    # ------------------------------------------------------------------

    def list_skills(self) -> list[SkillSummary]:
        """Return Level-1 metadata (name + description) for all loaded skills."""
        return self._skill_registry.list()

    def get_all_skills(self) -> list[SkillDefinition]:
        """Return all loaded SkillDefinition objects."""
        return self._skill_registry.get_all()

    def get_skill(self, name: str) -> SkillDefinition | None:
        """Return a skill by exact name, or None."""
        return self._skill_registry.get(name)

    def get_skill_content(self, name: str, options: SkillContentOptions | None = None) -> str | None:
        """Return the full markdown content of a skill, or None if not found."""
        return self._skill_registry.get_skill_content(name, options)

    async def execute_tool(
        self,
        tool_name: str,
        params: dict[str, Any] | None = None,
        *,
        credentials: dict[str, str] | None = None,
        context: PolicyContext | None = None,
        approved: bool = False,
    ) -> Any:  # noqa: ANN401
        """
        Execute a tool (alias for execute() with simpler params).
        
        Args:
            tool_name: Name of the tool to execute
            params: Tool parameters (defaults to empty dict)
            credentials: Per-call credential overrides
            context: Policy context
            approved: Whether tool is pre-approved
            
        Returns:
            Tool execution result
        """
        return await self.execute(
            tool_name,
            params or {},
            credentials=credentials,
            context=context,
            approved=approved,
        )


    async def semantic_search_skills(
        self,
        query: str,
        *,
        limit: int = 10,
        min_score: float = 0.1,
    ) -> list[SemanticSearchResult]:
        """Semantic (TF-IDF) search over loaded skills. Returns ranked results."""
        return await self._skill_registry.semantic_search(query, limit=limit, min_score=min_score)

    # ------------------------------------------------------------------
    # Hot-reload
    # ------------------------------------------------------------------

    async def reload(self) -> ReloadResult:
        """
        Reload all tool definitions from disk.
        New tools are added; changed tools are replaced; removed YAMLs are unregistered.
        """
        result = ReloadResult()

        new_tools = self._loader.load_tools_from_multiple_paths(self._tool_paths)
        existing_names = {t.name for t in self._registry.get_all()}
        new_names = set(new_tools.keys())

        # Remove tools that no longer exist on disk
        for name in existing_names - new_names:
            self._registry.remove(name)
            result.removed += 1

        # Add / replace tools
        for name, tool in new_tools.items():
            existing = self._registry.get(name)
            if existing is not None:
                self._registry.register_or_replace(tool)
                result.revalidated += 1
            else:
                try:
                    self._registry.register(tool)
                    result.loaded += 1
                except MatimoError as exc:
                    result.rejected.append(name)
                    logger.warning("Reload: failed to register '%s': %s", name, exc)

        self._emit_event({
            "type": "tools:reloaded",
            "loaded": result.loaded,
            "removed": result.removed,
            "rejected": result.rejected,
            "timestamp": _now(),
        })

        return result

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _dispatch(
        self,
        tool: ToolDefinition,
        params: dict[str, Any],
        credentials: dict[str, str] | None,
    ) -> Any:  # noqa: ANN401
        # Returns Any: tool execution results are arbitrary JSON/values dispatched to executors.
        exec_type = tool.execution.type
        if exec_type == "http":
            return await self._http_executor.execute(tool, params, credentials)
        if exec_type == "command":
            return await self._command_executor.execute(tool, params, credentials)
        if exec_type == "function":
            return await self._function_executor.execute(tool, params, credentials)
        raise MatimoError(
            f"Unknown execution type: '{exec_type}'",
            ErrorCode.EXECUTION_FAILED,
            {"tool_name": tool.name, "execution_type": exec_type},
        )

    async def _resolve_hitl(
        self,
        decision: PolicyPendingApproval,
        tool: ToolDefinition,
        context: PolicyContext,
    ) -> bool:
        """Invoke the HITL callback or deny if no callback is configured."""
        import asyncio

        from matimo.policy.types import HITLRequest

        if self._on_hitl is None:
            self._logger.warn(
                f"Tool '{tool.name}' requires HITL approval but no on_hitl callback is set — denying"
            )
            return False

        request = HITLRequest(
            tool_name=tool.name,
            risk_level=decision.risk_level,
            reason=decision.reason,
            environment=context.environment,
            agent_id=context.agent_id,
            tool_definition=tool.model_dump(exclude={"_definition_path"}),
        )

        if self._hitl_timeout_ms is not None:
            timeout_s = self._hitl_timeout_ms / 1000.0
            try:
                approved = await asyncio.wait_for(self._on_hitl(request), timeout=timeout_s)
            except TimeoutError:
                self._logger.warn(
                    f"HITL callback timed out after {self._hitl_timeout_ms}ms for tool "
                    f"'{tool.name}' — auto-rejecting"
                )
                approved = False
        else:
            approved = await self._on_hitl(request)

        self._emit_event({
            "type": "tool:quarantine_approved" if approved else "tool:quarantine_rejected",
            "tool_name": tool.name,
            "timestamp": _now(),
        })
        return approved

    def _emit_event(self, event_dict: dict[str, Any]) -> None:
        """Emit an audit event if a handler is configured."""
        if self._on_event is None:
            return
        try:
            self._on_event(event_dict)  # type: ignore[arg-type]
        except Exception as exc:
            logger.debug("Event handler raised: %s", exc)

    @staticmethod
    def _build_policy_engine(
        policy: PolicyEngine | None,
        policy_config: PolicyConfig | None,
        policy_file: str | None,
        trusted_paths: list[str] | None,
        untrusted_paths: list[str] | None,
    ) -> PolicyEngine:
        if policy is not None:
            return policy
        if policy_file is not None:
            from matimo.policy.policy_loader import load_policy_from_file
            return load_policy_from_file(
                policy_file,
                trusted_paths=trusted_paths,
                untrusted_paths=untrusted_paths,
            )
        return DefaultPolicyEngine(
            config=policy_config,
            trusted_paths=trusted_paths,
            untrusted_paths=untrusted_paths,
        )


# ---------------------------------------------------------------------------
# Module-level convenience namespace (mirrors `export const matimo = { init }`)
# ---------------------------------------------------------------------------

class _MatimoNamespace:
    """Mirrors the `matimo` export from TypeScript: `matimo.init()`."""

    @staticmethod
    async def init(
        tool_paths: str | list[str] | None = None,
        **kwargs: object,
    ) -> Matimo:
        return await Matimo.init(tool_paths, **kwargs)


matimo = _MatimoNamespace()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> str:
    from datetime import datetime
    return datetime.now(UTC).isoformat()
