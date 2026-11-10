"""
Test Suite for Google Gemini API (`google-genai`) Integration & Home Recommendations
====================================================================================
Tests:
1. Grounded prompt construction & Mocked Gemini response (`stream=False` & `stream=True` SSE)
2. Pre-Gemini Emergency Safety Lock (verifies Gemini NEVER overrides emergency red-flag warnings)
3. Graceful error handling (missing API key, invalid API key 401, rate limit 429, unavailable 503)
4. Home Screen `POST /api/recommendations` endpoint (4 personalized Indian wellness cards)
5. Conditional Real Gemini API Connection Test (runs only when a valid `GEMINI_API_KEY` is set)
"""

from __future__ import annotations

import json
from typing import Any
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.gemini_service import HerCareGeminiService
from backend.main import app


class MockGeminiModels:
    """Mock implementation of `google.genai.Client.models`."""

    def __init__(self, response_text: str | None = None, raise_exc: Exception | None = None) -> None:
        self.response_text = response_text
        self.raise_exc = raise_exc
        self.calls: list[dict[str, Any]] = []

    def generate_content(self, *, model: str, contents: str, config: Any = None) -> Any:
        self.calls.append({"model": model, "contents": contents, "config": config})
        if self.raise_exc is not None:
            raise self.raise_exc

        class _Resp:
            text = self.response_text

        return _Resp()


class MockGeminiClient:
    """Mock `google.genai.Client` wrapper."""

    def __init__(self, response_text: str | None = None, raise_exc: Exception | None = None) -> None:
        self.models = MockGeminiModels(response_text=response_text, raise_exc=raise_exc)


def parse_sse_stream(raw_sse: str) -> tuple[str, list[dict[str, Any]], bool]:
    """Reconstructs assistant message from OpenAI-compatible SSE stream."""
    chunks: list[dict[str, Any]] = []
    full_text = ""
    saw_done = False

    for line in raw_sse.splitlines():
        stripped = line.strip()
        if not stripped.startswith("data: "):
            continue
        payload = stripped[6:]
        if payload == "[DONE]":
            saw_done = True
            continue
        parsed = json.loads(payload)
        chunks.append(parsed)
        delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
        full_text += delta

    return full_text, chunks, saw_done


