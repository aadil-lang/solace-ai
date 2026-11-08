"""
Solace AI - Live Gemini API Verification Script
Tests connecting to Google Gemini using google-genai SDK, verifying response generation and streaming.
"""
import os
import sys
import asyncio

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.services.ai_provider import GeminiProvider


async def verify_gemini():
    print("==================================================================")
    print("SOLACE AI - GOOGLE GEMINI LIVE CONNECTIVITY & STREAMING")
    print("==================================================================")
    print(f"Model: {settings.AI_MODEL}")
    print(f"Key configured: {'YES (' + settings.GEMINI_API_KEY[:6] + '...)' if settings.GEMINI_API_KEY else 'NO'}")

    provider = GeminiProvider()

    # 1. Single generation
    print("\n[1/2] Testing Single Content Generation:")
    try:
        system_instruction = (
            "You are Solace, an empathetic, calm, emotionally intelligent wellness companion. "
            "Acknowledge the user gently in one sentence."
        )
        prompt = "Hello Solace, I had a very long and exhausting day."
        print(f"   Prompt: '{prompt}'")
        res = await provider.generate_response(prompt=prompt, system_prompt=system_instruction)
        print(f"   ✓ Gemini Response received:\n   \"{res.strip()}\"")
    except Exception as e:
        print(f"   ❌ Single generation failed: {e}")
        return False

    # 2. Streaming generation
    print("\n[2/2] Testing Token Streaming:")
    try:
        chunks = []
        async for chunk in provider.generate_response_stream(
            prompt="Can you give me one gentle grounding thought?",
            system_prompt=system_instruction
        ):
            chunks.append(chunk)
            print(chunk, end="", flush=True)
        print()
        assert len(chunks) > 0, "No chunks received from stream"
        print(f"   ✓ Streaming verified! Received {len(chunks)} token chunks.")
    except Exception as e:
        print(f"\n   ❌ Streaming failed: {e}")
        return False

    print("\n==================================================================")
    print("✓ GOOGLE GEMINI LIVE INTEGRATION VERIFIED SUCCESSFULLY!")
    print("==================================================================")
    return True


if __name__ == "__main__":
    ok = asyncio.run(verify_gemini())
    sys.exit(0 if ok else 1)

