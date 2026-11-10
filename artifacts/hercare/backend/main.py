"""
HerCare AI FastAPI Backend (UCS760 – Conversational AI)
Integrates the complete 7-stage NLP pipeline + Google Gemini grounded generation:
1. Text Preprocessing (NLTK tokenization, stopword filtering, WordNet lemmatization)
2. Intent Classification (TF-IDF + Logistic Regression across 10 intents)
3. Entity Extraction & Multi-Turn Slot Filling (session-aware context management)
4. Sentiment Analysis (NLTK VADER with wellness domain lexicon calibration)
5. Knowledge-Base Information Retrieval (TF-IDF + Cosine Similarity over curated KB)
6. Emergency Medical Safety Checks (pre-response red-flag screening BEFORE Gemini)
7. Grounded Response Generation via Google Gemini (`google-genai`) with deterministic
   fallback and mandatory clinical sources

Also provides:
- `POST /api/recommendations` for personalized Indian wellness cards on the Home screen
- `GET /api/metrics` for SQLite telemetry & model evaluation metrics
- `GET /health` for frontend connectivity verification
"""

import json
import re
from typing import Any, Dict, Generator, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from backend.database import HerCareDatabase
from backend.entity_extractor import DialogueSlotManager, HerCareEntityExtractor
from backend.gemini_service import HerCareGeminiService
from backend.intent_classifier import HerCareIntentClassifier
from backend.nlp_preprocessor import inspect_preprocessing_steps
from backend.response_retriever import HerCareResponseRetriever
from backend.sentiment_analyzer import HerCareSentimentAnalyzer

