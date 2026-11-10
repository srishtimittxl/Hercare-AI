"""
Information Retrieval & Question-Answering Module for HerCare AI (UCS760)
Uses scikit-learn TfidfVectorizer and Cosine Similarity over the curated
women's wellness knowledge base (`backend/data/knowledge_base.json`),
augmented with hybrid relevance signals from:
- Predicted intent
- Extracted entities (symptoms, medical_conditions, mood, dietary_preference)
- Active cycle_phase
- Keyword overlap

Safely handles out-of-domain or low-confidence queries with a guarded fallback.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from backend.nlp_preprocessor import ensure_nltk_resources, preprocess_text

BASE_DIR = Path(__file__).resolve().parent
KB_PATH = BASE_DIR / "data" / "knowledge_base.json"

FALLBACK_ENTRY: Dict[str, Any] = {
    "id": "kb_fallback",
    "topic": "Out-of-Scope or General Women's Wellness Inquiry",
    "category": "general_menstrual_wellness",
    "intent": "greeting_general_wellness",
    "answer": (
        "I couldn't find a specific clinical match for that question in my women's wellness "
        "knowledge base. I specialize in menstrual cycle phases, period cramps, cycle-synced "
        "Indian nutrition, PMS, PCOS, endometriosis awareness, ovulation signs, yoga/exercise, "
        "and emotional wellbeing. Could you rephrase your question around one of these topics?"
    ),
    "indian_wellness_tip": (
        "Listening to your body's daily rhythm—staying hydrated with warm water, eating balanced "
        "seasonal meals, and getting 7–8 hours of sleep—supports overall hormonal harmony."
    ),
    "safety_warning": (
        "Educational information only. HerCare AI does not provide medical diagnoses or prescribe "
        "medications. For specific medical concerns, please consult a qualified healthcare provider."
    ),
    "sources": [
        {
            "name": "U.S. Office on Women's Health (OWH)",
            "url": "https://www.womenshealth.gov/",
        },
        {
            "name": "American College of Obstetricians and Gynecologists (ACOG)",
            "url": "https://www.acog.org/womens-health",
        },
    ],
}


class HerCareResponseRetriever:
    """
    TF-IDF + Cosine Similarity Question-Answering Retriever with context boosting
    (intent, entities, cycle phase, and keyword matching).
    """

    def __init__(
        self,
        kb_path: Path = KB_PATH,
        min_confidence_threshold: float = 0.18,
        min_tfidf_threshold: float = 0.05,
    ) -> None:
        ensure_nltk_resources()
        self.kb_path = kb_path
        self.min_confidence_threshold = min_confidence_threshold
        self.min_tfidf_threshold = min_tfidf_threshold
        self.entries: List[Dict[str, Any]] = []
        self.corpus_processed: List[str] = []
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            sublinear_tf=True,
            norm="l2",
        )
        self.tfidf_matrix = None
        self._load_and_index()

    def _load_and_index(self) -> None:
        with open(self.kb_path, "r", encoding="utf-8") as f:
            self.entries = json.load(f)

        self.corpus_processed = []
        for entry in self.entries:
            # Weight topic, question variants, keywords, and answer text
            combined_parts = [
                entry.get("topic", "") * 2,
                " ".join(entry.get("question_variants", [])) * 2,
                " ".join(entry.get("keywords", [])) * 3,
                entry.get("answer", ""),
                entry.get("indian_wellness_tip", ""),
            ]
            full_doc = " ".join(combined_parts)
            self.corpus_processed.append(preprocess_text(full_doc))

        self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus_processed)

    def retrieve(
        self,
        query: str,
        predicted_intent: Optional[str] = None,
        intent_confidence: float = 0.0,
        entities: Optional[Dict[str, Any]] = None,
        cycle_phase: Optional[str] = None,
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """
        Retrieve the most relevant knowledge base entry for a user query.
        Combines:
        1. TF-IDF Cosine Similarity on lemmatized query + extracted entity terms
        2. Intent alignment boost
        3. Keyword & entity overlap boost
        4. Cycle phase alignment boost
        """
        if not query or not isinstance(query, str) or not query.strip():
            return self._build_fallback_response(query="", reason="empty_query")

        entities = entities or {}
        effective_phase = cycle_phase or entities.get("cycle_phase")

        # Augment query with extracted symptoms and conditions for richer TF-IDF vector
        entity_terms: List[str] = []
        for key in ("symptoms", "medical_conditions", "mood"):
            vals = entities.get(key) or []
            if isinstance(vals, list):
                entity_terms.extend(vals)
        if effective_phase and effective_phase != "Unknown":
            entity_terms.append(f"{effective_phase} phase")

        augmented_query = f"{query} {' '.join(entity_terms)}".strip()
        processed_raw_query = preprocess_text(query)
        processed_aug_query = preprocess_text(augmented_query)

        if not processed_raw_query:
            return self._build_fallback_response(query=query, reason="no_valid_tokens")

        # Compute TF-IDF cosine similarity for both raw query and entity-augmented query
        raw_vec = self.vectorizer.transform([processed_raw_query])
        aug_vec = self.vectorizer.transform([processed_aug_query])

        raw_sims = cosine_similarity(raw_vec, self.tfidf_matrix)[0]
        aug_sims = cosine_similarity(aug_vec, self.tfidf_matrix)[0]
        base_tfidf_sims = 0.75 * raw_sims + 0.25 * aug_sims

        max_raw_tfidf = float(np.max(raw_sims))

        query_lower = query.lower()
        query_lemmas = set(processed_aug_query.split())

        scored_candidates: List[Dict[str, Any]] = []
        for idx, entry in enumerate(self.entries):
            tfidf_score = float(base_tfidf_sims[idx])
            raw_tfidf = float(raw_sims[idx])

            # 1. Intent alignment boost
            intent_boost = 0.0
            if predicted_intent and entry.get("intent") == predicted_intent:
                # Only boost if query has some lexical overlap or strong intent confidence
                if raw_tfidf >= self.min_tfidf_threshold or intent_confidence >= 0.55:
                    intent_boost = 0.22 * max(intent_confidence, 0.5)

            # 2. Keyword & entity overlap boost
            kw_matches = 0
            entry_keywords = entry.get("keywords", [])
            for kw in entry_keywords:
                kw_low = kw.lower()
                kw_lemmas = set(preprocess_text(kw_low).split())
                if kw_low in query_lower or (kw_lemmas and kw_lemmas.issubset(query_lemmas)):
                    kw_matches += 1
            keyword_boost = min(0.24, kw_matches * 0.08)

            # 3. Cycle phase alignment boost (especially important for nutrition/phase queries)
            phase_boost = 0.0
            entry_phases = entry.get("cycle_phases", [])
            if effective_phase and effective_phase in entry_phases:
                # Higher boost if the entry specifically targets 1-2 phases (e.g., Menstrual or Luteal diet)
                if len(entry_phases) <= 2:
                    phase_boost = 0.14
                else:
                    phase_boost = 0.04

            # 4. Specific symptom/condition disambiguation (e.g. headache -> kb_007, endometriosis/fibroids/thyroid -> kb_009)
            entity_boost = 0.0
            symptoms_list = [s.lower() for s in (entities.get("symptoms") or [])]
            conds_list = [c.lower() for c in (entities.get("medical_conditions") or [])]
            if "headache" in symptoms_list and entry["id"] == "kb_007":
                entity_boost += 0.18
            if any(c in conds_list for c in ("endometriosis", "fibroids", "thyroid")) and entry["id"] == "kb_009":
                entity_boost += 0.18
            if "pcos" in conds_list and entry["id"] == "kb_008":
                entity_boost += 0.18
            if ("heavy bleeding" in symptoms_list and "dizziness" in symptoms_list) and entry["id"] == "kb_015":
                entity_boost += 0.25

            combined_score = min(
                1.0,
                round(
                    tfidf_score + intent_boost + keyword_boost + phase_boost + entity_boost,
                    4,
                ),
            )

            scored_candidates.append(
                {
                    "entry": entry,
                    "confidence_score": combined_score,
                    "tfidf_cosine_similarity": round(raw_tfidf, 4),
                    "intent_boost": round(intent_boost, 4),
                    "keyword_boost": round(keyword_boost, 4),
                    "phase_boost": round(phase_boost, 4),
                    "entity_boost": round(entity_boost, 4),
                }
            )

        scored_candidates.sort(key=lambda x: x["confidence_score"], reverse=True)
        best = scored_candidates[0]

        # Guard against out-of-domain queries where TF-IDF similarity and keyword overlap are near zero
        if (
            max_raw_tfidf < self.min_tfidf_threshold and best["keyword_boost"] == 0.0 and best["entity_boost"] == 0.0
        ) or best["confidence_score"] < self.min_confidence_threshold:
            return self._build_fallback_response(
                query=query,
                reason="low_confidence_no_reliable_match",
                best_candidate_score=best["confidence_score"],
                max_tfidf=max_raw_tfidf,
            )

        best_entry = best["entry"]
        return {
            "matched": True,
            "kb_id": best_entry["id"],
            "topic": best_entry["topic"],
            "category": best_entry["category"],
            "entry_intent": best_entry["intent"],
            "confidence_score": best["confidence_score"],
            "tfidf_cosine_similarity": best["tfidf_cosine_similarity"],
            "answer": best_entry["answer"],
            "indian_wellness_tip": best_entry["indian_wellness_tip"],
            "safety_warning": best_entry["safety_warning"],
            "sources": best_entry["sources"],
            "top_candidates": [
                {
                    "kb_id": c["entry"]["id"],
                    "topic": c["entry"]["topic"],
                    "confidence_score": c["confidence_score"],
                    "tfidf_cosine_similarity": c["tfidf_cosine_similarity"],
                }
                for c in scored_candidates[:top_k]
            ],
        }

    @staticmethod
    def _build_fallback_response(
        query: str,
        reason: str,
        best_candidate_score: float = 0.0,
        max_tfidf: float = 0.0,
    ) -> Dict[str, Any]:
        return {
            "matched": False,
            "fallback_reason": reason,
            "kb_id": FALLBACK_ENTRY["id"],
            "topic": FALLBACK_ENTRY["topic"],
            "category": FALLBACK_ENTRY["category"],
            "entry_intent": FALLBACK_ENTRY["intent"],
            "confidence_score": round(best_candidate_score, 4),
            "tfidf_cosine_similarity": round(max_tfidf, 4),
            "answer": FALLBACK_ENTRY["answer"],
            "indian_wellness_tip": FALLBACK_ENTRY["indian_wellness_tip"],
            "safety_warning": FALLBACK_ENTRY["safety_warning"],
            "sources": FALLBACK_ENTRY["sources"],
            "top_candidates": [],
        }
