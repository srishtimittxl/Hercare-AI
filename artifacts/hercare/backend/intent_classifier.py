"""
Intent Classification Module for HerCare AI (UCS760)
Uses scikit-learn TfidfVectorizer + LogisticRegression with NLTK preprocessing.
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline

from backend.nlp_preprocessor import (
    ensure_nltk_resources,
    inspect_preprocessing_steps,
    preprocess_text,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "intent_dataset.json"
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "intent_classifier.joblib"
METRICS_PATH = MODEL_DIR / "evaluation_metrics.json"


class HerCareIntentClassifier:
    """TF-IDF + Logistic Regression Intent Classifier for Women's Wellness."""

    def __init__(self) -> None:
        self.pipeline: Optional[Pipeline] = None
        self.metrics: Dict[str, Any] = {}
        self.intents: List[str] = []

    @staticmethod
    def build_pipeline() -> Pipeline:
        return Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        ngram_range=(1, 2),
                        min_df=1,
                        max_df=0.85,
                        sublinear_tf=True,
                        norm="l2",
                    ),
                ),
                (
                    "clf",
                    LogisticRegression(
                        C=5.0,
                        max_iter=1000,
                        class_weight="balanced",
                        random_state=42,
                    ),
                ),
            ]
        )

    def train_and_evaluate(
        self, dataset_path: Path = DATA_PATH, save_artifacts: bool = True
    ) -> Dict[str, Any]:
        ensure_nltk_resources()

        with open(dataset_path, "r", encoding="utf-8") as f:
            records = json.load(f)

        raw_texts = [item["text"] for item in records]
        labels = [item["intent"] for item in records]
        preprocessed_texts = [preprocess_text(t) for t in raw_texts]

        self.intents = sorted(list(set(labels)))

        # 1. Hold-out Stratified Train/Test Split (75% train, 25% test)
        X_train, X_test, y_train, y_test = train_test_split(
            preprocessed_texts,
            labels,
            test_size=0.25,
            random_state=42,
            stratify=labels,
        )

        eval_pipeline = self.build_pipeline()
        eval_pipeline.fit(X_train, y_train)
        y_pred_test = eval_pipeline.predict(X_test)

        test_accuracy = float(accuracy_score(y_test, y_pred_test))
        test_precision_macro = float(
            precision_score(y_test, y_pred_test, average="macro", zero_division=0)
        )
        test_recall_macro = float(
            recall_score(y_test, y_pred_test, average="macro", zero_division=0)
        )
        test_f1_macro = float(
            f1_score(y_test, y_pred_test, average="macro", zero_division=0)
        )
        test_precision_weighted = float(
            precision_score(y_test, y_pred_test, average="weighted", zero_division=0)
        )
        test_recall_weighted = float(
            recall_score(y_test, y_pred_test, average="weighted", zero_division=0)
        )
        test_f1_weighted = float(
            f1_score(y_test, y_pred_test, average="weighted", zero_division=0)
        )

        # 2. 5-Fold Stratified Cross-Validation across full dataset
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_pipeline = self.build_pipeline()
        y_pred_cv = cross_val_predict(
            cv_pipeline, preprocessed_texts, labels, cv=skf
        )

        cv_accuracy = float(accuracy_score(labels, y_pred_cv))
        cv_precision = float(
            precision_score(labels, y_pred_cv, average="macro", zero_division=0)
        )
        cv_recall = float(
            recall_score(labels, y_pred_cv, average="macro", zero_division=0)
        )
        cv_f1 = float(
            f1_score(labels, y_pred_cv, average="macro", zero_division=0)
        )

        report_dict = classification_report(
            y_test, y_pred_test, labels=self.intents, output_dict=True, zero_division=0
        )
        cm = confusion_matrix(y_test, y_pred_test, labels=self.intents).tolist()

        # 3. Fit final production model on 100% of labelled dataset
        self.pipeline = self.build_pipeline()
        self.pipeline.fit(preprocessed_texts, labels)

        vocab_size = len(self.pipeline.named_steps["tfidf"].vocabulary_)

        self.metrics = {
            "model_name": "TF-IDF + Logistic Regression Intent Classifier",
            "total_samples": len(records),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "num_intents": len(self.intents),
            "intents": self.intents,
            "vocabulary_size": vocab_size,
            "holdout_test_metrics": {
                "accuracy": round(test_accuracy, 4),
                "precision_macro": round(test_precision_macro, 4),
                "recall_macro": round(test_recall_macro, 4),
                "f1_score_macro": round(test_f1_macro, 4),
                "precision_weighted": round(test_precision_weighted, 4),
                "recall_weighted": round(test_recall_weighted, 4),
                "f1_score_weighted": round(test_f1_weighted, 4),
            },
            "cross_validation_5fold": {
                "accuracy": round(cv_accuracy, 4),
                "precision_macro": round(cv_precision, 4),
                "recall_macro": round(cv_recall, 4),
                "f1_score_macro": round(cv_f1, 4),
            },
            "per_intent_metrics": {
                intent: {
                    "precision": round(float(report_dict[intent]["precision"]), 4),
                    "recall": round(float(report_dict[intent]["recall"]), 4),
                    "f1_score": round(float(report_dict[intent]["f1-score"]), 4),
                    "support": int(report_dict[intent]["support"]),
                }
                for intent in self.intents
            },
            "confusion_matrix": {
                "labels": self.intents,
                "matrix": cm,
            },
        }

        if save_artifacts:
            MODEL_DIR.mkdir(parents=True, exist_ok=True)
            joblib.dump(
                {
                    "pipeline": self.pipeline,
                    "intents": self.intents,
                    "metrics": self.metrics,
                },
                MODEL_PATH,
            )
            with open(METRICS_PATH, "w", encoding="utf-8") as mf:
                json.dump(self.metrics, mf, indent=2)

        return self.metrics

    def load_or_train(self) -> None:
        ensure_nltk_resources()
        if MODEL_PATH.exists():
            bundle = joblib.load(MODEL_PATH)
            self.pipeline = bundle["pipeline"]
            self.intents = bundle["intents"]
            self.metrics = bundle.get("metrics", {})
        else:
            self.train_and_evaluate(save_artifacts=True)

    def predict(self, text: str) -> Dict[str, Any]:
        if self.pipeline is None:
            self.load_or_train()

        prep_info = inspect_preprocessing_steps(text)
        processed = prep_info["preprocessed_text"]

        probs = self.pipeline.predict_proba([processed])[0]
        classes = list(self.pipeline.classes_)

        ranked_indices = np.argsort(probs)[::-1]
        best_idx = ranked_indices[0]
        predicted_intent = classes[best_idx]
        confidence = float(probs[best_idx])

        top_predictions = [
            {"intent": classes[idx], "confidence": round(float(probs[idx]), 4)}
            for idx in ranked_indices[:3]
        ]

        return {
            "query": text,
            "preprocessing": prep_info,
            "predicted_intent": predicted_intent,
            "confidence": round(confidence, 4),
            "top_predictions": top_predictions,
        }
