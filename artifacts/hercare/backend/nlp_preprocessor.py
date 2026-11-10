"""
NLP Text Preprocessing Module for HerCare AI (UCS760)
Implements:
- Lowercasing & regex text normalization
- Domain synonym & contraction normalization
- NLTK word tokenization
- NLTK stopword removal (preserving clinically meaningful negation/question words)
- NLTK WordNet Lemmatization
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Any

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

# Store NLTK corpora locally inside backend/nltk_data so it works offline/sandboxed
NLTK_DATA_DIR = Path(__file__).resolve().parent / "nltk_data"
NLTK_DATA_DIR.mkdir(parents=True, exist_ok=True)
if str(NLTK_DATA_DIR) not in nltk.data.path:
    nltk.data.path.insert(0, str(NLTK_DATA_DIR))


def ensure_nltk_resources() -> None:
    """Ensure required NLTK corpora are available in NLTK_DATA_DIR."""
    resources = [
        (["tokenizers/punkt", "tokenizers/punkt.zip"], "punkt"),
        (["tokenizers/punkt_tab", "tokenizers/punkt_tab.zip"], "punkt_tab"),
        (["corpora/stopwords", "corpora/stopwords.zip"], "stopwords"),
        (["corpora/wordnet", "corpora/wordnet.zip"], "wordnet"),
        (["corpora/omw-1.4", "corpora/omw-1.4.zip"], "omw-1.4"),
    ]
    for path_keys, pkg_name in resources:
        found = False
        for key in path_keys:
            try:
                nltk.data.find(key)
                found = True
                break
            except LookupError:
                continue
        if not found:
            nltk.download(pkg_name, download_dir=str(NLTK_DATA_DIR), quiet=True)


# Initialize lemmatizer and customized stopwords
_lemmatizer = WordNetLemmatizer()

# Keep domain-relevant question/quantity words that help distinguish intents
_KEEP_WORDS = {
    "what", "why", "how", "when", "which", "should", "can",
    "not", "no", "nor", "never", "without", "more", "most", "very", "too",
}

DOMAIN_SYNONYMS = {
    "pcod": "pcos",
    "polycystic": "pcos",
    "periods": "period",
    "cramps": "cramp",
    "cramping": "cramp",
    "dysmenorrhea": "cramp",
    "bleeding": "bleed",
    "headaches": "headache",
    "migraines": "migraine",
    "workouts": "workout",
    "exercises": "exercise",
    "exercising": "exercise",
    "stretches": "stretch",
    "stretching": "stretch",
    "asanas": "yoga",
    "pilates": "workout",
    "hiit": "workout",
    "gym": "workout",
    "moods": "mood",
    "moody": "mood",
    "anxious": "anxiety",
    "irritated": "irritability",
    "irritable": "irritability",
    "tearful": "cry",
    "crying": "cry",
    "depressed": "sad",
    "stressed": "stress",
    "bloated": "bloating",
    "bloating": "bloating",
    "breasts": "breast",
    "symptoms": "symptom",
    "irregularity": "irregular",
    "delayed": "late",
    "missed": "skip",
    "skipped": "skip",
    "ovulating": "ovulation",
    "ovulatory": "ovulation",
    "fertile": "ovulation",
    "menstruating": "menstruation",
    "soaking": "soak",
    "fainting": "faint",
    "fainted": "faint",
    "clots": "clot",
    "fibroids": "fibroid",
    "cysts": "cyst",
    "foods": "food",
    "meals": "food",
    "snacks": "food",
    "eating": "eat",
}


def get_stopwords() -> set:
    try:
        base_stops = set(stopwords.words("english"))
    except LookupError:
        ensure_nltk_resources()
        base_stops = set(stopwords.words("english"))
    return base_stops - _KEEP_WORDS


def tokenize_text(text: str) -> List[str]:
    """Tokenize text using NLTK word_tokenize with regex fallback."""
    try:
        return word_tokenize(text)
    except LookupError:
        ensure_nltk_resources()
        try:
            return word_tokenize(text)
        except Exception:
            return re.findall(r"\b[a-z0-9]+\b", text.lower())


def lemmatize_token(token: str) -> str:
    """Lemmatize noun and verb forms using NLTK WordNetLemmatizer."""
    if token in DOMAIN_SYNONYMS:
        token = DOMAIN_SYNONYMS[token]
    try:
        lemma_n = _lemmatizer.lemmatize(token, pos="n")
        lemma_v = _lemmatizer.lemmatize(lemma_n, pos="v")
        return DOMAIN_SYNONYMS.get(lemma_v, lemma_v)
    except LookupError:
        ensure_nltk_resources()
        lemma_n = _lemmatizer.lemmatize(token, pos="n")
        lemma_v = _lemmatizer.lemmatize(lemma_n, pos="v")
        return DOMAIN_SYNONYMS.get(lemma_v, lemma_v)


def preprocess_text(text: str) -> str:
    """
    Full NLP preprocessing pipeline:
    1. Lowercasing & contraction expansion
    2. Punctuation/special character cleaning via regex
    3. NLTK word_tokenize
    4. Stopword filtering (preserving clinical/interrogative cues)
    5. WordNet Lemmatization (noun + verb)
    Returns normalized string suitable for TF-IDF vectorization.
    """
    if not text or not isinstance(text, str):
        return ""

    # 1. Lowercase & expand common contractions
    cleaned = text.lower().strip()
    cleaned = re.sub(r"isn't", "is not", cleaned)
    cleaned = re.sub(r"aren't", "are not", cleaned)
    cleaned = re.sub(r"can't", "can not", cleaned)
    cleaned = re.sub(r"won't", "will not", cleaned)
    cleaned = re.sub(r"don't", "do not", cleaned)
    cleaned = re.sub(r"doesn't", "does not", cleaned)
    cleaned = re.sub(r"didn't", "did not", cleaned)
    cleaned = re.sub(r"hasn't", "has not", cleaned)
    cleaned = re.sub(r"haven't", "have not", cleaned)
    cleaned = re.sub(r"i'm", "i am", cleaned)
    cleaned = re.sub(r"it's", "it is", cleaned)
    cleaned = re.sub(r"what's", "what is", cleaned)

    # 2. Remove non-alphanumeric characters
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # 3. Tokenize with NLTK
    tokens = tokenize_text(cleaned)

    # 4. Stopword removal
    stop_words = get_stopwords()
    filtered_tokens = [
        t for t in tokens if (t not in stop_words and len(t) > 1) or t.isdigit()
    ]

    # 5. Lemmatization
    lemmatized_tokens = [lemmatize_token(t) for t in filtered_tokens]

    return " ".join(lemmatized_tokens)


def inspect_preprocessing_steps(text: str) -> Dict[str, Any]:
    """
    Returns intermediate outputs of each NLP preprocessing stage
    for academic inspection and debugging.
    """
    lowered = re.sub(r"[^a-z0-9\s]", " ", text.lower()).strip()
    tokens = tokenize_text(lowered)
    stop_words = get_stopwords()
    without_stopwords = [
        t for t in tokens if (t not in stop_words and len(t) > 1) or t.isdigit()
    ]
    lemmas = [lemmatize_token(t) for t in without_stopwords]
    return {
        "raw_text": text,
        "lowercased_cleaned": re.sub(r"\s+", " ", lowered),
        "tokens": tokens,
        "filtered_tokens": without_stopwords,
        "lemmatized_tokens": lemmas,
        "preprocessed_text": " ".join(lemmas),
    }
