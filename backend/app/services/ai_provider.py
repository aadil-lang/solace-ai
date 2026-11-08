from abc import ABC, abstractmethod
from typing import Optional, AsyncIterator, List, Dict, Any
import asyncio
from app.core.config import settings
from app.core.exceptions import SolaceException


class AIProviderInterface(ABC):
    """Abstract base class for AI model providers in Solace AI."""

    @abstractmethod
    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate a complete text response."""
        pass

    @abstractmethod
    async def generate_response_stream(
        self, prompt: str, system_prompt: Optional[str] = None, history: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncIterator[str]:
        """Stream response tokens from the underlying model."""
        pass


class GeminiProvider(AIProviderInterface):
    """Google Gemini AI provider implementation using google-genai SDK."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.AI_MODEL
        self._client = None

        if self.api_key:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)

    def _ensure_client(self):
        if not self.api_key or not self._client:
            raise SolaceException(
                message="Google Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env.",
                status_code=503,
                code="AI_PROVIDER_UNCONFIGURED",
            )

    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        self._ensure_client()
        response = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={"system_instruction": system_prompt} if system_prompt else None,
        )
        return response.text or ""

    async def generate_response_stream(
        self, prompt: str, system_prompt: Optional[str] = None, history: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncIterator[str]:
        self._ensure_client()

        # Build contents from history if provided
        contents_payload: Any = prompt
        if history:
            formatted_contents = []
            for h in history:
                role = "user" if h.get("role") == "user" else "model"
                formatted_contents.append({"role": role, "parts": [{"text": h.get("content", "")}]})
            formatted_contents.append({"role": "user", "parts": [{"text": prompt}]})
            contents_payload = formatted_contents

        config = {"system_instruction": system_prompt} if system_prompt else None

        # Call streaming generator via client thread executor to prevent blocking ASGI event loop
        def sync_stream_iter():
            return self._client.models.generate_content_stream(
                model=self.model,
                contents=contents_payload,
                config=config,
            )

        loop = asyncio.get_running_loop()
        stream = await loop.run_in_executor(None, sync_stream_iter)

        for chunk in stream:
            if hasattr(chunk, "text") and chunk.text:
                yield chunk.text


class MockAIProvider(AIProviderInterface):
    """Deterministic Mock AI Provider for testing and local development without Gemini keys."""

    def __init__(self, simulated_response: Optional[str] = None):
        self.simulated_response = simulated_response or (
            "I hear how much that is weighing on you. Thank you for giving yourself permission to voice it. "
            "Let us take a slow, gentle breath together and give yourself space right now."
        )

    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        return self.simulated_response

    async def generate_response_stream(
        self, prompt: str, system_prompt: Optional[str] = None, history: Optional[List[Dict[str, Any]]] = None
    ) -> AsyncIterator[str]:
        words = self.simulated_response.split(" ")
        for i, word in enumerate(words):
            await asyncio.sleep(0.02)
            yield word + (" " if i < len(words) - 1 else "")


# Singleton reference or override for tests
_custom_ai_provider: Optional[AIProviderInterface] = None


def set_custom_ai_provider(provider: Optional[AIProviderInterface]) -> None:
    """Override AI provider (used by test suites)."""
    global _custom_ai_provider
    _custom_ai_provider = provider


def get_ai_provider() -> AIProviderInterface:
    """Factory to retrieve configured AI provider."""
    global _custom_ai_provider
    if _custom_ai_provider is not None:
        return _custom_ai_provider

    provider_name = settings.AI_PROVIDER.lower()
    if provider_name == "gemini":
        return GeminiProvider()
    elif provider_name == "mock":
        return MockAIProvider()
    else:
        raise SolaceException(
            message=f"Unsupported AI provider: {provider_name}",
            status_code=500,
            code="UNSUPPORTED_AI_PROVIDER",
        )
