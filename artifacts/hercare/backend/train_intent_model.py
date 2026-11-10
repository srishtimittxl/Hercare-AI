"""
Training & Evaluation Script for HerCare AI Intent Classifier (UCS760)
Trains the TF-IDF + Logistic Regression pipeline, saves model artifacts,
prints evaluation metrics (Accuracy, Precision, Recall, F1-score),
and tests sample women's wellness queries.
"""

from backend.intent_classifier import HerCareIntentClassifier


SAMPLE_QUERIES = [
    "What causes severe cramps on the first day of my period and how do I ease them?",
    "What Indian vegetarian foods should I eat during my luteal phase?",
    "What are the early signs of PCOS and insulin resistance?",
    "My period is 12 days late and my cycle length keeps fluctuating",
    "I feel super anxious, tearful, and irritable right before my period starts",
    "How can I tell when I am ovulating and in my fertile window?",
    "Which yoga poses or light workouts are safe during menstruation?",
    "Why do I get hormonal acne, sore breasts, and bloating every month?",
    "I am soaking through a pad every hour with huge clots and feel faint",
    "Hello HerCare! How can you help me track my menstrual wellness?",
]


def main() -> None:
    classifier = HerCareIntentClassifier()
    metrics = classifier.train_and_evaluate(save_artifacts=True)

    print("=" * 72)
    print("HERCARE AI - INTENT CLASSIFICATION MODEL EVALUATION (UCS760)")
    print("=" * 72)
    print(f"Model             : {metrics['model_name']}")
    print(f"Dataset Size      : {metrics['total_samples']} labelled queries across {metrics['num_intents']} intents")
    print(f"Train / Test Split: {metrics['train_samples']} train / {metrics['test_samples']} test (stratified 75/25)")
    print(f"TF-IDF Vocabulary : {metrics['vocabulary_size']} uni/bi-gram features")
    print("-" * 72)

    holdout = metrics["holdout_test_metrics"]
    print("HOLDOUT TEST SET METRICS (25% Stratified Split):")
    print(f"  Accuracy          : {holdout['accuracy'] * 100:.2f}% ({holdout['accuracy']:.4f})")
    print(f"  Precision (Macro) : {holdout['precision_macro'] * 100:.2f}% ({holdout['precision_macro']:.4f})")
    print(f"  Recall (Macro)    : {holdout['recall_macro'] * 100:.2f}% ({holdout['recall_macro']:.4f})")
    print(f"  F1-Score (Macro)  : {holdout['f1_score_macro'] * 100:.2f}% ({holdout['f1_score_macro']:.4f})")
    print("-" * 72)

    cv = metrics["cross_validation_5fold"]
    print("5-FOLD STRATIFIED CROSS-VALIDATION METRICS (Full Dataset):")
    print(f"  Accuracy          : {cv['accuracy'] * 100:.2f}% ({cv['accuracy']:.4f})")
    print(f"  Precision (Macro) : {cv['precision_macro'] * 100:.2f}% ({cv['precision_macro']:.4f})")
    print(f"  Recall (Macro)    : {cv['recall_macro'] * 100:.2f}% ({cv['recall_macro']:.4f})")
    print(f"  F1-Score (Macro)  : {cv['f1_score_macro'] * 100:.2f}% ({cv['f1_score_macro']:.4f})")
    print("-" * 72)

    print("PER-INTENT CLASSIFICATION REPORT (Holdout Test Set):")
    print(f"  {'Intent':<28} {'Precision':<12} {'Recall':<12} {'F1-Score':<12} {'Support'}")
    for intent, m in metrics["per_intent_metrics"].items():
        print(
            f"  {intent:<28} {m['precision']:<12.4f} {m['recall']:<12.4f} {m['f1_score']:<12.4f} {m['support']}"
        )

    print("\n" + "=" * 72)
    print("SAMPLE QUERY PREDICTIONS & PREPROCESSING INSPECTION")
    print("=" * 72)
    for idx, q in enumerate(SAMPLE_QUERIES, 1):
        res = classifier.predict(q)
        print(f"\n[{idx}] Raw Query        : {res['query']}")
        print(f"    Lemmatized Text  : {res['preprocessing']['preprocessed_text']}")
        print(
            f"    Predicted Intent : {res['predicted_intent']} (Confidence: {res['confidence']:.4f})"
        )
        top_str = ", ".join(
            f"{p['intent']} ({p['confidence']:.2f})" for p in res["top_predictions"]
        )
        print(f"    Top-3 Intents    : {top_str}")


if __name__ == "__main__":
    main()
