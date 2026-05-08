from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.ai.agent_service import agent_service

router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Request / Response schemas (local — small enough to keep inline)
# ---------------------------------------------------------------------------

class AgentInfo(BaseModel):
    id: str
    name: str
    description: str
    tools: List[str]
    model: str


class ExecuteTaskRequest(BaseModel):
    task_type: str = Field(
        description=(
            "The type of task to execute. One of: "
            "``web_search``, ``code_interpreter``, ``schedule_task``, "
            "``api_call``, or ``general``."
        ),
        examples=["web_search"],
    )
    params: Dict[str, Any] = Field(
        default_factory=dict,
        description="Task-specific parameters (e.g. ``{'query': 'latest AI news'}``).  ",
    )


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str  # "running" | "completed" | "failed"
    result: Optional[Any] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    type: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


class ExecuteTaskResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None
    created_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=List[AgentInfo],
    summary="List all available agent profiles",
)
async def list_agents(
    current_user: User = Depends(get_current_active_user),
) -> List[AgentInfo]:
    """Return the catalogue of available PRIME agents."""
    return [AgentInfo(**a) for a in agent_service.list_agents()]


@router.post(
    "/execute",
    response_model=ExecuteTaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute an agent task",
)
async def execute_task(
    payload: ExecuteTaskRequest,
    current_user: User = Depends(get_current_active_user),
) -> ExecuteTaskResponse:
    """Run an agent task and return the result.

    Valid ``task_type`` values:

    - ``web_search`` — params: ``{"query": str, "num_results": int}``
    - ``code_interpreter`` — params: ``{"code": str}``
    - ``schedule_task`` — params: ``{"task_description": str, "scheduled_at": str}``
    - ``api_call`` — params: ``{"url": str, "headers": dict}``
    - ``general`` — params: free-form, the agent decides which tools to use
    """
    valid_types = {"web_search", "code_interpreter", "schedule_task", "api_call", "general"}
    if payload.task_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid task_type '{payload.task_type}'. Must be one of: {', '.join(sorted(valid_types))}",
        )

    result = await agent_service.execute_task(
        task_type=payload.task_type,
        params=payload.params,
        user_id=str(current_user.id),
    )
    return ExecuteTaskResponse(**result)


@router.get(
    "/tasks/{task_id}",
    response_model=TaskStatusResponse,
    summary="Get the status of a previously submitted agent task",
)
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_active_user),
) -> TaskStatusResponse:
    """Poll the status and result of an agent task by its ID."""
    task = await agent_service.get_task_status(task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id}' not found.",
        )
    # Redact user_id from the public response
    task.pop("user_id", None)
    return TaskStatusResponse(**task)
