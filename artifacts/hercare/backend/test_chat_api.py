"""
API Integration Tests for `/api/chat` and `/health` in `backend/main.py` (UCS760)
Tests:
1. GET /health preservation
2. Normal women's wellness queries (both structured JSON and OpenAI-compatible SSE streaming)
3. Multi-turn stateful conversation using `session_id` (slot accumulation across turns)
4. Out-of-domain query handling (safe fallback `kb_fallback`)
5. Emergency medical safety warning (`is_emergency=True`, `kb_015`)
"""

import json
from fastapi.testclient import TestClient

from backend.main import app


def parse_sse_response(raw_sse_text: str):
    """Parses SSE stream lines identically to `app/(tabs)/chat.tsx`."""
    accumulated = ""
    nlp_metadata = None
    saw_done = False

    for line in raw_sse_text.split("\n"):
        if line.startswith("data: "):
            data = line[6:].strip()
            if data == "[DONE]":
                saw_done = True
                continue
            parsed = json.loads(data)
            delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content")
            if delta:
                accumulated += delta
            if "nlp_metadata" in parsed:
                nlp_metadata = parsed["nlp_metadata"]

    return accumulated, nlp_metadata, saw_done


def main() -> None:
    client = TestClient(app)

    print("=" * 84)
    print("HERCARE AI - /api/chat ENDPOINT & 7-STAGE PIPELINE INTEGRATION TESTS (UCS760)")
    print("=" * 84)

    # 1. Test GET /health
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"
    print(f"\n[Test 1: GET /health] Status={health_res.status_code} | Body={health_res.json()} [PASS]")

    # 2. Test Normal Query via OpenAI-compatible SSE stream (default frontend format)
    sse_res = client.post(
        "/api/chat",
        json={
            "session_id": "test_normal_sse",
            "messages": [
                {
                    "role": "user",
                    "content": "What causes severe cramps during my period and what helps relieve them?",
                }
            ],
        },
    )
    assert sse_res.status_code == 200
    assert "text/event-stream" in sse_res.headers["content-type"]
    sse_text, sse_meta, saw_done = parse_sse_response(sse_res.text)
    assert saw_done is True
    assert len(sse_text) > 100
    assert sse_meta["intent"]["predicted_intent"] == "period_pain_relief"
    assert sse_meta["retrieval"]["kb_id"] == "kb_005"
    print("\n[Test 2: Normal Query - Frontend OpenAI SSE Stream Format] [PASS]")
    print(f"  Intent           : {sse_meta['intent']['predicted_intent']} ({sse_meta['intent']['confidence']:.2f})")
    print(f"  Entities         : symptoms={sse_meta['entities']['symptoms']}, severity={sse_meta['entities']['severity']}, phase={sse_meta['entities']['cycle_phase']}")
    print(f"  Sentiment        : {sse_meta['sentiment']['label']} (compound={sse_meta['sentiment']['compound']:+.4f}, tone={sse_meta['sentiment']['recommended_tone']})")
    print(f"  Retrieved KB     : {sse_meta['retrieval']['kb_id']} - {sse_meta['retrieval']['topic']}")
    print(f"  SSE Streamed Len : {len(sse_text)} chars | [DONE] received={saw_done}")
    print(f"  Stream Preview   : {sse_text[:180].replace(chr(10), ' ')}...")

    # 3. Test Multi-Turn Conversation with Session ID (Slot Accumulation)
    session_id = "test_multiturn_session"
    client.delete(f"/api/chat/session/{session_id}")

    multiturn_queries = [
        "I am in my luteal phase and feeling super anxious and bloated for 4 days.",
        "I also have PCOS and follow an Indian vegetarian diet.",
        "What should I eat right now to help with my cravings?",
    ]

    print(f"\n[Test 3: Multi-Turn Context & Slot Persistence (session_id='{session_id}')]")
    for idx, q in enumerate(multiturn_queries, 1):
        res = client.post(
            "/api/chat",
            json={
                "session_id": session_id,
                "message": q,
                "stream": False,
            },
        )
        assert res.status_code == 200
        body = res.json()
        print(f"  Turn {idx} Query     : \"{q}\"")
        print(f"    Predicted Intent : {body['intent']['predicted_intent']} ({body['intent']['confidence']:.2f})")
        print(f"    Sentiment        : {body['sentiment']['label']} ({body['sentiment']['compound']:+.4f})")
        print(f"    Session Slots    : {body['slots']}")
        print(f"    Retrieved KB     : {body['retrieval']['kb_id']} - {body['retrieval']['topic']}")
        if idx == 3:
            # Verify Turn 3 remembers Luteal phase, Vegetarian diet, PCOS, Bloating, Anxious from Turns 1 & 2!
            assert body["slots"]["cycle_phase"] == "Luteal"
            assert body["slots"]["dietary_preference"] == "Vegetarian"
            assert "PCOS" in body["slots"]["medical_conditions"]
            assert "Bloating" in body["slots"]["symptoms"]
            assert "Anxious" in body["slots"]["mood"]
            assert body["retrieval"]["kb_id"] == "kb_003"
            print("    Multi-Turn Check : Verified slots persisted across 3 turns and selected Luteal Nutrition (kb_003)! [PASS]")

    # 4. Test Out-of-Domain Query (Safe Fallback)
    ood_res = client.post(
        "/api/chat",
        json={
            "session_id": "test_ood_session",
            "message": "How do I configure a Kubernetes ingress controller with Nginx?",
            "stream": False,
        },
    )
    assert ood_res.status_code == 200
    ood_body = ood_res.json()
    assert ood_body["retrieval"]["matched"] is False
    assert ood_body["retrieval"]["kb_id"] == "kb_fallback"
    print("\n[Test 4: Out-of-Domain Query Safe Fallback] [PASS]")
    print(f"  Query            : \"{ood_body['query']}\"")
    print(f"  Matched KB       : {ood_body['retrieval']['matched']} ({ood_body['retrieval']['kb_id']})")
    print(f"  Fallback Preview : {ood_body['response'][:180].replace(chr(10), ' ')}...")

    # 5. Test Emergency Red-Flag Query
    emerg_res = client.post(
        "/api/chat",
        json={
            "session_id": "test_emergency_session",
            "message": "I am soaking through a pad every hour with golf ball sized blood clots and I feel dizzy and faint.",
            "stream": False,
        },
    )
    assert emerg_res.status_code == 200
    emerg_body = emerg_res.json()
    assert emerg_body["safety_check"]["is_emergency"] is True
    assert emerg_body["retrieval"]["kb_id"] == "kb_015"
    print("\n[Test 5: Emergency Medical Safety Check] [PASS]")
    print(f"  Query            : \"{emerg_body['query']}\"")
    print(f"  Is Emergency     : {emerg_body['safety_check']['is_emergency']} | Triggers: {emerg_body['safety_check']['triggers']}")
    print(f"  Retrieved KB     : {emerg_body['retrieval']['kb_id']} - {emerg_body['retrieval']['topic']}")
    print(f"  Response Preview : {emerg_body['response'][:200].replace(chr(10), ' ')}...")
    print(f"  Sources Count    : {len(emerg_body['sources'])} cited clinical sources")

    print("\n" + "=" * 84)
    print("ALL 5 API TEST SUITES PASSED SUCCESSFULLY!")
    print("=" * 84)


if __name__ == "__main__":
    main()
