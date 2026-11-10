"""
Entity Extraction and Multi-Turn Slot Filling Module for HerCare AI (UCS760)
Extracts domain-specific clinical and wellness entities from user utterances:
- symptoms
- severity
- duration
- mood
- cycle_phase
- medical_conditions
- dietary_preference

Maintains conversation context and slot state across multi-turn interactions.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Domain Lexicons & Regex Patterns for Entity Recognition
# ---------------------------------------------------------------------------

SYMPTOM_PATTERNS: Dict[str, List[str]] = {
    "Cramps": [
        r"\bcramps?\b",
        r"\bcramping\b",
        r"\bdysmenorrhea\b",
        r"\bstomach\s+pain\b",
        r"\babdominal\s+pain\b",
        r"\bbelly\s+pain\b",
        r"\bpelvic\s+pain\b",
        r"\buterine\s+pain\b",
    ],
    "Bloating": [
        r"\bbloated\b",
        r"\bbloating\b",
        r"\bwater\s+retention\b",
        r"\bfluid\s+retention\b",
        r"\bgassy\b",
        r"\bstomach\s+swelling\b",
        r"\bpuffy\b",
    ],
    "Headache": [
        r"\bheadaches?\b",
        r"\bmigraines?\b",
        r"\bhead\s+throbbing\b",
        r"\bhead\s+pain\b",
    ],
    "Acne": [
        r"\bacne\b",
        r"\bbreakouts?\b",
        r"\bpimples?\b",
        r"\bjawline\s+spots?\b",
        r"\boily\s+skin\b",
    ],
    "Fatigue": [
        r"\bfatigued?\b",
        r"\bexhausted\b",
        r"\bexhaustion\b",
        r"\blow\s+energy\b",
        r"\bno\s+energy\b",
        r"\blethargic\b",
        r"\blethargy\b",
        r"\bweakness\b",
        r"\bbrain\s+fog\b",
    ],
    "Back Pain": [
        r"\bback\s+pain\b",
        r"\bbackache\b",
        r"\blower\s+back\s+(?:ache|pain|hurts?)\b",
        r"\bback\s+hurts?\b",
    ],
    "Breast Tenderness": [
        r"\bbreast\s+tenderness\b",
        r"\bsore\s+breasts?\b",
        r"\btender\s+breasts?\b",
        r"\bbreast\s+pain\b",
        r"\bbreast\s+swelling\b",
        r"\bsensitive\s+breasts?\b",
    ],
    "Heavy Bleeding": [
        r"\bheavy\s+(?:bleeding|flow|periods?)\b",
        r"\bsoaking\s+(?:through\s+)?(?:a\s+)?(?:pad|tampon)s?\b",
        r"\bblood\s+clots?\b",
        r"\bhuge\s+clots?\b",
        r"\bmenorrhagia\b",
        r"\bexcessive\s+bleeding\b",
    ],
    "Spotting": [
        r"\bspotting\b",
        r"\bbrown\s+discharge\b",
        r"\blight\s+bleeding\s+between\s+periods?\b",
    ],
    "Nausea": [
        r"\bnausea\b",
        r"\bnauseous\b",
        r"\bvomiting\b",
        r"\bthrowing\s+up\b",
        r"\bqueasy\b",
    ],
    "Dizziness": [
        r"\bdizzy\b",
        r"\bdizziness\b",
        r"\bfaint(?:ing|ed)?\b",
        r"\blightheaded\b",
        r"\bvertigo\b",
    ],
    "Hot Flashes / Fever": [
        r"\bfever\b",
        r"\bchills\b",
        r"\bhot\s+flashes?\b",
        r"\bnight\s+sweats?\b",
        r"\bcold\s+sweats?\b",
    ],
    "Insomnia": [
        r"\binsomnia\b",
        r"\bpoor\s+sleep\b",
        r"\bcan(?:'t|\s+not)\s+sleep\b",
        r"\btrouble\s+sleeping\b",
    ],
}

SEVERITY_PATTERNS: Dict[str, List[str]] = {
    "Severe": [
        r"\bsevere(?:ly)?\b",
        r"\bunbearable\b",
        r"\bexcruciating\b",
        r"\bextreme(?:ly)?\b",
        r"\bintense\b",
        r"\bterrible\b",
        r"\bawful\b",
        r"\bworst\b",
        r"\b10\s*(?:out\s+of|/)\s*10\b",
        r"\b9\s*(?:out\s+of|/)\s*10\b",
        r"\b8\s*(?:out\s+of|/)\s*10\b",
        r"\bso\s+much\s+pain\b",
        r"\bsharp\s+stabbing\b",
    ],
    "Moderate": [
        r"\bmoderate(?:ly)?\b",
        r"\bmedium\b",
        r"\bnoticeable\b",
        r"\buncomfortable\b",
        r"\bbothersome\b",
        r"\b(?:5|6|7)\s*(?:out\s+of|/)\s*10\b",
    ],
    "Mild": [
        r"\bmild(?:ly)?\b",
        r"\bslight(?:ly)?\b",
        r"\blight\b",
        r"\bminor\b",
        r"\ba\s+little\b",
        r"\bmanageable\b",
        r"\b(?:1|2|3|4)\s*(?:out\s+of|/)\s*10\b",
    ],
}

MOOD_PATTERNS: Dict[str, List[str]] = {
    "Anxious": [
        r"\banxious\b",
        r"\banxiety\b",
        r"\bworried\b",
        r"\bnervous\b",
        r"\bpanicky\b",
        r"\brestless\b",
    ],
    "Irritated": [
        r"\birritated\b",
        r"\birritable\b",
        r"\birritability\b",
        r"\bsnappy\b",
        r"\bangry\b",
        r"\bfrustrated\b",
        r"\bagitated\b",
        r"\bmood\s+swings?\b",
        r"\bmoody\b",
    ],
    "Sad": [
        r"\bsad\b",
        r"\bdepressed\b",
        r"\bdown\b",
        r"\blow\s+mood\b",
        r"\bfeeling\s+low\b",
        r"\btearful\b",
        r"\bcrying\b",
        r"\bemotional\b",
        r"\bheartbroken\b",
    ],
    "Stressed": [
        r"\bstressed\b",
        r"\bstress\b",
        r"\boverwhelmed\b",
        r"\btense\b",
        r"\bburned\s+out\b",
        r"\bmental(?:ly)?\s+drained\b",
    ],
    "Tired": [
        r"\btired\b",
        r"\bsleepy\b",
        r"\bdrained\b",
        r"\bunmotivated\b",
        r"\bsluggish\b",
    ],
    "Calm": [
        r"\bcalm\b",
        r"\bpeaceful\b",
        r"\brelaxed\b",
        r"\bgrounded\b",
        r"\bbalanced\b",
    ],
    "Happy": [
        r"\bhappy\b",
        r"\bjoyful\b",
        r"\bgreat\b",
        r"\bcheerful\b",
        r"\bpositive\b",
    ],
    "Motivated": [
        r"\bmotivated\b",
        r"\benergetic\b",
        r"\bconfident\b",
        r"\bfocused\b",
        r"\bproductive\b",
    ],
}

CYCLE_PHASE_PATTERNS: Dict[str, List[str]] = {
    "Menstrual": [
        r"\bmenstrual\s+phase\b",
        r"\bon\s+my\s+period\b",
        r"\bduring\s+(?:my\s+)?(?:period|menstruation)\b",
        r"\bwhile\s+menstruating\b",
        r"\bbleeding\s+starts?\b",
        r"\bfirst\s+(?:two\s+)?days?\s+of\s+(?:my\s+)?period\b",
        r"\bday\s+[1-5]\s+of\s+(?:my\s+)?(?:period|cycle)\b",
    ],
    "Follicular": [
        r"\bfollicular\s+phase\b",
        r"\bfollicular\b",
        r"\bafter\s+my\s+period\s+ends?\b",
        r"\bday\s+(?:[6-9]|1[0-2])\s+of\s+(?:my\s+)?cycle\b",
    ],
    "Ovulation": [
        r"\bovulat(?:ion|ory|ing)\s*(?:phase|window)?\b",
        r"\bfertile\s+(?:window|days?|phase)\b",
        r"\bmid[\s-]cycle\b",
        r"\bday\s+1[3-6]\s+of\s+(?:my\s+)?cycle\b",
    ],
    "Luteal": [
        r"\bluteal\s+phase\b",
        r"\bluteal\b",
        r"\bbefore\s+my\s+period\b",
        r"\bpremenstrual\b",
        r"\bpms\b",
        r"\bweek\s+before\s+(?:my\s+)?(?:period|bleeding)\b",
        r"\bday\s+(?:1[7-9]|2[0-8])\s+of\s+(?:my\s+)?cycle\b",
    ],
}

CONDITION_PATTERNS: Dict[str, List[str]] = {
    "PCOS": [
        r"\bpcos\b",
        r"\bpcod\b",
        r"\bpolycystic\s+ovar(?:y|ian)\s+(?:syndrome|disease)\b",
        r"\bpolycystic\s+ovaries\b",
        r"\binsulin\s+resistance\b",
        r"\bhirsutism\b",
    ],
    "Endometriosis": [
        r"\bendometriosis\b",
        r"\bendo\b",
        r"\badenomyosis\b",
    ],
    "Fibroids": [
        r"\bfibroids?\b",
        r"\buterine\s+fibroids?\b",
        r"\bovarian\s+cysts?\b",
        r"\bcysts?\b",
    ],
    "Thyroid": [
        r"\bthyroid\b",
        r"\bhypothyroid(?:ism)?\b",
        r"\bhyperthyroid(?:ism)?\b",
        r"\bhashimoto(?:'s)?\b",
    ],
    "PMDD": [
        r"\bpmdd\b",
        r"\bpremenstrual\s+dysphoric\s+disorder\b",
    ],
    "Anemia": [
        r"\banemi(?:a|c)\b",
        r"\biron\s+deficiency\b",
        r"\blow\s+(?:iron|hemoglobin|ferritin)\b",
    ],
}

DIET_PATTERNS: Dict[str, List[str]] = {
    "Vegan": [
        r"\bvegan\b",
        r"\bplant[\s-]based\b",
        r"\bdairy[\s-]free\b",
    ],
    "Non-Vegetarian": [
        r"\bnon[\s-]veg(?:etarian)?\b",
        r"\beat\s+(?:chicken|fish|meat|eggs?)\b",
    ],
    "Vegetarian": [
        r"\b(?<!non[\s-])veg(?:etarian)?\b",
        r"\bindian\s+vegetarian\b",
        r"\blacto[\s-]vegetarian\b",
    ],
}

# Duration extraction regexes (ordered from specific to general)
DURATION_REGEXES: List[re.Pattern] = [
    re.compile(
        r"\b(?:for\s+(?:the\s+(?:last|past)\s+)?)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+"
        r"(hours?|days?|weeks?|months?|cycles?)\s*(?:straight|late|early|now)?\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bevery\s+(?:\d+\s+)?(hour|60\s+minutes|day|month|cycle|week)s?\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bsince\s+(yesterday|last\s+night|this\s+morning|last\s+week|last\s+month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:first|second|third)\s+(?:one|two|three|\d+)?\s*days?\s+of\s+(?:my\s+)?(?:period|menstruation)\b",
        re.IGNORECASE,
    ),
]


# Intent-specific expected slots for proactive slot-filling prompts
INTENT_REQUIRED_SLOTS: Dict[str, List[str]] = {
    "period_pain_relief": ["symptoms", "severity"],
    "cycle_phase_nutrition": ["cycle_phase", "dietary_preference"],
    "pcos_endometriosis_info": ["medical_conditions"],
    "irregular_cycle_query": ["duration"],
    "pms_mood_support": ["mood", "cycle_phase"],
    "ovulation_fertility_info": ["cycle_phase"],
    "exercise_yoga_guidance": ["cycle_phase"],
    "symptom_tracking_help": ["symptoms", "severity"],
    "emergency_medical_warning": ["symptoms", "severity"],
    "greeting_general_wellness": [],
}

SLOT_CLARIFICATION_PROMPTS: Dict[str, str] = {
    "severity": "Could you share whether your symptoms feel mild, moderate, or severe right now?",
    "duration": "How many days or weeks have you been experiencing this?",
    "cycle_phase": "Which phase of your cycle are you currently in (or what was the start date of your last period)?",
    "dietary_preference": "Do you prefer vegetarian, vegan, or non-vegetarian meal suggestions?",
    "symptoms": "What specific physical symptoms (such as cramps, bloating, headache, or fatigue) are you noticing?",
    "mood": "How have you been feeling emotionally (e.g., anxious, irritable, sad, or tired)?",
    "medical_conditions": "Have you been diagnosed with or are you exploring any specific condition like PCOS, endometriosis, fibroids, or thyroid imbalance?",
}


class HerCareEntityExtractor:
    """Extracts structured women's wellness entities from free-text utterances."""

    def extract(self, text: str) -> Dict[str, Any]:
        if not text or not isinstance(text, str):
            return self._empty_result()

        symptoms = self._match_multi(text, SYMPTOM_PATTERNS)
        severity = self._match_single(text, SEVERITY_PATTERNS)
        moods = self._match_multi(text, MOOD_PATTERNS)
        cycle_phase = self._match_single(text, CYCLE_PHASE_PATTERNS)
        conditions = self._match_multi(text, CONDITION_PATTERNS)
        diet = self._match_single(text, DIET_PATTERNS)
        durations = self._extract_durations(text)
        cycle_day = self._extract_cycle_day(text)

        # Infer cycle phase from cycle_day if not explicitly stated
        if not cycle_phase and cycle_day is not None:
            if 1 <= cycle_day <= 5:
                cycle_phase = "Menstrual"
            elif 6 <= cycle_day <= 12:
                cycle_phase = "Follicular"
            elif 13 <= cycle_day <= 16:
                cycle_phase = "Ovulation"
            elif 17 <= cycle_day <= 35:
                cycle_phase = "Luteal"

        # Infer severe severity if acute red-flag emergency symptoms are matched
        if not severity and "Heavy Bleeding" in symptoms and "Dizziness" in symptoms:
            severity = "Severe"

        return {
            "symptoms": symptoms,
            "severity": severity,
            "duration": durations[0] if durations else None,
            "all_durations": durations,
            "mood": moods,
            "cycle_phase": cycle_phase,
            "medical_conditions": conditions,
            "dietary_preference": diet,
            "cycle_day": cycle_day,
        }

    @staticmethod
    def _empty_result() -> Dict[str, Any]:
        return {
            "symptoms": [],
            "severity": None,
            "duration": None,
            "all_durations": [],
            "mood": [],
            "cycle_phase": None,
            "medical_conditions": [],
            "dietary_preference": None,
            "cycle_day": None,
        }

    @staticmethod
    def _match_multi(text: str, pattern_map: Dict[str, List[str]]) -> List[str]:
        found: List[str] = []
        for label, patterns in pattern_map.items():
            for pat in patterns:
                if re.search(pat, text, flags=re.IGNORECASE):
                    found.append(label)
                    break
        return found

    @staticmethod
    def _match_single(text: str, pattern_map: Dict[str, List[str]]) -> Optional[str]:
        for label, patterns in pattern_map.items():
            for pat in patterns:
                if re.search(pat, text, flags=re.IGNORECASE):
                    return label
        return None

    @staticmethod
    def _extract_durations(text: str) -> List[str]:
        matches: List[str] = []
        for regex in DURATION_REGEXES:
            for m in regex.finditer(text):
                span_text = m.group(0).strip()
                if span_text.lower() not in [x.lower() for x in matches]:
                    matches.append(span_text)
        return matches

    @staticmethod
    def _extract_cycle_day(text: str) -> Optional[int]:
        m = re.search(
            r"\b(?:cycle\s+day|day)\s+(\d{1,2})(?:\s+of\s+(?:my\s+)?(?:cycle|period))?\b",
            text,
            flags=re.IGNORECASE,
        )
        if m:
            day_val = int(m.group(1))
            if 1 <= day_val <= 45:
                return day_val
        return None


