from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.ai.openai_service import openai_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Task registry
# ---------------------------------------------------------------------------

# In-memory task store — replace with Redis/DB in production
_task_store: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Tool definitions (OpenAI function-calling format)
# ---------------------------------------------------------------------------

AGENT_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for up-to-date information on a topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query.",
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return (1–10).",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "code_interpreter",
            "description": "Execute a snippet of Python code and return the stdout output.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "The Python code to execute.",
                    },
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_task",
            "description": "Schedule a task or reminder for a future time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_description": {
                        "type": "string",
                        "description": "What the task or reminder is about.",
                    },
                    "scheduled_at": {
                        "type": "string",
                        "description": "ISO-8601 datetime string for when to execute the task.",
                    },
                },
                "required": ["task_description", "scheduled_at"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "api_call",
            "description": "Make an HTTP GET request to an external API endpoint.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to fetch.",
                    },
                    "headers": {
                        "type": "object",
                        "description": "Optional HTTP headers as key-value pairs.",
                    },
                },
                "required": ["url"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

async def _tool_web_search(query: str, num_results: int = 5) -> Dict[str, Any]:
    """Mock web search — returns plausible-looking placeholder results."""
    logger.info("Agent web_search: %r", query)
    return {
        "query": query,
        "results": [
            {
                "title": f"Result {i + 1} for '{query}'",
                "url": f"https://example.com/search?q={query.replace(' ', '+')}&page={i}",
                "snippet": f"This is a placeholder search result {i + 1} about '{query}'.",
            }
            for i in range(min(num_results, 5))
        ],
        "note": "This is a mock result. Integrate a real search API (e.g. Serper, Bing) for production.",
    }


async def _tool_code_interpreter(code: str) -> Dict[str, Any]:
    """Very limited sandboxed code execution (safe math/logic only)."""
    logger.info("Agent code_interpreter invoked")
    # Only allow pure expression evaluation — no exec() for safety
    forbidden = ["import", "open(", "os.", "sys.", "__", "eval(", "exec("]
    for token in forbidden:
        if token in code:
            return {"error": f"Forbidden operation detected: '{token}'"}
    try:
        # Restrict to safe builtins
        safe_globals = {"__builtins__": {"abs": abs, "round": round, "len": len,
                                          "range": range, "int": int, "float": float,
                                          "str": str, "bool": bool, "list": list,
                                          "dict": dict, "min": min, "max": max,
                                          "sum": sum, "sorted": sorted, "print": print}}
        output_lines: List[str] = []

        # Capture print output
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            exec(compile(code, "<agent>", "exec"), safe_globals)  # noqa: S102
        output_lines = buf.getvalue().splitlines()
        return {"output": "\n".join(output_lines) or "(no output)", "success": True}
    except Exception as exc:
        return {"error": str(exc), "success": False}


async def _tool_schedule_task(
    task_description: str, scheduled_at: str
) -> Dict[str, Any]:
    """Store a scheduled task record."""
    task_id = str(uuid.uuid4())
    _task_store[task_id] = {
        "id": task_id,
        "type": "scheduled",
        "description": task_description,
        "scheduled_at": scheduled_at,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("Scheduled task %s for %s", task_id, scheduled_at)
    return {"task_id": task_id, "status": "pending", "scheduled_at": scheduled_at}


async def _tool_api_call(url: str, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Perform an HTTP GET request."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers or {})
            return {
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
                "body": resp.text[:4096],  # truncate large responses
            }
    except Exception as exc:
        return {"error": str(exc)}


_TOOL_REGISTRY = {
    "web_search": _tool_web_search,
    "code_interpreter": _tool_code_interpreter,
    "schedule_task": _tool_schedule_task,
    "api_call": _tool_api_call,
}


# ---------------------------------------------------------------------------
# AgentService
# ---------------------------------------------------------------------------

class AgentService:
    """Orchestrates AI agent tasks using OpenAI function calling."""

    # Available agent profiles
    AGENTS = [
        {
            "id": "web-researcher",
            "name": "Web Researcher",
            "description": "Searches the web to find up-to-date information on any topic.",
            "tools": ["web_search"],
            "model": "gpt-4o",
        },
        {
            "id": "code-assistant",
            "name": "Code Assistant",
            "description": "Executes Python code snippets and explains programming concepts.",
            "tools": ["code_interpreter"],
            "model": "gpt-4o",
        },
        {
            "id": "scheduler",
            "name": "Scheduler",
            "description": "Creates and manages scheduled tasks and reminders.",
            "tools": ["schedule_task"],
            "model": "gpt-4o",
        },
        {
            "id": "api-agent",
            "name": "API Agent",
            "description": "Interacts with external REST APIs to fetch real-time data.",
            "tools": ["api_call"],
            "model": "gpt-4o",
        },
        {
            "id": "general",
            "name": "General Agent",
            "description": "A fully-equipped agent with access to all available tools.",
            "tools": ["web_search", "code_interpreter", "schedule_task", "api_call"],
            "model": "gpt-4o",
        },
    ]

    def list_agents(self) -> List[Dict[str, Any]]:
        """Return the list of available agent profiles."""
        return self.AGENTS

    async def execute_task(
        self,
        task_type: str,
        params: Dict[str, Any],
        user_id: str,
    ) -> Dict[str, Any]:
        """Execute an agent task using OpenAI tool-use.

        The agent will reason about *task_type* / *params*, potentially call
        one or more tools, and return a structured result.

        Args:
            task_type: Matches a tool name (``web_search``, ``code_interpreter``,
                ``schedule_task``, ``api_call``) or ``"general"`` for free-form.
            params: Input parameters for the task.
            user_id: ID of the requesting user (for auditing).

        Returns:
            Dict with ``task_id``, ``status``, ``result``, and ``reasoning``.
        """
        task_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()

        # Store initial record
        _task_store[task_id] = {
            "id": task_id,
            "type": task_type,
            "params": params,
            "user_id": user_id,
            "status": "running",
            "created_at": created_at,
            "result": None,
        }

        try:
            result = await self._run_agent(task_type, params)
            _task_store[task_id]["status"] = "completed"
            _task_store[task_id]["result"] = result
            return {
                "task_id": task_id,
                "status": "completed",
                "result": result,
                "created_at": created_at,
            }
        except Exception as exc:
            logger.exception("Agent task %s failed", task_id)
            _task_store[task_id]["status"] = "failed"
            _task_store[task_id]["error"] = str(exc)
            return {
                "task_id": task_id,
                "status": "failed",
                "error": str(exc),
                "created_at": created_at,
            }

    async def _run_agent(
        self, task_type: str, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Inner execution loop with multi-step tool calling."""
        # Build the initial prompt
        system_prompt = (
            "You are PRIME, an intelligent AI assistant with access to tools. "
            "Use the tools as needed to complete the user's request. "
            "When you have gathered all necessary information, provide a clear and concise final answer."
        )
        user_message = f"Task type: {task_type}\nParameters: {json.dumps(params, ensure_ascii=False)}"

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        # Select tools relevant to the task type
        if task_type == "general":
            tools = AGENT_TOOLS
        else:
            tools = [t for t in AGENT_TOOLS if t["function"]["name"] == task_type]
            if not tools:
                tools = AGENT_TOOLS  # fall back to all tools

        # Agentic loop — max 5 tool-call rounds
        for _ in range(5):
            response = await openai_service.chat_with_tools(messages, tools)
            messages.append({"role": "assistant", "content": response["content"],
                              **({"tool_calls": response["tool_calls"]} if response["tool_calls"] else {})})

            if not response["tool_calls"]:
                # Model is done — return the final message
                return {"answer": response["content"], "tool_calls_made": []}

            # Execute each tool call
            tool_results = []
            for tc in response["tool_calls"]:
                fn_name = tc["function"]["name"]
                try:
                    fn_args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    fn_args = {}

                tool_fn = _TOOL_REGISTRY.get(fn_name)
                if tool_fn:
                    tool_result = await tool_fn(**fn_args)
                else:
                    tool_result = {"error": f"Unknown tool: {fn_name}"}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": fn_name,
                    "content": json.dumps(tool_result),
                })
                tool_results.append({"tool": fn_name, "result": tool_result})

        # Exhausted rounds — return last message
        last_content = next(
            (m["content"] for m in reversed(messages) if m["role"] == "assistant"),
            "Task completed.",
        )
        return {"answer": last_content, "tool_calls_made": tool_results}

    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Look up a task by ID."""
        return _task_store.get(task_id)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

agent_service = AgentService()
