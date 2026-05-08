from __future__ import annotations

import logging
from typing import Any, Dict

from celery import Celery

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Celery application
# ---------------------------------------------------------------------------

celery_app = Celery(
    "prime_workers",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,  # 1 hour
)


# ---------------------------------------------------------------------------
# Task definitions
# ---------------------------------------------------------------------------

@celery_app.task(
    bind=True,
    name="tasks.process_agent_task",
    max_retries=3,
    default_retry_delay=5,
)
def process_agent_task(
    self,
    task_type: str,
    params: Dict[str, Any],
    user_id: str,
) -> Dict[str, Any]:
    """Background Celery task that executes an agent job asynchronously.

    This wrapper allows long-running agent tasks (e.g. multi-step web
    research) to be offloaded to a worker process and polled for completion.

    Args:
        task_type: One of ``web_search``, ``code_interpreter``,
            ``schedule_task``, ``api_call``, ``general``.
        params: Task-specific input parameters.
        user_id: Owner user ID string for auditing.

    Returns:
        Dict with ``status``, ``result`` or ``error`` fields.
    """
    import asyncio

    try:
        # Celery tasks are sync; bridge to the async agent service
        from app.services.ai.agent_service import agent_service

        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                agent_service.execute_task(task_type, params, user_id)
            )
        finally:
            loop.close()

        return result
    except Exception as exc:
        logger.exception("Celery agent task failed: %s", exc)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return {"status": "failed", "error": str(exc)}


@celery_app.task(
    name="tasks.send_notification",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
)
def send_notification(
    self,
    user_id: str,
    notification_type: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Deliver an in-app notification to a user.

    Currently logs the notification; hook into a real notification service
    (push, email, WebSocket broadcast) in production.

    Args:
        user_id: Target user's UUID string.
        notification_type: E.g. ``"task_complete"``, ``"memory_saved"``.
        payload: Notification body data.
    """
    logger.info(
        "Notification [%s] for user %s: %s",
        notification_type,
        user_id,
        payload,
    )
    # TODO: Integrate with WebSocket manager or push notification service
    return {
        "status": "sent",
        "user_id": user_id,
        "type": notification_type,
    }


@celery_app.task(
    name="tasks.cleanup_expired_tokens",
    bind=True,
)
def cleanup_expired_tokens(self) -> Dict[str, Any]:
    """Periodic housekeeping task — remove expired blacklisted tokens from Redis.

    Schedule with Celery Beat::

        celery_app.conf.beat_schedule = {
            "cleanup-tokens-hourly": {
                "task": "tasks.cleanup_expired_tokens",
                "schedule": 3600.0,
            },
        }
    """
    import asyncio
    import redis.asyncio as aioredis

    async def _run() -> int:
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            # Redis TTL handles expiry automatically; just report active blacklist size
            keys = await client.keys("blacklist:*")
            return len(keys)
        finally:
            await client.aclose()

    loop = asyncio.new_event_loop()
    try:
        count = loop.run_until_complete(_run())
    finally:
        loop.close()

    logger.info("Blacklist entries active: %d", count)
    return {"status": "ok", "active_blacklist_entries": count}
