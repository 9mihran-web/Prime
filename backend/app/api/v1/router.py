from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import agents, auth, chat, memory, models, voice

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(chat.router)
api_router.include_router(agents.router)
api_router.include_router(memory.router)
api_router.include_router(voice.router)
api_router.include_router(models.router)
