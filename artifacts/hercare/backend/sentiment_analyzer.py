"""
Sentiment Analysis Module for HerCare AI (UCS760)
Uses NLTK VADER (Valence Aware Dictionary and sEntiment Reasoner) enhanced with
women's wellness and menstrual health domain valence terms.
Classifies messages into Positive, Negative, or Neutral and returns detailed
polarity scores (neg, neu, pos, compound) along with empathetic tone guidance.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

from backend.nlp_preprocessor import NLTK_DATA_DIR

if str(NLTK_DATA_DIR) not in nltk.data.path:
    nltk.data.path.insert(0, str(NLTK_DATA_DIR))


def ensure_vader_lexicon() -> None:
    """Ensure NLTK VADER lexicon is available locally in backend/nltk_data."""
    for key in ("sentiment/vader_lexicon.zip", "sentiment/vader_lexicon"):
        try:
            nltk.data.find(key)
            return
        except LookupError:
            continue
    nltk.download("vader_lexicon", download_dir=str(NLTK_DATA_DIR), quiet=True)


# Women's wellness & clinical valence lexicon additions for VADER
WELLNESS_LEXICON_UPDATES: Dict[str, float] = {
    "cramps": -2.2,
    "cramping": -2.2,
    "dysmenorrhea": -2.5,
    "bloated": -1.6,
    "bloating": -1.6,
    "migraine": -2.4,
    "migraines": -2.4,
    "headache": -1.8,
    "unbearable": -3.2,
    "excruciating": -3.4,
    "tearful": -2.1,
    "irritable": -2.0,
    "irritated": -2.0,
    "snappy": -1.7,
    "moody": -1.5,
    "drained": -2.2,
    "exhausted": -2.4,
    "fatigued": -2.0,
    "fatigue": -1.8,
    "overwhelmed": -2.3,
    "anxious": -2.2,
    "anxiety": -2.2,
    "faint": -2.5,
    "fainting": -2.7,
    "dizzy": -2.0,
    "dizziness": -2.0,
    "nauseous": -2.1,
    "nausea": -2.0,
    "spotting": -1.2,
    "clots": -1.8,
    "grounded": 2.1,
    "nourished": 2.3,
    "nourishing": 2.0,
    "soothing": 2.0,
    "relieved": 2.4,
    "balanced": 2.0,
    "motivated": 2.3,
    "energetic": 2.2,
    "vibrant": 2.4,
    "restful": 2.1,
}


class HerCareSentimentAnalyzer:
    """
    NLTK VADER Sentiment Analyzer tailored for women's health & emotional wellness.
    Classifies text into 'Positive', 'Negative', or 'Neutral' and returns
    raw and compound polarity scores plus empathetic response tone guidance.
    """

    def __init__(
        self,
        positive_threshold: float = 0.05,
        negative_threshold: float = -0.05,
    ) -> None:
        ensure_vader_lexicon()
        self.positive_threshold = positive_threshold
        self.negative_threshold = negative_threshold
        self.sia = SentimentIntensityAnalyzer()
        self.sia.lexicon.update(WELLNESS_LEXICON_UPDATES)

    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Analyze sentiment of a single user message.
        Returns:
        - label: 'Positive' | 'Negative' | 'Neutral'
        - scores: {'neg': float, 'neu': float, 'pos': float, 'compound': float}
        - intensity: 'High' | 'Moderate' | 'Low' | 'Neutral'
        - recommended_tone: Empathetic tone directive for chatbot response generation
        """
        if not text or not isinstance(text, str) or not text.strip():
            return {
                "text": text or "",
                "label": "Neutral",
                "scores": {"neg": 0.0, "neu": 1.0, "pos": 0.0, "compound": 0.0},
                "compound": 0.0,
                "intensity": "Neutral",
                "recommended_tone": "informative_balanced",
            }

        raw_scores = self.sia.polarity_scores(text)
        compound = round(float(raw_scores["compound"]), 4)
        scores = {
            "neg": round(float(raw_scores["neg"]), 4),
            "neu": round(float(raw_scores["neu"]), 4),
            "pos": round(float(raw_scores["pos"]), 4),
            "compound": compound,
        }

        if compound >= self.positive_threshold:
            label = "Positive"
        elif compound <= self.negative_threshold:
            label = "Negative"
        else:
            label = "Neutral"

        abs_c = abs(compound)
        if label == "Neutral":
            intensity = "Neutral"
        elif abs_c >= 0.60:
            intensity = "High"
        elif abs_c >= 0.25:
            intensity = "Moderate"
        else:
            intensity = "Low"

        recommended_tone = self._select_tone(label, compound)

        return {
            "text": text,
            "label": label,
            "scores": scores,
            "compound": compound,
            "intensity": intensity,
            "recommended_tone": recommended_tone,
        }

    def analyze_conversation(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Analyze sentiment across a multi-turn conversation history to track
        emotional trajectory and average compound score.
        """
        user_msgs = [
            m["content"]
            for m in messages
            if m.get("role") == "user" and m.get("content")
        ]
        if not user_msgs:
            latest = self.analyze("")
            return {
                "latest_sentiment": latest,
                "average_compound": 0.0,
                "overall_label": "Neutral",
                "turn_sentiments": [],
            }

        turn_results = [self.analyze(msg) for msg in user_msgs]
        avg_compound = round(
            sum(r["compound"] for r in turn_results) / len(turn_results), 4
        )
        if avg_compound >= self.positive_threshold:
            overall_label = "Positive"
        elif avg_compound <= self.negative_threshold:
            overall_label = "Negative"
        else:
            overall_label = "Neutral"

        return {
            "latest_sentiment": turn_results[-1],
            "average_compound": avg_compound,
            "overall_label": overall_label,
            "turn_sentiments": [
                {
                    "turn": idx + 1,
                    "label": r["label"],
                    "compound": r["compound"],
                    "intensity": r["intensity"],
                }
                for idx, r in enumerate(turn_results)
            ],
        }

    @staticmethod
    def _select_tone(label: str, compound: float) -> str:
        if label == "Negative":
            if compound <= -0.50:
                return "deeply_empathetic_and_reassuring"
            return "gentle_and_supportive"
        if label == "Positive":
            if compound >= 0.50:
                return "warm_and_celebratory"
            return "encouraging_and_affirming"
        return "informative_balanced"
