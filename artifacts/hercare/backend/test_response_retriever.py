"""
Test & Verification Script for TF-IDF + Cosine Similarity Response Retriever (UCS760)
Tests 12 diverse queries (10 domain queries across cycle phases, nutrition, cramps,
PMS, headaches, PCOS, endometriosis, ovulation, yoga, emergency red flags + 2
out-of-domain queries to verify safe fallback handling).
"""

from backend.entity_extractor import HerCareEntityExtractor
from backend.intent_classifier import HerCareIntentClassifier
from backend.response_retriever import HerCareResponseRetriever


SAMPLE_TEST_QUERIES = [
    (
        "What causes severe cramps during my period and how can I relieve them naturally?",
        "kb_005",
    ),
    (
        "What should I eat during my luteal phase to curb sugar cravings?",
        "kb_003",
    ),
    (
        "Which iron-rich Indian vegetarian foods should I eat on my period?",
        "kb_002",
    ),
    (
        "What are the common signs of PCOS and how does insulin resistance affect ovulation?",
        "kb_008",
    ),
    (
        "How do I know if my pelvic pain is endometriosis or uterine fibroids?",
        "kb_009",
    ),
    (
        "Why do I get a throbbing hormonal headache right before my period starts?",
        "kb_007",
    ),
    (
        "I feel very anxious, tearful, and irritable before my period. Why does this happen?",
        "kb_011",
    ),
    (
        "What yoga poses and exercises are best during menstruation vs ovulation?",
        "kb_010",
    ),
    (
        "How can I tell when I am ovulating using cervical mucus and basal body temperature?",
        "kb_013",
    ),
    (
        "My period is 10 days late this month and my cycle keeps fluctuating, what causes this?",
        "kb_012",
    ),
    (
        "I am soaking through a pad every hour with large blood clots and feel dizzy and faint.",
        "kb_015",
    ),
    (
        "How do I configure a BGP routing table on a Cisco router?",
        "kb_fallback",
    ),
]


def main() -> None:
    classifier = HerCareIntentClassifier()
    classifier.load_or_train()
    extractor = HerCareEntityExtractor()
    retriever = HerCareResponseRetriever()

    print("=" * 84)
    print("HERCARE AI - TF-IDF & COSINE SIMILARITY RESPONSE RETRIEVER EVALUATION (UCS760)")
    print("=" * 84)

    passed = 0
    for idx, (query, expected_kb_id) in enumerate(SAMPLE_TEST_QUERIES, 1):
        intent_res = classifier.predict(query)
        entities = extractor.extract(query)
        result = retriever.retrieve(
            query=query,
            predicted_intent=intent_res["predicted_intent"],
            intent_confidence=intent_res["confidence"],
            entities=entities,
            cycle_phase=entities.get("cycle_phase"),
        )

        is_pass = result["kb_id"] == expected_kb_id
        if is_pass:
            passed += 1

        print(f"\n[{idx}] Query              : \"{query}\"")
        print(
            f"    NLP Context        : intent={intent_res['predicted_intent']} ({intent_res['confidence']:.2f}) | "
            f"phase={entities.get('cycle_phase')} | symptoms={entities.get('symptoms')} | conditions={entities.get('medical_conditions')}"
        )
        print(
            f"    Retrieved KB Entry : {result['kb_id']} - {result['topic']} (Expected: {expected_kb_id}) "
            f"{'[PASS]' if is_pass else '[MISMATCH]'}"
        )
        print(
            f"    Retrieval Scores   : confidence={result['confidence_score']:.4f} | "
            f"tfidf_cosine={result['tfidf_cosine_similarity']:.4f} | matched={result['matched']}"
        )
        print(f"    Answer Snippet     : {result['answer'][:155]}...")
        print(f"    Indian Wellness Tip: {result['indian_wellness_tip'][:125]}...")
        print(f"    Safety Warning     : {result['safety_warning'][:125]}...")
        sources_str = "; ".join(s["name"] for s in result["sources"])
        print(f"    Sources            : {sources_str}")

    print("\n" + "=" * 84)
    print(
        f"Retriever Accuracy on Test Suite: {passed}/{len(SAMPLE_TEST_QUERIES)} "
        f"({(passed / len(SAMPLE_TEST_QUERIES)) * 100:.1f}%)"
    )
    print("=" * 84)


if __name__ == "__main__":
    main()
