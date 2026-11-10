"""
Test & Verification Script for Entity Extraction and Multi-Turn Slot Filling (UCS760)
Tests:
1. Single-turn entity extraction across all 7 entity types
   (symptoms, severity, duration, mood, cycle_phase, medical_conditions, dietary_preference)
2. Multi-turn conversation context & slot accumulation withHerCareIntentClassifier
"""

from backend.entity_extractor import DialogueSlotManager, HerCareEntityExtractor
from backend.intent_classifier import HerCareIntentClassifier


SINGLE_TURN_SAMPLES = [
    "I have had severe cramps, lower back pain, and nausea for 2 days on day 1 of my period.",
    "I feel very anxious, irritable, and tired during my luteal phase for the past 5 days.",
    "I was diagnosed with PCOS and hypothyroidism, and I follow an Indian vegetarian diet.",
    "My period is 10 days late and I have mild spotting and moderate bloating since yesterday.",
    "What vegan foods help with breast tenderness and hormonal acne before my period?",
    "I have endometriosis and uterine fibroids, and I am soaking through a pad every hour and feeling dizzy.",
]

MULTI_TURN_CONVERSATION = [
    "Hi! My lower stomach has been hurting a lot with cramps and bloating.",
    "The pain is severe and has been going on for 3 days now, and I also feel really anxious and tired.",
    "I am currently on my period (day 2 of my cycle) and I have PCOS.",
    "What should I eat today? I prefer a vegetarian diet.",
]


def main() -> None:
    extractor = HerCareEntityExtractor()
    classifier = HerCareIntentClassifier()
    classifier.load_or_train()

    print("=" * 76)
    print("HERCARE AI - SINGLE-TURN ENTITY EXTRACTION TESTS (UCS760)")
    print("=" * 76)

    for idx, sample in enumerate(SINGLE_TURN_SAMPLES, 1):
        entities = extractor.extract(sample)
        intent_res = classifier.predict(sample)
        print(f"\n[Sample {idx}] Message: \"{sample}\"")
        print(
            f"  Predicted Intent   : {intent_res['predicted_intent']} ({intent_res['confidence']:.2f})"
        )
        print(f"  Symptoms           : {entities['symptoms']}")
        print(f"  Severity           : {entities['severity']}")
        print(f"  Duration           : {entities['duration']}")
        print(f"  Mood               : {entities['mood']}")
        print(f"  Cycle Phase        : {entities['cycle_phase']} (Cycle Day: {entities['cycle_day']})")
        print(f"  Medical Conditions : {entities['medical_conditions']}")
        print(f"  Dietary Preference : {entities['dietary_preference']}")

    print("\n" + "=" * 76)
    print("HERCARE AI - MULTI-TURN SLOT FILLING & CONTEXT ACCUMULATION TEST")
    print("=" * 76)

    slot_manager = DialogueSlotManager(extractor=extractor)
    session_id = "ucs760_demo_session"

    for turn_idx, user_msg in enumerate(MULTI_TURN_CONVERSATION, 1):
        intent_res = classifier.predict(user_msg)
        report = slot_manager.update_from_message(
            session_id=session_id,
            user_message=user_msg,
            predicted_intent=intent_res["predicted_intent"],
        )
        slots = report["accumulated_slots"]
        status = report["slot_status"]

        print(f"\n--- Turn {turn_idx} ---")
        print(f"User Message       : \"{user_msg}\"")
        print(
            f"Turn Intent        : {report['active_intent']} (Confidence: {intent_res['confidence']:.2f})"
        )
        print(f"New Turn Entities  : { {k: v for k, v in report['current_turn_entities'].items() if v and k != 'all_durations'} }")
        print(f"Accumulated Slots  :")
        print(f"  - symptoms           : {slots['symptoms']}")
        print(f"  - severity           : {slots['severity']}")
        print(f"  - duration           : {slots['duration']}")
        print(f"  - mood               : {slots['mood']}")
        print(f"  - cycle_phase        : {slots['cycle_phase']} (day: {slots['cycle_day']})")
        print(f"  - medical_conditions : {slots['medical_conditions']}")
        print(f"  - dietary_preference : {slots['dietary_preference']}")
        print(
            f"Slot Completeness  : complete={status['is_complete']} | filled={status['filled_slots']} | missing={status['missing_slots']}"
        )
        if status["follow_up_prompt"]:
            print(f"Follow-up Prompt   : \"{status['follow_up_prompt']}\"")


if __name__ == "__main__":
    main()
