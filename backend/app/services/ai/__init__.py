from app.services.ai.openai_service import openai_service, OpenAIService
from app.services.ai.ollama_service import ollama_service, OllamaService
from app.services.ai.model_router import model_router, ModelRouter
from app.services.ai.memory_service import memory_service, MemoryService
from app.services.ai.agent_service import agent_service, AgentService

__all__ = [
    # OpenAI backend
    "openai_service",
    "OpenAIService",
    # Ollama backend
    "ollama_service",
    "OllamaService",
    # Smart router (preferred entry-point for AI calls)
    "model_router",
    "ModelRouter",
    # Higher-level services
    "memory_service",
    "MemoryService",
    "agent_service",
    "AgentService",
]
