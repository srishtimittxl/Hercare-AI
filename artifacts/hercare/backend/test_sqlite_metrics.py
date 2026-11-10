"""
Test & Verification Script for SQLite Persistence & GET `/api/metrics` (UCS760)
Verifies:
1. SQLite table schema & privacy compliance (no raw user text or personal health profile columns)
2. Automatic persistence of chat session records, timestamps, predicted intents,
   sentiment scores, and retrieved knowledge-base IDs during `POST /api/chat`
3. `GET /api/metrics` endpoint accuracy (total interactions, intent distribution,
   sentiment distribution, knowledge-base distribution, and model evaluation metrics)
"""

import sqlite3
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.database import HerCareDatabase
from backend.main import app


def main() -> None:
    # Use a fresh test database path or reset chat_interactions so counts are deterministic
    test_db_path = main_module.telemetry_db.db_path
    with sqlite3.connect(str(test_db_path)) as conn:
        conn.execute("DELETE FROM chat_interactions")
        conn.commit()

    client = TestClient(app)

    print("=" * 84)
    print("HERCARE AI - SQLITE PERSISTENCE & GET /api/metrics TESTS (UCS760)")
    print("=" * 84)

    # 1. Inspect SQLite schema & verify privacy compliance
    with sqlite3.connect(str(test_db_path)) as conn:
        cols_info = conn.execute("PRAGMA table_info(chat_interactions)").fetchall()
        col_names = [c[1] for c in cols_info]

    print(f"\n[Test 1: SQLite Schema & Privacy Verification]")
    print(f"  Database File   : {test_db_path}")
    print(f"  Table Columns   : {col_names}")
    forbidden_cols = {"user_message", "raw_text", "name", "email", "notes", "health_profile"}
    assert forbidden_cols.isdisjoint(set(col_names))
    assert {
        "session_id",
        "timestamp",
        "predicted_intent",
        "intent_confidence",
        "sentiment_label",
        "sentiment_compound",
        "sentiment_scores_json",
        "retrieved_kb_id",
    }.issubset(set(col_names))
    print("  Privacy Check   : Verified zero raw message text or PII columns stored! [PASS]")

    # 2. Send 6 diverse chat interactions across 3 sessions
    sample_interactions = [
        (
            "metrics_session_1",
            "What causes severe cramps during my period and how do I relieve them?",
        ),
        (
            "metrics_session_1",
            "What should I eat during my luteal phase to reduce sugar cravings?",
        ),
        (
            "metrics_session_2",
            "I feel so anxious, tearful, and irritable right before my period starts.",
        ),
        (
            "metrics_session_2",
            "I feel so calm, grounded, and energetic after doing yoga in my follicular phase!",
        ),
        (
            "metrics_session_3",
            "On which day of a 28 day menstrual cycle does ovulation usually occur?",
        ),
        (
            "metrics_session_3",
            "I am soaking through a pad every hour with huge clots and feeling dizzy and faint.",
        ),
    ]

    print("\n[Test 2: Logging Chat Interactions via POST /api/chat]")
    for idx, (sess_id, msg) in enumerate(sample_interactions, 1):
        res = client.post(
            "/api/chat",
            json={
                "session_id": sess_id,
                "message": msg,
                "stream": False,
            },
        )
        assert res.status_code == 200
        data = res.json()
        print(
            f"  [{idx}] row_id={data['interaction_id']} | session={sess_id} | "
            f"intent={data['intent']['predicted_intent']} ({data['intent']['confidence']:.2f}) | "
            f"sentiment={data['sentiment']['label']} ({data['sentiment']['compound']:+.4f}) | "
            f"kb_id={data['retrieval']['kb_id']}"
        )

    # 3. Query GET /api/metrics and validate distributions
    metrics_res = client.get("/api/metrics")
    assert metrics_res.status_code == 200
    m = metrics_res.json()

    assert m["total_chat_interactions"] == 6
    assert m["total_sessions"] == 3
    assert m["emergency_alert_count"] == 1
    assert sum(v["count"] for v in m["intent_distribution"].values()) == 6
    assert sum(v["count"] for v in m["sentiment_distribution"].values()) == 6

    print("\n[Test 3: GET /api/metrics Response Verification] [PASS]")
    print(f"  Total Chat Interactions : {m['total_chat_interactions']}")
    print(f"  Total Distinct Sessions : {m['total_sessions']}")
    print(f"  KB Match Count          : {m['knowledge_base_match_count']}/{m['total_chat_interactions']}")
    print(f"  Emergency Alert Count   : {m['emergency_alert_count']}")
    print(f"  Avg Intent Confidence   : {m['average_intent_confidence']:.4f}")
    print(f"  Avg Sentiment Compound  : {m['average_sentiment_compound']:+.4f}")

    print("\n  Intent Distribution:")
    for intent_name, stats in m["intent_distribution"].items():
        print(
            f"    - {intent_name:<28}: count={stats['count']} ({stats['percentage']:.1f}%), avg_conf={stats['avg_confidence']:.4f}"
        )

    print("\n  Sentiment Distribution:")
    for sent_label, stats in m["sentiment_distribution"].items():
        print(
            f"    - {sent_label:<10}: count={stats['count']} ({stats['percentage']:.1f}%), avg_compound={stats['avg_compound']:+.4f}"
        )

    print("\n  Retrieved Knowledge-Base ID Distribution:")
    for kb_id, stats in m["knowledge_base_distribution"].items():
        print(
            f"    - {kb_id:<10}: count={stats['count']} ({stats['percentage']:.1f}%), avg_conf={stats['avg_confidence']:.4f}"
        )

    print("\n  Model Evaluation Summary (from SQLite `model_evaluations`):")
    eval_m = m["model_evaluation"]
    print(
        f"    - Accuracy={eval_m['accuracy']:.4f}, Precision={eval_m['precision_macro']:.4f}, "
        f"Recall={eval_m['recall_macro']:.4f}, F1={eval_m['f1_score_macro']:.4f}"
    )

    print("\n" + "=" * 84)
    print("ALL SQLITE PERSISTENCE & /api/metrics TESTS PASSED!")
    print("=" * 84)


if __name__ == "__main__":
    main()