def run_gemini_integration_tests() -> None:
    client = TestClient(app)
    original_service = main_module.gemini_service

    print("=" * 95)
    print("HERCARE AI - GOOGLE GEMINI (`google-genai`) & RECOMMENDATIONS TEST SUITE")
    print("=" * 95)

    try:
        # ------------------------------------------------------------------
        # 1. Mocked Gemini Response Test (stream=False JSON & stream=True SSE)
        # ------------------------------------------------------------------
        mock_reply = (
            "I hear how uncomfortable those severe cramps and lower back pain are on Day 2 of your "
            "menstrual phase. Primary dysmenorrhea happens when prostaglandins trigger uterine muscle "
            "contractions.\n\n"
            "**What You Can Do Right Now**\n"
            "- Place a warm heating pad on your lower abdomen or lower back for 15–20 minutes.\n"
            "- Sip warm ajwain (carom seed) or ginger-jaggery water and rest in Supta Baddha Konasana."
        )
        mock_client = MockGeminiClient(response_text=mock_reply)
        mock_service = HerCareGeminiService(
            api_key="AIzaSyMOCK_VALID_KEY_FOR_TESTING",
            model_name="gemini-2.5-flash",
            client=mock_client,
        )
        main_module.gemini_service = mock_service

        res_json = client.post(
            "/api/chat",
            json={
                "session_id": "test_gemini_mock_session",
                "stream": False,
                "cycle_phase": "Menstrual",
                "dietary_preference": "vegetarian",
                "messages": [
                    {
                        "role": "user",
                        "content": "I have severe period cramps and lower back pain for 2 days, feeling exhausted",
                    }
                ],
            },
        )
        assert res_json.status_code == 200, f"Expected 200, got {res_json.status_code}"
        body = res_json.json()

        # Verify Gemini was called with all grounded NLP context
        assert len(mock_client.models.calls) == 1
        sent_prompt = mock_client.models.calls[0]["contents"]
        assert "period_pain_relief" in sent_prompt, "Prompt must include predicted intent"
        assert "cramps" in sent_prompt, "Prompt must include extracted symptoms"
        assert "Negative" in sent_prompt, "Prompt must include VADER sentiment"
        assert "kb_005" in sent_prompt, "Prompt must include retrieved KB ID"
        assert "acog.org" in sent_prompt, "Prompt must include retrieved KB source URLs"

        # Verify response metadata & post-generation safety/source enforcement
        gen_meta = body["generation"]
        assert gen_meta["engine"] == "google_gemini"
        assert gen_meta["gemini_used"] is True
        assert gen_meta["model"] == "gemini-2.5-flash"
        assert gen_meta["fallback_reason"] is None
        assert "prostaglandins" in body["response"]
        assert "Medical Safety Note" in body["response"], "Post-check must append safety warning if omitted by LLM"
        assert "acog.org" in body["response"], "Post-check must append verified KB sources if omitted by LLM"

        # Test stream=True SSE with Mocked Gemini
        res_sse = client.post(
            "/api/chat",
            json={
                "session_id": "test_gemini_mock_session",
                "stream": True,
                "messages": [
                    {
                        "role": "user",
                        "content": "What vegetarian iron rich food should I eat for this fatigue?",
                    }
                ],
            },
        )
        assert res_sse.status_code == 200
        assert "text/event-stream" in res_sse.headers.get("content-type", "")
        sse_text, sse_chunks, saw_done = parse_sse_stream(res_sse.text)
        assert saw_done is True
        assert len(sse_chunks) >= 3
        assert "prostaglandins" in sse_text
        assert "Medical Safety Note" in sse_text

        print("\n[1] Mocked Gemini Response Test (Grounded Prompt + JSON + SSE Streaming):")
        print(f"    Engine Used           : {gen_meta['engine']} ({gen_meta['model']})")
        print(f"    Prompt Grounding      : Intent, Entities, Slots, Sentiment, KB Entry & Sources verified")
        print(f"    SSE Chunks Streamed   : {len(sse_chunks)} chunks | [DONE]={saw_done}")
        print("    Status                : PASS")

        # ------------------------------------------------------------------
        # 2. Pre-Gemini Emergency Safety Lock Test (Non-Override Guarantee)
        # ------------------------------------------------------------------
        calls_before_emergency = len(mock_client.models.calls)
        res_emerg = client.post(
            "/api/chat",
            json={
                "session_id": "test_gemini_emergency_lock",
                "stream": False,
                "messages": [
                    {
                        "role": "user",
                        "content": "I am soaking through a pad every hour for 3 hours and feeling dizzy and faint",
                    }
                ],
            },
        )
        assert res_emerg.status_code == 200
        emerg_body = res_emerg.json()
        calls_after_emergency = len(mock_client.models.calls)

        assert emerg_body["safety_check"]["is_emergency"] is True
        assert emerg_body["retrieval"]["kb_id"] == "kb_015"
        assert emerg_body["generation"]["engine"] == "deterministic_emergency_guardrail"
        assert emerg_body["generation"]["gemini_used"] is False
        assert emerg_body["generation"]["fallback_reason"] == "emergency_safety_lock"
        assert calls_after_emergency == calls_before_emergency, (
            "Gemini must NEVER be called when emergency safety check triggers!"
        )
        assert "URGENT MEDICAL SAFETY" in emerg_body["response"]

        print("\n[2] Pre-Gemini Emergency Safety Check (Non-Override Guarantee):")
        print(
            f"    Safety Triggered      : is_emergency={emerg_body['safety_check']['is_emergency']} (KB={emerg_body['retrieval']['kb_id']})"
        )
        print(f"    Generation Engine     : {emerg_body['generation']['engine']}")
        print(f"    Gemini Invoked?       : False (Calls before={calls_before_emergency}, after={calls_after_emergency})")
        print("    Status                : PASS")

        # ------------------------------------------------------------------
        # 3. Graceful Error Handling Tests (Missing, Invalid, Rate-Limited, Down)
        # ------------------------------------------------------------------
        error_scenarios = [
            (
                "Missing API Key",
                HerCareGeminiService(api_key="", model_name="gemini-2.5-flash", client=None),
                "missing_api_key",
            ),
            (
                "Invalid API Key (401/403)",
                HerCareGeminiService(
                    api_key="AIzaINVALID",
                    model_name="gemini-2.5-flash",
                    client=MockGeminiClient(raise_exc=RuntimeError("401 UNAUTHENTICATED: API_KEY_INVALID")),
                ),
                "invalid_api_key",
            ),
            (
                "Rate Limited (429 Quota)",
                HerCareGeminiService(
                    api_key="AIzaQUOTA",
                    model_name="gemini-2.5-flash",
                    client=MockGeminiClient(raise_exc=RuntimeError("429 RESOURCE_EXHAUSTED: Quota exceeded")),
                ),
                "rate_limited",
            ),
            (
                "Service Unavailable (503)",
                HerCareGeminiService(
                    api_key="AIzaDOWN",
                    model_name="gemini-2.5-flash",
                    client=MockGeminiClient(raise_exc=ConnectionError("503 Service Unavailable")),
                ),
                "gemini_unavailable",
            ),
        ]

        print("\n[3] Graceful Error Handling & Grounded Fallback Verification:")
        for label, err_service, expected_reason in error_scenarios:
            main_module.gemini_service = err_service
            res_err = client.post(
                "/api/chat",
                json={
                    "session_id": f"test_err_{expected_reason}",
                    "stream": False,
                    "messages": [{"role": "user", "content": "What are the common symptoms of PCOS?"}],
                },
            )
            assert res_err.status_code == 200
            err_body = res_err.json()
            assert err_body["generation"]["gemini_used"] is False
            assert err_body["generation"]["fallback_reason"] == expected_reason
            assert err_body["retrieval"]["kb_id"] in {"kb_008", "kb_009"}
            assert len(err_body["response"]) > 100
            assert "Medical Safety Note" in err_body["response"]
            print(
                f"    - {label:<26} -> HTTP 200 | fallback_reason='{expected_reason}' | KB={err_body['retrieval']['kb_id']} [PASS]"
            )

        # ------------------------------------------------------------------
        # 4. Home Screen `POST /api/recommendations` Endpoint Test
        # ------------------------------------------------------------------
        res_recs = client.post(
            "/api/recommendations",
            json={
                "phase": "Luteal",
                "cycleDay": 22,
                "recentMoods": ["Anxious", "Irritable"],
                "recentSymptoms": [
                    {"symptom": "Bloating", "severity": 3},
                    {"symptom": "Cramps", "severity": 2},
                ],
                "healthProfile": {
                    "dietType": "vegetarian",
                    "diagnosedConditions": ["PCOS / PCOD"],
                    "stressLevel": "high",
                },
            },
        )
        assert res_recs.status_code == 200
        recs_data = res_recs.json()
        assert "recommendations" in recs_data
        recs_list = recs_data["recommendations"]
        assert len(recs_list) == 4
        categories = {r["category"] for r in recs_list}
        assert categories == {"diet", "exercise", "self-care", "supplement"}

        print("\n[4] Home Screen `POST /api/recommendations` Endpoint Verification:")
        for rec in recs_list:
            print(f"    - [{rec['category'].upper():<10}] {rec['title']} (icon={rec['icon']})")
        print("    Status                : PASS")

        # ------------------------------------------------------------------
        # 5. Conditional Live Gemini API Connection Test
        # ------------------------------------------------------------------
        live_service = HerCareGeminiService()
        main_module.gemini_service = live_service
        print("\n[5] Conditional Real Google Gemini API Connection Test:")
        print(f"    configured: {str(live_service.is_configured()).lower()}")
        if live_service.is_configured():
            live_status = live_service.test_connection()
            print(f"    Model                 : {live_service.model_name}")
            print(f"    Live Connection Result: ok={live_status['ok']} | reason={live_status.get('reason')}")
            if live_status["ok"]:
                print("    Status                : PASS (Live Gemini API verified)")
            else:
                print(
                    f"    Status                : GRACEFUL FALLBACK ({live_status.get('reason')})"
                )
        else:
            print("    Action                : Skipped live network call safely; deterministic grounded fallback active.")
            print("    Status                : SKIPPED (Graceful Fallback Mode)")

    finally:
        main_module.gemini_service = original_service

    print("\n" + "=" * 95)
    print("ALL GEMINI INTEGRATION, SAFETY NON-OVERRIDE & RECOMMENDATIONS TESTS PASSED!")
    print("=" * 95)


if __name__ == "__main__":
    run_gemini_integration_tests()
