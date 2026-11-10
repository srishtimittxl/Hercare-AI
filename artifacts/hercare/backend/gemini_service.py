"""
Google Gemini Response-Generation Service for HerCare AI (UCS760)
Uses the official Google GenAI Python SDK (`google-genai`).

Key Architecture & Safety Principles:
1. Reads `GEMINI_API_KEY` and `GEMINI_MODEL` strictly from `backend/.env` / server environment.
   Never exposes the API key to clients or logs.
2. Operates as a grounded response-generation engine fed by the 7-stage NLP pipeline:
   - User question & conversation context
   - Predicted intent & confidence (TF-IDF + Logistic Regression)
   - Extracted entities & accumulated multi-turn session slots
   - NLTK VADER sentiment score & empathetic tone directive
   - Retrieved knowledge-base answer, Indian wellness tip, safety warning, and cited sources
3. Pre-response Emergency Guardrail:
   - Emergency safety checks (`is_emergency=True`) run BEFORE Gemini and CANNOT be overridden.
4. Strict Clinical Guardrails:
   - Never diagnoses conditions, never prescribes medication, and never invents medical facts or URLs.
5. Graceful Fallback:
   - Automatically falls back to deterministic grounded synthesis when `GEMINI_API_KEY` is missing,
     invalid, rate-limited (HTTP 429), or unreachable.
"""

import json
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

BACKEND_DIR: Path = Path(__file__).resolve().parent
ENV_PATH: Path = (BACKEND_DIR / ".env").resolve()

DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"
FALLBACK_GEMINI_MODELS = (
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
)

_PLACEHOLDER_KEYS = {
    "",
    "your_api_key_here",
    "your_key_here",
    "your_gemini_api_key",
    "paste_your_api_key_here",
    "none",
    "null",
    "changeme",
}


def _load_backend_env() -> None:
    """
    Loads `backend/.env` using an absolute path derived from `__file__`,
    regardless of the current working directory from which Uvicorn is launched.
    """
    if ENV_PATH.is_file():
        load_dotenv(dotenv_path=str(ENV_PATH), override=True)


# Load backend/.env at module import
_load_backend_env()

SYSTEM_INSTRUCTION = """You are HerCare AI, an empathetic, evidence-based Women's Wellness Conversational Assistant.
You MUST follow these strict clinical and academic safety rules at all times:
1. GROUNDING ONLY: Base all medical and wellness explanations strictly on the provided 'Retrieved Knowledge-Base Entry' and 'Indian Wellness Tip'. Do NOT invent medical facts, clinical statistics, or external URLs.
2. NO DIAGNOSIS OR PRESCRIPTION: Never diagnose any medical condition and never prescribe medications, hormones, or drug dosages.
3. EMERGENCY NON-OVERRIDE: Never downplay urgent red-flag symptoms.
4. CONTEXTUAL PERSONALIZATION: Tailor your tone to the provided 'VADER Sentiment & Tone Directive' and acknowledge the user's 'Accumulated Conversation Slots' (cycle phase, symptoms, severity, duration, mood, known conditions, dietary preference).
5. SLOT FILLING: If a 'Follow-up Clarification Question' is provided, weave it naturally near the end of your response.
6. MANDATORY SAFETY & SOURCES: Always include the provided 'Medical Safety Warning' and list the exact 'Cited Sources' (Name and URL) at the end of your response."""


class HerCareGeminiService:
    """
    Wrapper around the official `google-genai` SDK for grounded response generation
    with full fallback and error classification.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        client: Optional[Any] = None,
    ) -> None:
        _load_backend_env()
        self._explicit_api_key = api_key
        self._explicit_model_name = model_name
        self.model_name = (
            model_name
            or os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip()
            or DEFAULT_GEMINI_MODEL
        )
        self._injected_client = client

    def _get_api_key(self) -> str:
        if self._explicit_api_key is not None:
            return self._explicit_api_key.strip().strip("\"'")
        _load_backend_env()
        if not self._explicit_model_name:
            env_model = os.getenv("GEMINI_MODEL", "").strip().strip("\"'")
            if env_model:
                self.model_name = env_model
        return os.getenv("GEMINI_API_KEY", "").strip().strip("\"'")

    def is_configured(self) -> bool:
        """Returns True if a non-placeholder GEMINI_API_KEY or injected client is present."""
        if self._injected_client is not None:
            return True
        key = self._get_api_key()
        if not key or key.lower() in _PLACEHOLDER_KEYS or key.startswith("<"):
            return False
        return True

    def _get_client(self) -> Any:
        if self._injected_client is not None:
            return self._injected_client
        key = self._get_api_key()
        if not key:
            raise ValueError("GEMINI_API_KEY is not set in backend/.env")
        return genai.Client(api_key=key)

    @staticmethod
    def build_grounded_prompt(
        user_query: str,
        conversation_history: List[Dict[str, str]],
        intent_info: Dict[str, Any],
        turn_entities: Dict[str, Any],
        accumulated_slots: Dict[str, Any],
        slot_status: Dict[str, Any],
        sentiment_info: Dict[str, Any],
        retrieval_info: Dict[str, Any],
    ) -> str:
        """Constructs the structured grounding prompt combining all NLP pipeline signals."""
        recent_turns = conversation_history[-4:] if conversation_history else []
        history_str = (
            "\n".join(
                f"- {m.get('role', 'user').upper()}: {m.get('content', '')}"
                for m in recent_turns
            )
            if recent_turns
            else "None (first turn)"
        )

        sources_list = retrieval_info.get("sources") or []
        sources_formatted = "\n".join(
            f"- [{s.get('name', 'Source')}]({s.get('url', '')})" for s in sources_list
        )

        follow_up = slot_status.get("follow_up_prompt") or "None required"

        return f"""### USER QUESTION
{user_query}