app = FastAPI(
    title="HerCare AI Backend",
    description="Intelligent Women's Wellness Conversational Assistant API",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Initialize NLP Pipeline, Gemini Service & SQLite Telemetry Singletons
# ---------------------------------------------------------------------------
intent_classifier = HerCareIntentClassifier()
intent_classifier.load_or_train()

entity_extractor = HerCareEntityExtractor()
slot_manager = DialogueSlotManager(extractor=entity_extractor)
sentiment_analyzer = HerCareSentimentAnalyzer()
response_retriever = HerCareResponseRetriever()
gemini_service = HerCareGeminiService()

telemetry_db = HerCareDatabase()
telemetry_db.save_model_evaluation(intent_classifier.metrics)

# Lookup map for KB entries by ID (e.g., for emergency override kb_015)
KB_BY_ID: Dict[str, Dict[str, Any]] = {
    entry["id"]: entry for entry in response_retriever.entries
}

EMERGENCY_RED_FLAG_REGEX = re.compile(
    r"\b("
    r"soaking\s+(?:through\s+)?(?:a\s+|two\s+)?(?:pad|tampon)s?\s+(?:every|an)\s+(?:hour|60\s+minutes)|"
    r"faint(?:ed|ing)|"
    r"golf\s+ball\s+(?:sized\s+)?(?:blood\s+)?clots?|"
    r"10\s*(?:out\s+of|/)\s*10|"
    r"unbearable\s+(?:acute\s+)?(?:pelvic|stomach|abdominal)\s+pain|"
    r"cannot\s+(?:stand|walk)|"
    r"toxic\s+shock|"
    r"ectopic\s+pregnancy|"
    r"cyst\s+(?:have\s+)?ruptured"
    r")\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------
class ChatMessageItem(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text")


class ChatRequest(BaseModel):
    messages: Optional[List[ChatMessageItem]] = Field(
        default=None,
        description="Conversation history array sent by the frontend chat screen",
    )
    message: Optional[str] = Field(
        default=None,
        description="Direct single user message (alternative to messages list)",
    )
    session_id: str = Field(
        default="default_session",
        description="Session identifier for maintaining multi-turn slot context",
    )
    stream: bool = Field(
        default=True,
        description="If True (default), returns OpenAI-compatible SSE stream; if False, returns structured JSON",
    )
    cycle_phase: Optional[str] = Field(
        default=None,
        description="Optional active cycle phase from user profile",
    )
    dietary_preference: Optional[str] = Field(
        default=None,
        description="Optional dietary preference from user profile",
    )


class SymptomEntry(BaseModel):
    symptom: str
    severity: Optional[Any] = "Mild"


class RecommendationsRequest(BaseModel):
    phase: Optional[str] = "Follicular"
    cycleDay: Optional[int] = None
    recentMoods: Optional[List[str]] = Field(default_factory=list)
    recentSymptoms: Optional[List[SymptomEntry]] = Field(default_factory=list)
    healthProfile: Optional[Dict[str, Any]] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helper Functions: Safety Check & Context-Aware Response Composer
# ---------------------------------------------------------------------------
def evaluate_emergency_safety(
    user_text: str,
    intent_result: Dict[str, Any],
    turn_entities: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Step 6: Pre-response emergency safety check (runs BEFORE Gemini).
    Detects life-threatening or urgent gynecological red flags before generating
    any response.
    """
    reasons: List[str] = []

    if (
        intent_result["predicted_intent"] == "emergency_medical_warning"
        and intent_result["confidence"] >= 0.35
    ):
        reasons.append(
            f"predicted_intent=emergency_medical_warning (confidence={intent_result['confidence']:.2f})"
        )

    turn_symptoms = set(turn_entities.get("symptoms") or [])
    if "Heavy Bleeding" in turn_symptoms and "Dizziness" in turn_symptoms:
        reasons.append("co_occurring_heavy_bleeding_and_dizziness")

    if (
        "Hot Flashes / Fever" in turn_symptoms
        and turn_entities.get("severity") == "Severe"
        and ("Cramps" in turn_symptoms or "Nausea" in turn_symptoms)
    ):
        reasons.append("severe_pain_with_fever")

    regex_match = EMERGENCY_RED_FLAG_REGEX.search(user_text)
    if regex_match:
        reasons.append(f"red_flag_phrase='{regex_match.group(0)}'")

    return {
        "is_emergency": len(reasons) > 0,
        "triggers": reasons,
    }


def build_empathy_prefix(
    sentiment: Dict[str, Any],
    accumulated_slots: Dict[str, Any],
    is_emergency: bool,
    matched_kb: bool,
) -> str:
    """Builds a sentiment-aware, context-personalized opening sentence."""
    if is_emergency:
        return (
            "🚨 **Please prioritize your immediate safety.** I can hear how distressing this is, "
            "and the symptoms you described require prompt medical attention."
        )

    if not matched_kb:
        return "Thank you for reaching out to HerCare AI."

    tone = sentiment.get("recommended_tone", "informative_balanced")
    symptoms = accumulated_slots.get("symptoms") or []
    moods = accumulated_slots.get("mood") or []
    phase = accumulated_slots.get("cycle_phase")
    severity = accumulated_slots.get("severity")
    duration = accumulated_slots.get("duration")
    conditions = accumulated_slots.get("medical_conditions") or []

    context_bits: List[str] = []
    if symptoms:
        sym_str = ", ".join(s.lower() for s in symptoms[:3])
        if severity:
            sym_str = f"{severity.lower()} {sym_str}"
        if duration:
            sym_str = f"{sym_str} ({duration})"
        context_bits.append(f"experiencing {sym_str}")
    if moods:
        mood_str = ", ".join(m.lower() for m in moods[:2])
        context_bits.append(f"feeling {mood_str}")
    if phase:
        context_bits.append(f"during your **{phase} phase**")
    if conditions:
        context_bits.append(f"while managing **{', '.join(conditions)}**")

    context_clause = f" ({'; '.join(context_bits)})" if context_bits else ""

    if tone == "deeply_empathetic_and_reassuring":
        return (
            f"💜 I'm so sorry you're going through such a tough time right now{context_clause}. "
            f"What you're feeling is completely valid—let's take a gentle, supportive look at what can help."
        )
    if tone == "gentle_and_supportive":
        return (
            f"💜 I hear you{context_clause}, and it's completely understandable to feel uncomfortable. "
            f"Here is evidence-based guidance tailored to support your body."
        )
    if tone in ("warm_and_celebratory", "encouraging_and_affirming"):
        return (
            f"✨ It's wonderful to hear that positive energy{context_clause}! "
            f"Here is how you can continue nurturing your wellness."
        )

    if context_clause:
        return f"🌸 Here is personalized wellness information based on your context{context_clause}:"
    return "🌸 Here is evidence-based women's wellness guidance for your question:"


def compose_contextual_response(
    retrieval: Dict[str, Any],
    sentiment: Dict[str, Any],
    slot_report: Dict[str, Any],
    safety_check: Dict[str, Any],
) -> str:
    """
    Deterministic grounded response synthesizer (used directly for emergency lock
    and as the fallback composer when Gemini is unconfigured or unavailable).
    """
    is_emergency = safety_check["is_emergency"]
    matched_kb = retrieval.get("matched", False)
    accumulated_slots = slot_report.get("accumulated_slots", {})
    slot_status = slot_report.get("slot_status", {})

    # 1. Empathetic, context-aware opening
    prefix = build_empathy_prefix(
        sentiment=sentiment,
        accumulated_slots=accumulated_slots,
        is_emergency=is_emergency,
        matched_kb=matched_kb,
    )

    sections: List[str] = [prefix, retrieval["answer"]]

    # 2. Personalized Indian Wellness & Diet Tip
    diet_pref = accumulated_slots.get("dietary_preference")
    phase = accumulated_slots.get("cycle_phase")
    tip_header = "🌿 **Indian Wellness & Ayurvedic Tip"
    if diet_pref or phase:
        tags = [t for t in (phase, diet_pref) if t]
        tip_header += f" ({' · '.join(tags)})"
    tip_header += ":**"
    sections.append(f"{tip_header} {retrieval['indian_wellness_tip']}")

    # 3. Context-aware follow-up prompt if key slots are still missing
    follow_up = slot_status.get("follow_up_prompt")
    if matched_kb and not is_emergency and follow_up:
        sections.append(f"💬 **To help me personalize further:** {follow_up}")

    # 4. Medical Safety Disclaimer
    sections.append(f"🩺 **Medical Safety Note:** {retrieval['safety_warning']}")

    # 5. Cited Sources
    sources = retrieval.get("sources") or []
    if sources:
        source_lines = [f"- [{s['name']}]({s['url']})" for s in sources]
        sections.append("📚 **Evidence Sources:**\n" + "\n".join(source_lines))

    return "\n\n".join(sections)


def run_chat_nlp_pipeline(req: ChatRequest) -> Dict[str, Any]:
    """Executes all 7 stages of the HerCare AI conversational NLP + Gemini pipeline."""
    conversation_history: List[Dict[str, str]] = []
    user_messages: List[str] = []
    if req.messages:
        for m in req.messages:
            if m.content and m.content.strip():
                conversation_history.append(
                    {"role": m.role, "content": m.content.strip()}
                )
                if m.role == "user":
                    user_messages.append(m.content.strip())
    if req.message and req.message.strip():
        clean_msg = req.message.strip()
        user_messages.append(clean_msg)
        conversation_history.append({"role": "user", "content": clean_msg})

    if not user_messages:
        raise HTTPException(
            status_code=400,
            detail="No user message provided in 'messages' or 'message'.",
        )

    latest_user_text = user_messages[-1]
    session_id = req.session_id or "default_session"

    # Seed optional profile context if provided
    if req.cycle_phase or req.dietary_preference:
        slot_manager.seed_profile_context(
            session_id=session_id,
            cycle_phase=req.cycle_phase,
            dietary_preference=req.dietary_preference,
        )

    # 1. Preprocess the user message
    preprocessing_info = inspect_preprocessing_steps(latest_user_text)

    # 2. Predict intent
    intent_result = intent_classifier.predict(latest_user_text)
    predicted_intent = intent_result["predicted_intent"]
    intent_confidence = intent_result["confidence"]

    # 3. Extract entities and update conversation slots across session
    ctx = slot_manager.get_or_create_session(session_id)
    if len(user_messages) > 1 and ctx.turn_count == 0:
        for prior_msg in user_messages[:-1]:
            prior_intent = intent_classifier.predict(prior_msg)["predicted_intent"]
            slot_manager.update_from_message(
                session_id=session_id,
                user_message=prior_msg,
                predicted_intent=prior_intent,
            )

    slot_report = slot_manager.update_from_message(
        session_id=session_id,
        user_message=latest_user_text,
        predicted_intent=predicted_intent,
    )
    turn_entities = slot_report["current_turn_entities"]
    accumulated_slots = slot_report["accumulated_slots"]

    # 4. Analyse sentiment using NLTK VADER
    sentiment_result = sentiment_analyzer.analyze(latest_user_text)

    # 5. Retrieve relevant knowledge-base entry
    retrieval_entities = dict(turn_entities)
    for slot_key in ("symptoms", "medical_conditions", "mood"):
        if not retrieval_entities.get(slot_key) and accumulated_slots.get(slot_key):
            retrieval_entities[slot_key] = accumulated_slots[slot_key]

    retrieval_result = response_retriever.retrieve(
        query=latest_user_text,
        predicted_intent=predicted_intent,
        intent_confidence=intent_confidence,
        entities=retrieval_entities,
        cycle_phase=turn_entities.get("cycle_phase")
        or accumulated_slots.get("cycle_phase"),
    )

    # 6. Apply emergency safety checks BEFORE Gemini response generation
    safety_check = evaluate_emergency_safety(
        user_text=latest_user_text,
        intent_result=intent_result,
        turn_entities=turn_entities,
    )
    if safety_check["is_emergency"] and retrieval_result.get("kb_id") != "kb_015":
        emergency_entry = KB_BY_ID["kb_015"]
        retrieval_result = {
            "matched": True,
            "kb_id": emergency_entry["id"],
            "topic": emergency_entry["topic"],
            "category": emergency_entry["category"],
            "entry_intent": emergency_entry["intent"],
            "confidence_score": 1.0,
            "tfidf_cosine_similarity": retrieval_result.get(
                "tfidf_cosine_similarity", 0.0
            ),
            "answer": emergency_entry["answer"],
            "indian_wellness_tip": emergency_entry["indian_wellness_tip"],
            "safety_warning": emergency_entry["safety_warning"],
            "sources": emergency_entry["sources"],
            "top_candidates": retrieval_result.get("top_candidates", []),
        }

    # 7. Generate grounded response via Gemini Service (with pre-emergency lock & fallback)
    intent_info = {
        "predicted_intent": predicted_intent,
        "confidence": intent_confidence,
        "top_predictions": intent_result["top_predictions"],
    }
    generation_output = gemini_service.generate_grounded_response(
        user_query=latest_user_text,
        conversation_history=conversation_history,
        intent_info=intent_info,
        turn_entities=turn_entities,
        accumulated_slots=accumulated_slots,
        slot_status=slot_report["slot_status"],
        sentiment_info=sentiment_result,
        retrieval_info=retrieval_result,
        safety_check=safety_check,
        fallback_composer=lambda: compose_contextual_response(
            retrieval=retrieval_result,
            sentiment=sentiment_result,
            slot_report=slot_report,
            safety_check=safety_check,
        ),
    )
    final_response_text = generation_output["response_text"]

    # 8. Persist anonymized telemetry record in SQLite
    interaction_id = telemetry_db.log_chat_interaction(
        session_id=session_id,
        predicted_intent=predicted_intent,
        intent_confidence=intent_confidence,
        sentiment_label=sentiment_result["label"],
        sentiment_compound=sentiment_result["compound"],
        sentiment_scores=sentiment_result["scores"],
        retrieved_kb_id=retrieval_result["kb_id"],
        retrieval_confidence=retrieval_result["confidence_score"],
        matched_kb=retrieval_result["matched"],
        is_emergency=safety_check["is_emergency"],
    )

    return {
        "interaction_id": interaction_id,
        "session_id": session_id,
        "query": latest_user_text,
        "response": final_response_text,
        "generation": {
            "engine": generation_output["engine"],
            "model": generation_output["model"],
            "gemini_used": generation_output["gemini_used"],
            "fallback_reason": generation_output["fallback_reason"],
        },
        "preprocessing": preprocessing_info,
        "intent": intent_info,
        "entities": turn_entities,
        "slots": accumulated_slots,
        "slot_status": slot_report["slot_status"],
        "sentiment": sentiment_result,
        "safety_check": safety_check,
        "retrieval": {
            "matched": retrieval_result["matched"],
            "kb_id": retrieval_result["kb_id"],
            "topic": retrieval_result["topic"],
            "category": retrieval_result["category"],
            "confidence_score": retrieval_result["confidence_score"],
            "tfidf_cosine_similarity": retrieval_result["tfidf_cosine_similarity"],
            "indian_wellness_tip": retrieval_result["indian_wellness_tip"],
            "safety_warning": retrieval_result["safety_warning"],
            "sources": retrieval_result["sources"],
        },
        "sources": retrieval_result["sources"],
    }


def generate_sse_stream(pipeline_output: Dict[str, Any]) -> Generator[str, None, None]:
    """
    Streams the response in the exact OpenAI-compatible Server-Sent Events (SSE)
    format expected by `app/(tabs)/chat.tsx` (`choices[0].delta.content`),
    and includes pipeline metadata on the final event before `[DONE]`.
    """
    text = pipeline_output["response"]
    tokens = re.findall(r"\S+\s*", text)
    chunk_size = 6

    for i in range(0, len(tokens), chunk_size):
        piece = "".join(tokens[i : i + chunk_size])
        payload = {
            "id": f"hercare-{pipeline_output['session_id']}",
            "object": "chat.completion.chunk",
            "choices": [
                {
                    "index": 0,
                    "delta": {"content": piece},
                    "finish_reason": None,
                }
            ],
        }
        yield f"data: {json.dumps(payload)}\n\n"

    final_payload = {
        "id": f"hercare-{pipeline_output['session_id']}",
        "object": "chat.completion.chunk",
        "choices": [
            {
                "index": 0,
                "delta": {},
                "finish_reason": "stop",
            }
        ],
        "nlp_metadata": {
            "session_id": pipeline_output["session_id"],
            "generation": pipeline_output["generation"],
            "intent": pipeline_output["intent"],
            "entities": pipeline_output["entities"],
            "slots": pipeline_output["slots"],
            "sentiment": pipeline_output["sentiment"],
            "safety_check": pipeline_output["safety_check"],
            "retrieval": pipeline_output["retrieval"],
            "sources": pipeline_output["sources"],
        },
    }
    yield f"data: {json.dumps(final_payload)}\n\n"
    yield "data: [DONE]\n\n"


def generate_personalized_recommendations(
    req: RecommendationsRequest,
) -> List[Dict[str, str]]:
    """
    Generates 4 personalized Indian wellness cards (diet, exercise, self-care, supplement)
    for the Home screen (`app/(tabs)/index.tsx`) based on cycle phase, diet preference,
    recent moods, recent symptoms, and health conditions.
    """
    phase = (req.phase or "Follicular").strip()
    if phase not in ("Menstrual", "Follicular", "Ovulation", "Luteal"):
        phase = "Follicular"

    hp = req.healthProfile or {}
    diet_type = hp.get("dietType") or "Vegetarian"
    conditions = [c for c in (hp.get("conditions") or []) if c and c != "None"]
    symptom_names = [s.symptom.lower() for s in (req.recentSymptoms or [])]
    mood_names = [m.lower() for m in (req.recentMoods or [])]

    phase_plans: Dict[str, List[Dict[str, str]]] = {
        "Menstrual": [
            {
                "title": "Warm Iron-Rich Khichdi & Ragi",
                "description": (
                    "Nourish your body during menstruation with warm moong dal khichdi, ragi porridge, "
                    "palak dal with lemon (Vitamin C boosts iron absorption), and soaked black raisins."
                    if diet_type != "Non-Vegetarian"
                    else "Replenish iron with warm moong dal khichdi, leafy palak soup, or lightly spiced bone/chicken broth with ginger and lemon."
                ),
                "category": "diet",
                "icon": "coffee",
            },
            {
                "title": "Restorative Pelvic Yoga",
                "description": "Practice 10–15 minutes of Balasana (Child's Pose) and Supta Baddha Konasana to gently relax uterine and lower back tension.",
                "category": "exercise",
                "icon": "activity",
            },
            {
                "title": "Warm Sesame Oil & Heating Pad",
                "description": "Apply a warm heating pad or massage warm sesame (til) oil over your lower abdomen to pacify Vata and ease cramps.",
                "category": "self-care",
                "icon": "heart",
            },
            {
                "title": "Ginger & Ajwain Herbal Infusion",
                "description": "Sip warm ginger (adrak) and roasted ajwain tea after meals to soothe prostaglandin-related cramping and bloating.",
                "category": "supplement",
                "icon": "droplet",
            },
        ],
        "Follicular": [
            {
                "title": "Sprouted Moong & Flaxseed Bowl",
                "description": (
                    f"Support rising estrogen in your Follicular phase with sprouted moong salad, ground flaxseeds (alsi), pumpkin seeds, and fresh seasonal greens ({diet_type})."
                ),
                "category": "diet",
                "icon": "coffee",
            },
            {
                "title": "Energizing Strength & Cardio",
                "description": "Rising estrogen boosts stamina and muscle recovery—ideal for brisk walking, Surya Namaskar (Sun Salutations), or strength training.",
                "category": "exercise",
                "icon": "zap",
            },
            {
                "title": "Morning Sunlight & Planning",
                "description": "Get 15 minutes of morning sunlight to align your circadian rhythm and channel high follicular focus into creative goals.",
                "category": "self-care",
                "icon": "sun",
            },
            {
                "title": "Seed Cycling (Flax + Pumpkin)",
                "description": "Take 1 tablespoon each of ground flaxseeds and pumpkin seeds daily to support healthy estrogen metabolism.",
                "category": "supplement",
                "icon": "feather",
            },
        ],
        "Ovulation": [
            {
                "title": "Cooling Pitta-Balancing Meals",
                "description": "Balance peak estrogen and LH with antioxidant-rich pomegranate, tender coconut water, cucumber raita/salad, and quinoa or jowar roti.",
                "category": "diet",
                "icon": "coffee",
            },
            {
                "title": "Peak Energy Flow & Mobility",
                "description": "Your energy is at its monthly high—enjoy dance cardio, a brisk run, or active Vinyasa yoga with thorough joint warm-ups.",
                "category": "exercise",
                "icon": "activity",
            },
            {
                "title": "Cooling Pranayama & Hydration",
                "description": "Practice Sheetali (cooling breath) and drink 2.5L of water infused with mint and fennel seeds to keep Pitta balanced.",
                "category": "self-care",
                "icon": "smile",
            },
            {
                "title": "Zinc & Omega-3 Support",
                "description": "Include soaked almonds, walnuts, and chia seeds to provide natural zinc and omega-3 fatty acids during ovulation.",
                "category": "supplement",
                "icon": "zap",
            },
        ],
        "Luteal": [
            {
                "title": "Complex Carbs & Magnesium Meals",
                "description": "Curb luteal sugar cravings with roasted sweet potato (shakarkandi), brown rice or bajra roti, leafy sabzi, and roasted chana.",
                "category": "diet",
                "icon": "coffee",
            },
            {
                "title": "Grounding Pilates & Evening Walk",
                "description": "As progesterone rises, swap exhausting HIIT for moderate Pilates, gentle strength work, or a calming 20-minute sunset walk.",
                "category": "exercise",
                "icon": "activity",
            },
            {
                "title": "Nadi Shodhana & Early Wind-Down",
                "description": "Practice 5 minutes of alternate-nostril breathing before bed to soothe luteal irritability and support deep sleep.",
                "category": "self-care",
                "icon": "moon",
            },
            {
                "title": "Sunflower + Sesame Seed Cycling",
                "description": "Include 1 tbsp each of sunflower and sesame (til) seeds plus warm chamomile or CCF (jeera-dhaniya-saunf) tea for bloating.",
                "category": "supplement",
                "icon": "heart",
            },
        ],
    }

    cards = [dict(c) for c in phase_plans.get(phase, phase_plans["Follicular"])]

    # Customize cards based on recent logged symptoms, moods, and known conditions
    if "cramps" in symptom_names or "back pain" in symptom_names:
        cards[2] = {
            "title": "Targeted Cramp & Back Relief",
            "description": "Apply continuous warmth (~40°C heating pad) and sip warm ginger-ajwain tea to relax uterine muscle contractions naturally.",
            "category": "self-care",
            "icon": "heart",
        }
    elif "bloating" in symptom_names:
        cards[3] = {
            "title": "Jeera-Dhaniya-Saunf (CCF) Tea",
            "description": "Steep equal parts cumin, coriander, and fennel seeds in hot water after meals to ease hormonal water retention and bloating.",
            "category": "supplement",
            "icon": "droplet",
        }

    if any(m in mood_names for m in ("anxious", "stressed", "sad", "irritated")):
        cards[2] = {
            "title": "Calming Evening Nutmeg & Breathwork",
            "description": "Ease emotional sensitivity with 4-6 diaphragmatic breathing and warm milk (dairy or almond) infused with a pinch of cardamom and nutmeg.",
            "category": "self-care",
            "icon": "moon",
        }

    if "PCOS" in conditions:
        cards[0]["description"] += " For PCOS insulin balance, pair every meal with protein/fiber and add a pinch of cinnamon or soaked methi seeds."

    return cards


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "HerCare AI Backend",
        "version": "1.1.0",
        "gemini_configured": gemini_service.is_configured(),
        "gemini_model": gemini_service.model_name,
    }


@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    """
    Conversational AI endpoint executing the 7-stage NLP + Gemini pipeline.
    - When `stream=True` (default): returns OpenAI-compatible `text/event-stream` SSE
      chunks consumed by `app/(tabs)/chat.tsx`.
    - When `stream=False`: returns the complete structured JSON response with all
      intermediate NLP and Gemini generation outputs.
    """
    pipeline_output = run_chat_nlp_pipeline(req)
    if req.stream:
        return StreamingResponse(
            generate_sse_stream(pipeline_output),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
    return JSONResponse(content=pipeline_output)


@app.post("/api/recommendations")
def recommendations_endpoint(req: RecommendationsRequest):
    """
    Returns personalized Indian diet, exercise, self-care, and supplement
    recommendations for the Home screen (`app/(tabs)/index.tsx`).
    """
    recs = generate_personalized_recommendations(req)
    return {"recommendations": recs, "phase": req.phase}


@app.get("/api/chat/session/{session_id}")
def get_session_context(session_id: str):
    """Inspect accumulated multi-turn conversation slots for a given session_id."""
    ctx = slot_manager.get_or_create_session(session_id)
    return {
        "session_id": ctx.session_id,
        "turn_count": ctx.turn_count,
        "active_intent": ctx.active_intent,
        "intent_history": ctx.intent_history,
        "slots": ctx.slots,
        "last_updated": ctx.last_updated,
    }


@app.delete("/api/chat/session/{session_id}")
def clear_session_context(session_id: str):
    """Clear conversation context and slots for a given session_id."""
    slot_manager.reset_session(session_id)
    return {"status": "cleared", "session_id": session_id}


@app.get("/api/metrics")
def get_metrics():
    """
    Returns SQLite-persisted conversational telemetry and model evaluation metrics.
    """
    return telemetry_db.get_aggregated_metrics(
        fallback_model_metrics=intent_classifier.metrics
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=5001, reload=False)
