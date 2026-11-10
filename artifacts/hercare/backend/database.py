"""
Privacy-Preserving SQLite Persistence Module for HerCare AI (UCS760)
Stores anonymized conversational AI telemetry and model evaluation records:
- `chat_interactions`: session_id, timestamp, predicted_intent, intent_confidence,
  sentiment_label, sentiment_compound, sentiment_scores_json, retrieved_kb_id,
  retrieval_confidence, matched_kb, is_emergency
- `model_evaluations`: timestamp, model_name, accuracy, precision_macro,
  recall_macro, f1_score_macro, metrics_json

PRIVACY DESIGN: Never stores user names, emails, raw personal health profiles,
or sensitive medical diary text.
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "hercare_telemetry.db"


class HerCareDatabase:
    """SQLite database manager for anonymized chat telemetry and NLP metrics."""

    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    predicted_intent TEXT NOT NULL,
                    intent_confidence REAL NOT NULL,
                    sentiment_label TEXT NOT NULL,
                    sentiment_compound REAL NOT NULL,
                    sentiment_scores_json TEXT NOT NULL,
                    retrieved_kb_id TEXT NOT NULL,
                    retrieval_confidence REAL NOT NULL,
                    matched_kb INTEGER NOT NULL DEFAULT 1,
                    is_emergency INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chat_session
                ON chat_interactions (session_id)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chat_intent
                ON chat_interactions (predicted_intent)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS model_evaluations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    model_name TEXT NOT NULL,
                    accuracy REAL NOT NULL,
                    precision_macro REAL NOT NULL,
                    recall_macro REAL NOT NULL,
                    f1_score_macro REAL NOT NULL,
                    metrics_json TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def log_chat_interaction(
        self,
        session_id: str,
        predicted_intent: str,
        intent_confidence: float,
        sentiment_label: str,
        sentiment_compound: float,
        sentiment_scores: Dict[str, float],
        retrieved_kb_id: str,
        retrieval_confidence: float,
        matched_kb: bool = True,
        is_emergency: bool = False,
        timestamp: Optional[str] = None,
    ) -> int:
        """
        Records an anonymized chat interaction in SQLite.
        Excludes raw user text and sensitive personal health profile attributes.
        """
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO chat_interactions (
                    session_id,
                    timestamp,
                    predicted_intent,
                    intent_confidence,
                    sentiment_label,
                    sentiment_compound,
                    sentiment_scores_json,
                    retrieved_kb_id,
                    retrieval_confidence,
                    matched_kb,
                    is_emergency
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    ts,
                    predicted_intent,
                    round(float(intent_confidence), 4),
                    sentiment_label,
                    round(float(sentiment_compound), 4),
                    json.dumps(sentiment_scores),
                    retrieved_kb_id,
                    round(float(retrieval_confidence), 4),
                    1 if matched_kb else 0,
                    1 if is_emergency else 0,
                ),
            )
            conn.commit()
            return int(cursor.lastrowid)

    def save_model_evaluation(self, metrics: Dict[str, Any]) -> None:
        """Persists model evaluation metrics (Accuracy, Precision, Recall, F1) in SQLite."""
        if not metrics:
            return
        holdout = metrics.get("holdout_test_metrics", {})
        ts = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            count = conn.execute(
                "SELECT COUNT(*) AS cnt FROM model_evaluations"
            ).fetchone()["cnt"]
            if count == 0:
                conn.execute(
                    """
                    INSERT INTO model_evaluations (
                        timestamp,
                        model_name,
                        accuracy,
                        precision_macro,
                        recall_macro,
                        f1_score_macro,
                        metrics_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ts,
                        metrics.get(
                            "model_name",
                            "TF-IDF + Logistic Regression Intent Classifier",
                        ),
                        float(holdout.get("accuracy", 0.0)),
                        float(holdout.get("precision_macro", 0.0)),
                        float(holdout.get("recall_macro", 0.0)),
                        float(holdout.get("f1_score_macro", 0.0)),
                        json.dumps(metrics),
                    ),
                )
                conn.commit()

    def get_aggregated_metrics(
        self, fallback_model_metrics: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Computes telemetry analytics for `GET /api/metrics`:
        - total_chat_interactions & total_sessions
        - intent_distribution (counts and percentages)
        - sentiment_distribution (counts, percentages, average compound score)
        - knowledge_base_distribution (counts per KB ID)
        - recent_interactions (last 10 anonymized records)
        - model_evaluation (Accuracy, Precision, Recall, F1-score)
        """
        with self._connect() as conn:
            summary_row = conn.execute(
                """
                SELECT
                    COUNT(*) AS total_interactions,
                    COUNT(DISTINCT session_id) AS total_sessions,
                    AVG(intent_confidence) AS avg_intent_confidence,
                    AVG(sentiment_compound) AS avg_sentiment_compound,
                    AVG(retrieval_confidence) AS avg_retrieval_confidence,
                    SUM(CASE WHEN matched_kb = 1 THEN 1 ELSE 0 END) AS matched_count,
                    SUM(CASE WHEN is_emergency = 1 THEN 1 ELSE 0 END) AS emergency_count
                FROM chat_interactions
                """
            ).fetchone()

            total_interactions = int(summary_row["total_interactions"] or 0)
            total_sessions = int(summary_row["total_sessions"] or 0)

            # Intent distribution
            intent_rows = conn.execute(
                """
                SELECT
                    predicted_intent,
                    COUNT(*) AS count,
                    AVG(intent_confidence) AS avg_confidence
                FROM chat_interactions
                GROUP BY predicted_intent
                ORDER BY count DESC, predicted_intent ASC
                """
            ).fetchall()

            intent_distribution: Dict[str, Dict[str, Any]] = {}
            for r in intent_rows:
                cnt = int(r["count"])
                intent_distribution[r["predicted_intent"]] = {
                    "count": cnt,
                    "percentage": round(
                        (cnt / total_interactions) * 100, 2
                    )
                    if total_interactions > 0
                    else 0.0,
                    "avg_confidence": round(float(r["avg_confidence"] or 0.0), 4),
                }

            # Sentiment distribution
            sentiment_rows = conn.execute(
                """
                SELECT
                    sentiment_label,
                    COUNT(*) AS count,
                    AVG(sentiment_compound) AS avg_compound
                FROM chat_interactions
                GROUP BY sentiment_label
                ORDER BY count DESC, sentiment_label ASC
                """
            ).fetchall()

            sentiment_distribution: Dict[str, Dict[str, Any]] = {
                label: {"count": 0, "percentage": 0.0, "avg_compound": 0.0}
                for label in ("Positive", "Neutral", "Negative")
            }
            for r in sentiment_rows:
                cnt = int(r["count"])
                sentiment_distribution[r["sentiment_label"]] = {
                    "count": cnt,
                    "percentage": round(
                        (cnt / total_interactions) * 100, 2
                    )
                    if total_interactions > 0
                    else 0.0,
                    "avg_compound": round(float(r["avg_compound"] or 0.0), 4),
                }

            # Knowledge-base retrieval distribution
            kb_rows = conn.execute(
                """
                SELECT
                    retrieved_kb_id,
                    COUNT(*) AS count,
                    AVG(retrieval_confidence) AS avg_confidence
                FROM chat_interactions
                GROUP BY retrieved_kb_id
                ORDER BY count DESC, retrieved_kb_id ASC
                """
            ).fetchall()

            kb_distribution: Dict[str, Dict[str, Any]] = {}
            for r in kb_rows:
                cnt = int(r["count"])
                kb_distribution[r["retrieved_kb_id"]] = {
                    "count": cnt,
                    "percentage": round(
                        (cnt / total_interactions) * 100, 2
                    )
                    if total_interactions > 0
                    else 0.0,
                    "avg_confidence": round(float(r["avg_confidence"] or 0.0), 4),
                }

            # Recent anonymized records
            recent_rows = conn.execute(
                """
                SELECT
                    id,
                    session_id,
                    timestamp,
                    predicted_intent,
                    intent_confidence,
                    sentiment_label,
                    sentiment_compound,
                    retrieved_kb_id,
                    retrieval_confidence,
                    matched_kb,
                    is_emergency
                FROM chat_interactions
                ORDER BY id DESC
                LIMIT 10
                """
            ).fetchall()

            recent_interactions = [
                {
                    "id": int(r["id"]),
                    "session_id": r["session_id"],
                    "timestamp": r["timestamp"],
                    "predicted_intent": r["predicted_intent"],
                    "intent_confidence": float(r["intent_confidence"]),
                    "sentiment_label": r["sentiment_label"],
                    "sentiment_compound": float(r["sentiment_compound"]),
                    "retrieved_kb_id": r["retrieved_kb_id"],
                    "retrieval_confidence": float(r["retrieval_confidence"]),
                    "matched_kb": bool(r["matched_kb"]),
                    "is_emergency": bool(r["is_emergency"]),
                }
                for r in recent_rows
            ]

            eval_row = conn.execute(
                """
                SELECT model_name, accuracy, precision_macro, recall_macro, f1_score_macro
                FROM model_evaluations
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()

        model_eval_summary: Dict[str, Any] = {}
        if eval_row:
            model_eval_summary = {
                "model_name": eval_row["model_name"],
                "accuracy": round(float(eval_row["accuracy"]), 4),
                "precision_macro": round(float(eval_row["precision_macro"]), 4),
                "recall_macro": round(float(eval_row["recall_macro"]), 4),
                "f1_score_macro": round(float(eval_row["f1_score_macro"]), 4),
            }
        elif fallback_model_metrics:
            holdout = fallback_model_metrics.get("holdout_test_metrics", {})
            model_eval_summary = {
                "model_name": fallback_model_metrics.get(
                    "model_name", "TF-IDF + Logistic Regression Intent Classifier"
                ),
                "accuracy": holdout.get("accuracy", 0.0),
                "precision_macro": holdout.get("precision_macro", 0.0),
                "recall_macro": holdout.get("recall_macro", 0.0),
                "f1_score_macro": holdout.get("f1_score_macro", 0.0),
            }

        return {
            "total_chat_interactions": total_interactions,
            "total_sessions": total_sessions,
            "average_intent_confidence": round(
                float(summary_row["avg_intent_confidence"] or 0.0), 4
            ),
            "average_sentiment_compound": round(
                float(summary_row["avg_sentiment_compound"] or 0.0), 4
            ),
            "average_retrieval_confidence": round(
                float(summary_row["avg_retrieval_confidence"] or 0.0), 4
            ),
            "knowledge_base_match_count": int(summary_row["matched_count"] or 0),
            "emergency_alert_count": int(summary_row["emergency_count"] or 0),
            "intent_distribution": intent_distribution,
            "sentiment_distribution": sentiment_distribution,
            "knowledge_base_distribution": kb_distribution,
            "model_evaluation": model_eval_summary,
            "recent_interactions": recent_interactions,
            "privacy_policy": (
                "Only anonymized NLP telemetry (session_id, timestamp, predicted_intent, "
                "sentiment_scores, retrieved_kb_id) is persisted in SQLite. No personal names, "
                "emails, or raw sensitive health messages are stored."
            ),
        }