@dataclass
class ConversationContext:
    """Represents accumulated slot state and turn history for a conversation session."""

    session_id: str
    slots: Dict[str, Any] = field(
        default_factory=lambda: {
            "symptoms": [],
            "severity": None,
            "duration": None,
            "mood": [],
            "cycle_phase": None,
            "medical_conditions": [],
            "dietary_preference": None,
            "cycle_day": None,
        }
    )
    active_intent: Optional[str] = None
    intent_history: List[str] = field(default_factory=list)
    turn_count: int = 0
    last_updated: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class DialogueSlotManager:
    """
    Manages multi-turn slot filling and conversation context across messages.
    Supports both stateful session-based updates and stateless reconstruction
    from a list of message dicts (as sent by the mobile app).
    """

    def __init__(self, extractor: Optional[HerCareEntityExtractor] = None) -> None:
        self.extractor = extractor or HerCareEntityExtractor()
        self.sessions: Dict[str, ConversationContext] = {}

    def get_or_create_session(self, session_id: str) -> ConversationContext:
        if session_id not in self.sessions:
            self.sessions[session_id] = ConversationContext(session_id=session_id)
        return self.sessions[session_id]

    def reset_session(self, session_id: str) -> None:
        if session_id in self.sessions:
            del self.sessions[session_id]

    def seed_profile_context(
        self,
        session_id: str,
        cycle_phase: Optional[str] = None,
        cycle_day: Optional[int] = None,
        dietary_preference: Optional[str] = None,
        medical_conditions: Optional[List[str]] = None,
        recent_moods: Optional[List[str]] = None,
        recent_symptoms: Optional[List[str]] = None,
    ) -> ConversationContext:
        """Pre-populate slots from user's on-device health profile if provided."""
        ctx = self.get_or_create_session(session_id)
        if cycle_phase and cycle_phase != "Unknown" and not ctx.slots["cycle_phase"]:
            ctx.slots["cycle_phase"] = cycle_phase
        if cycle_day is not None and ctx.slots["cycle_day"] is None:
            ctx.slots["cycle_day"] = cycle_day
        if dietary_preference and not ctx.slots["dietary_preference"]:
            ctx.slots["dietary_preference"] = dietary_preference
        if medical_conditions:
            clean_conds = [c for c in medical_conditions if c and c != "None"]
            for c in clean_conds:
                if c not in ctx.slots["medical_conditions"]:
                    ctx.slots["medical_conditions"].append(c)
        if recent_moods:
            for m in recent_moods:
                if m and m not in ctx.slots["mood"]:
                    ctx.slots["mood"].append(m)
        if recent_symptoms:
            for s in recent_symptoms:
                if s and s not in ctx.slots["symptoms"]:
                    ctx.slots["symptoms"].append(s)
        return ctx

    def update_from_message(
        self,
        session_id: str,
        user_message: str,
        predicted_intent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Extracts entities from the current user message, merges them into
        the session's accumulated slots, checks slot completeness for the
        active intent, and returns a structured slot-filling report.
        """
        ctx = self.get_or_create_session(session_id)
        extracted = self.extractor.extract(user_message)

        # Merge multi-value list slots (preserving order, avoiding duplicates)
        for list_slot in ("symptoms", "mood", "medical_conditions"):
            for item in extracted.get(list_slot, []):
                if item not in ctx.slots[list_slot]:
                    ctx.slots[list_slot].append(item)

        # Override scalar slots when newly mentioned in the latest turn
        for scalar_slot in (
            "severity",
            "duration",
            "cycle_phase",
            "dietary_preference",
            "cycle_day",
        ):
            val = extracted.get(scalar_slot)
            if val is not None:
                ctx.slots[scalar_slot] = val

        if predicted_intent:
            ctx.active_intent = predicted_intent
            ctx.intent_history.append(predicted_intent)

        ctx.turn_count += 1
        ctx.last_updated = datetime.now(timezone.utc).isoformat()

        slot_status = self.evaluate_slot_completeness(
            ctx.slots, ctx.active_intent
        )

        return {
            "session_id": session_id,
            "turn_count": ctx.turn_count,
            "active_intent": ctx.active_intent,
            "intent_history": list(ctx.intent_history),
            "current_turn_entities": extracted,
            "accumulated_slots": {
                k: (list(v) if isinstance(v, list) else v)
                for k, v in ctx.slots.items()
            },
            "slot_status": slot_status,
        }

    def build_context_from_history(
        self,
        messages: List[Dict[str, str]],
        session_id: str = "chat_session",
        latest_intent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Replays a list of {role, content} chat messages to accumulate slots
        across the entire conversation history.
        """
        self.reset_session(session_id)
        user_messages = [
            m["content"]
            for m in messages
            if m.get("role") == "user" and m.get("content")
        ]
        if not user_messages:
            ctx = self.get_or_create_session(session_id)
            return {
                "session_id": session_id,
                "turn_count": 0,
                "active_intent": latest_intent,
                "current_turn_entities": self.extractor._empty_result(),
                "accumulated_slots": ctx.slots,
                "slot_status": self.evaluate_slot_completeness(
                    ctx.slots, latest_intent
                ),
            }

        last_report: Dict[str, Any] = {}
        for idx, msg_text in enumerate(user_messages):
            intent_for_turn = (
                latest_intent if idx == len(user_messages) - 1 else None
            )
            last_report = self.update_from_message(
                session_id=session_id,
                user_message=msg_text,
                predicted_intent=intent_for_turn,
            )
        return last_report

    @staticmethod
    def evaluate_slot_completeness(
        slots: Dict[str, Any], intent: Optional[str]
    ) -> Dict[str, Any]:
        required = INTENT_REQUIRED_SLOTS.get(intent or "", [])
        filled: List[str] = []
        missing: List[str] = []

        for req_slot in required:
            val = slots.get(req_slot)
            if isinstance(val, list) and len(val) > 0:
                filled.append(req_slot)
            elif not isinstance(val, list) and val is not None:
                filled.append(req_slot)
            else:
                missing.append(req_slot)

        follow_up_question = (
            SLOT_CLARIFICATION_PROMPTS.get(missing[0]) if missing else None
        )

        return {
            "required_slots": required,
            "filled_slots": filled,
            "missing_slots": missing,
            "is_complete": len(missing) == 0,
            "follow_up_prompt": follow_up_question,
        }
