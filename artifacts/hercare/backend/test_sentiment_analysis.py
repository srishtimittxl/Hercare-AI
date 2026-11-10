"""
Test & Verification Script for NLTK VADER Sentiment Analysis in HerCare AI (UCS760)
Tests:
1. Emotional wellness messages across Positive, Negative, and Neutral sentiment classes
2. End-to-end integration with the existing NLP pipeline (preprocessing + intent + entities + sentiment)
3. Multi-turn emotional trajectory tracking across a conversation
"""

from backend.entity_extractor import DialogueSlotManager, HerCareEntityExtractor
from backend.intent_classifier import HerCareIntentClassifier
from backend.sentiment_analyzer import HerCareSentimentAnalyzer


EMOTIONAL_WELLNESS_SAMPLES = [
    # Negative emotional & physical distress messages
    (
        "I feel so anxious, tearful, and completely overwhelmed right before my period starts.",
        "Negative",
    ),
    (
        "My menstrual cramps are unbearable today and I feel exhausted and irritable.",
        "Negative",
    ),
    (
        "I am really worried because I am soaking through a pad every hour and feeling dizzy and faint.",
        "Negative",
    ),
    # Positive wellness & recovery messages
    (
        "I feel so calm, grounded, and energetic in my follicular phase after doing yoga and drinking ginger tea!",
        "Positive",
    ),
    (
        "Thank you HerCare! The warm khichdi and sesame oil remedy relieved my cramps and I feel great today.",
        "Positive",
    ),
    (
        "I am feeling super happy, motivated, and confident during my ovulation phase!",
        "Positive",
    ),
    # Neutral informational queries
    (
        "On which day of a 28 day menstrual cycle does ovulation usually occur?",
        "Neutral",
    ),
    (
        "What is the difference between the follicular phase and the luteal phase?",
        "Neutral",
    ),
    (
        "How often should I change a menstrual cup or cotton pad?",
        "Neutral",
    ),
]


def main() -> None:
    sentiment_analyzer = HerCareSentimentAnalyzer()
    classifier = HerCareIntentClassifier()
    classifier.load_or_train()
    extractor = HerCareEntityExtractor()
    slot_manager = DialogueSlotManager(extractor=extractor)

    print("=" * 80)
    print("HERCARE AI - NLTK VADER SENTIMENT ANALYSIS EVALUATION (UCS760)")
    print("=" * 80)

    correct = 0
    for idx, (msg, expected_label) in enumerate(EMOTIONAL_WELLNESS_SAMPLES, 1):
        sent = sentiment_analyzer.analyze(msg)
        intent = classifier.predict(msg)
        entities = extractor.extract(msg)
        matched = sent["label"] == expected_label
        if matched:
            correct += 1

        scores = sent["scores"]
        print(f"\n[{idx}] Message          : \"{msg}\"")
        print(
            f"    Sentiment Label  : {sent['label']} (Expected: {expected_label}) {'[PASS]' if matched else '[MISMATCH]'}"
        )
        print(
            f"    VADER Scores     : compound={scores['compound']:+.4f} | pos={scores['pos']:.3f}, neu={scores['neu']:.3f}, neg={scores['neg']:.3f}"
        )
        print(
            f"    Intensity & Tone : {sent['intensity']} -> {sent['recommended_tone']}"
        )
        print(
            f"    NLP Pipeline     : intent={intent['predicted_intent']} ({intent['confidence']:.2f}) | "
            f"mood={entities['mood']} | symptoms={entities['symptoms']}"
        )

    print("\n" + "-" * 80)
    print(
        f"Sentiment Classification Accuracy on Benchmark Samples: {correct}/{len(EMOTIONAL_WELLNESS_SAMPLES)} "
        f"({(correct / len(EMOTIONAL_WELLNESS_SAMPLES)) * 100:.1f}%)"
    )
    print("-" * 80)

    # Multi-turn conversation sentiment trajectory test
    conversation_messages = [
        {
            "role": "user",
            "content": "I am having terrible cramps and feeling so stressed and anxious today.",
        },
        {
            "role": "assistant",
            "content": "I'm so sorry you're dealing with severe cramps and anxiety.",
        },
        {
            "role": "user",
            "content": "What should I eat during the menstrual phase?",
        },
        {
            "role": "assistant",
            "content": "Warm iron-rich foods like moong dal khichdi with ghee and ginger tea help soothe Vata.",
        },
        {
            "role": "user",
            "content": "I tried the warm ginger tea and gentle stretching and I feel much more calm and relieved now!",
        },
    ]

    conv_sentiment = sentiment_analyzer.analyze_conversation(conversation_messages)
    slot_report = slot_manager.build_context_from_history(
        conversation_messages, session_id="sentiment_demo"
    )

    print("\n" + "=" * 80)
    print("MULTI-TURN EMOTIONAL TRAJECTORY & INTEGRATED NLP CONTEXT")
    print("=" * 80)
    for t in conv_sentiment["turn_sentiments"]:
        print(
            f"  Turn {t['turn']}: Label={t['label']:<8} | Compound={t['compound']:+.4f} | Intensity={t['intensity']}"
        )
    print(f"  Average Compound Score : {conv_sentiment['average_compound']:+.4f}")
    print(f"  Latest Sentiment Label : {conv_sentiment['latest_sentiment']['label']}")
    print(f"  Latest Recommended Tone: {conv_sentiment['latest_sentiment']['recommended_tone']}")
    print(f"  Accumulated Slots      : {slot_report['accumulated_slots']}")


if __name__ == "__main__":
    main()