### RECENT CONVERSATION CONTEXT
{history_str}

### NLP PIPELINE SIGNALS
- Predicted Intent: {intent_info.get('predicted_intent')} (confidence: {intent_info.get('confidence')})
- Current Turn Entities: {json.dumps(turn_entities)}
- Accumulated Session Slots: {json.dumps(accumulated_slots)}
- VADER Sentiment: {sentiment_info.get('label')} (compound: {sentiment_info.get('compound')})
- Empathetic Tone Directive: {sentiment_info.get('recommended_tone')}
- Follow-up Clarification Question: {follow_up}

### RETRIEVED KNOWLEDGE-BASE ENTRY (GROUND TRUTH)
- KB ID & Topic: {retrieval_info.get('kb_id')} — {retrieval_info.get('topic')}
- Matched Reliable Entry: {retrieval_info.get('matched')}
- Core Evidence-Based Answer: {retrieval_info.get('answer')}
- Indian Wellness & Ayurvedic Tip: {retrieval_info.get('indian_wellness_tip')}
- Mandatory Medical Safety Warning: {retrieval_info.get('safety_warning')}
- Mandatory Cited Sources:
{sources_formatted}

### INSTRUCTIONS
Write a warm, empathetic, well-structured response for the user that:
1. Opens with empathy matching the VADER sentiment and acknowledges the user's accumulated context (cycle phase, symptoms, mood, conditions, diet).
2. Explains the core evidence-based answer clearly using ONLY facts from the Retrieved Knowledge-Base Entry.
3. Includes the Indian Wellness & Ayurvedic Tip tailored to their cycle phase and diet preference.
4. Includes the Follow-up Clarification Question if one is listed above.
5. Ends with the Mandatory Medical Safety Warning and the exact Cited Sources in markdown link format."""

    @staticmethod
    def _ensure_safety_and_sources(
        generated_text: str, retrieval_info: Dict[str, Any]
    ) -> str:
        """
        Post-generation guardrail: guarantees that the medical safety warning
        and cited source URLs are present and unaltered.
        """
        text = generated_text.strip()
        safety_warning = retrieval_info.get("safety_warning", "")
        sources = retrieval_info.get("sources") or []

        if safety_warning and "medical safety" not in text.lower() and safety_warning[:40].lower() not in text.lower():
            text += f"\n\n🩺 **Medical Safety Note:** {safety_warning}"

        missing_sources = [
            s for s in sources if s.get("url") and s["url"] not in text
        ]
        if missing_sources:
            source_lines = [f"- [{s['name']}]({s['url']})" for s in sources]
            text += "\n\n📚 **Evidence Sources:**\n" + "\n".join(source_lines)

        return text

    def _generate_with_model_fallback(
        self,
        client: Any,
        contents: str,
        config: types.GenerateContentConfig,
    ) -> tuple[Any, str]:
        """
        Calls `client.models.generate_content` with `self.model_name`.
        If the configured model ID returns HTTP 404 (e.g., a retired model name),
        automatically retries with active Gemini Flash models.
        """
        candidate_models = [self.model_name]
        if self._injected_client is None:
            for fb_model in FALLBACK_GEMINI_MODELS:
                if fb_model not in candidate_models:
                    candidate_models.append(fb_model)

        last_exc: Optional[Exception] = None
        for idx, model_id in enumerate(candidate_models):
            try:
                res = client.models.generate_content(
                    model=model_id,
                    contents=contents,
                    config=config,
                )
                return res, model_id
            except Exception as exc:
                last_exc = exc
                reason = self._classify_error(exc)
                # Only try fallback model names if the model ID itself returned 404
                if reason == "gemini_api_error_404" and idx < len(candidate_models) - 1:
                    continue
                raise
        assert last_exc is not None
        raise last_exc

    @staticmethod
    def _classify_error(exc: Exception) -> str:
        msg = str(exc).lower()
        if isinstance(exc, ValueError) and "gemini_api_key" in msg:
            return "missing_api_key"
        if isinstance(exc, genai_errors.APIError):
            code = getattr(exc, "code", None)
            if code in (401, 403) or "api_key_invalid" in msg or "invalid api key" in msg or "permission_denied" in msg:
                return "invalid_api_key"
            if code == 429 or "resource_exhausted" in msg or "quota" in msg or "rate" in msg:
                return "rate_limited"
            return f"gemini_api_error_{code or 'unknown'}"
        if "401" in msg or "403" in msg or "api_key_invalid" in msg or "invalid api key" in msg:
            return "invalid_api_key"
        if "429" in msg or "quota" in msg or "rate limit" in msg or "resource_exhausted" in msg:
            return "rate_limited"
        return "gemini_unavailable"

    def generate_grounded_response(
        self,
        user_query: str,
        conversation_history: List[Dict[str, str]],
        intent_info: Dict[str, Any],
        turn_entities: Dict[str, Any],
        accumulated_slots: Dict[str, Any],
        slot_status: Dict[str, Any],
        sentiment_info: Dict[str, Any],
        retrieval_info: Dict[str, Any],
        safety_check: Dict[str, Any],
        fallback_composer: Callable[[], str],
    ) -> Dict[str, Any]:
        """
        Generates a response using Google Gemini when configured and safe.
        CRITICAL SAFETY RULE:
        - Emergency checks run BEFORE Gemini. If `safety_check["is_emergency"]` is True,
          Gemini is bypassed so it can NEVER override or soften an emergency medical warning.
        - If `GEMINI_API_KEY` is missing, invalid, rate-limited, or Gemini is unreachable,
          gracefully falls back to `fallback_composer()`.
        """
        # 1. Pre-Gemini Emergency Lock: Never let an LLM override an emergency warning
        if safety_check.get("is_emergency"):
            return {
                "response_text": fallback_composer(),
                "engine": "deterministic_emergency_guardrail",
                "model": None,
                "gemini_used": False,
                "fallback_reason": "emergency_safety_lock",
            }

        # 2. Check if API key / client is configured
        if not self.is_configured():
            return {
                "response_text": fallback_composer(),
                "engine": "deterministic_nlp_kb",
                "model": None,
                "gemini_used": False,
                "fallback_reason": "missing_api_key",
            }

        prompt = self.build_grounded_prompt(
            user_query=user_query,
            conversation_history=conversation_history,
            intent_info=intent_info,
            turn_entities=turn_entities,
            accumulated_slots=accumulated_slots,
            slot_status=slot_status,
            sentiment_info=sentiment_info,
            retrieval_info=retrieval_info,
        )

        try:
            client = self._get_client()
            response, used_model = self._generate_with_model_fallback(
                client=client,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.25,
                    max_output_tokens=700,
                ),
            )
            raw_text = getattr(response, "text", None)
            if not raw_text or not raw_text.strip():
                return {
                    "response_text": fallback_composer(),
                    "engine": "deterministic_nlp_kb",
                    "model": used_model,
                    "gemini_used": False,
                    "fallback_reason": "empty_gemini_response",
                }

            safe_text = self._ensure_safety_and_sources(
                raw_text, retrieval_info
            )
            return {
                "response_text": safe_text,
                "engine": "google_gemini",
                "model": used_model,
                "gemini_used": True,
                "fallback_reason": None,
            }
        except Exception as exc:
            reason = self._classify_error(exc)
            return {
                "response_text": fallback_composer(),
                "engine": "deterministic_nlp_kb",
                "model": self.model_name,
                "gemini_used": False,
                "fallback_reason": reason,
            }

    def test_connection(self) -> Dict[str, Any]:
        """Tests live connectivity with the configured GEMINI_API_KEY."""
        if not self.is_configured():
            return {
                "ok": False,
                "reason": "missing_api_key",
                "model": self.model_name,
            }
        try:
            client = self._get_client()
            res, used_model = self._generate_with_model_fallback(
                client=client,
                contents="Reply with the single word: READY",
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=16,
                ),
            )
            return {
                "ok": True,
                "reason": None,
                "model": used_model,
                "reply": (getattr(res, "text", "") or "").strip(),
            }
        except Exception as exc:
            return {
                "ok": False,
                "reason": self._classify_error(exc),
                "model": self.model_name,
            }
