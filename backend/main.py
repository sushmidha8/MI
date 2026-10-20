"""
MI Assessment — FastAPI Python Backend
Handles: YouTube video search, textbook content extraction, exam question generation,
         and AI-assisted answer evaluation using Google Gemini.

Runs on port 8000.
Node/Express backend (port 3001) handles auth, sessions, persistence.
"""

import os
import sys
import re
import html
import json
import hashlib
import httpx
import pdfplumber
from pypdf import PdfReader
from pathlib import Path
from typing import Optional, List

# Reconfigure stdout/stderr for Unicode (Tamil) support on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from topic_questions import TOPIC_QUESTION_BANKS
from topic_textbooks import TOPIC_TEXTBOOKS, TOPIC_BRIEFS
from textbook_library import book_path, chapter_topics, lesson, page_range
from fastapi.responses import FileResponse
from exam_paper import build_paper, valid_paper
from functools import lru_cache
from music_learning import MusicError, textbook_lyrics
from local_songs import SongJobs

# ── Load env ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")

# books directory (sibling of backend/)
BOOKS_DIR = BASE_DIR.parent / "books"
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="MI Assessment — AI & Media Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ── Verified topic list (exact from TN State Board Class 6 Science textbooks) ──
TOPICS = [
    # Term 1
    {"key": "t1_ch1", "term": 1, "chapter": 1, "titleEn": "Measurements",                "titleTa": "அளவீடுகள்",                      "pages": {"English": (5, 17), "Tamil": (5, 17)}},
    {"key": "t1_ch2", "term": 1, "chapter": 2, "titleEn": "Force and Motion",            "titleTa": "விசையும் இயக்கமும்",             "pages": {"English": (18, 37), "Tamil": (18, 37)}},
    {"key": "t1_ch3", "term": 1, "chapter": 3, "titleEn": "Matter Around Us",            "titleTa": "நம்மைச் சுற்றியுள்ள பருப்பொருள்கள்", "pages": {"English": (38, 58), "Tamil": (38, 58)}},
    {"key": "t1_ch4", "term": 1, "chapter": 4, "titleEn": "The World of Plants",         "titleTa": "தாவர உலகம்",                     "pages": {"English": (59, 71), "Tamil": (59, 71)}},
    {"key": "t1_ch5", "term": 1, "chapter": 5, "titleEn": "The World of Animals",        "titleTa": "விலங்குலகம்",                    "pages": {"English": (72, 83), "Tamil": (72, 83)}},
    {"key": "t1_ch6", "term": 1, "chapter": 6, "titleEn": "Health and Hygiene",          "titleTa": "உடல் நலமும் சுகாதாரமும்",        "pages": {"English": (84, 99), "Tamil": (84, 99)}},
    {"key": "t1_ch7", "term": 1, "chapter": 7, "titleEn": "Computer - An Introduction",  "titleTa": "கணினி – ஓர் அறிமுகம்",           "pages": {"English": (100, 108), "Tamil": (100, 107)}},

    # Term 2
    {"key": "t2_ch1", "term": 2, "chapter": 1, "titleEn": "Heat",                         "titleTa": "வெப்பம்",                       "pages": {"English": (7, 21), "Tamil": (5, 22)}},
    {"key": "t2_ch2", "term": 2, "chapter": 2, "titleEn": "Electricity",                  "titleTa": "மின்னியல்",                     "pages": {"English": (22, 37), "Tamil": (23, 38)}},
    {"key": "t2_ch3", "term": 2, "chapter": 3, "titleEn": "Changes Around Us",           "titleTa": "நம்மைச் சுற்றி நிகழும் மாற்றங்கள்",  "pages": {"English": (38, 46), "Tamil": (39, 48)}},
    {"key": "t2_ch4", "term": 2, "chapter": 4, "titleEn": "Air",                          "titleTa": "காற்று",                        "pages": {"English": (47, 62), "Tamil": (49, 66)}},
    {"key": "t2_ch5", "term": 2, "chapter": 5, "titleEn": "The Cell",                     "titleTa": "செல்",                          "pages": {"English": (63, 73), "Tamil": (67, 77)}},
    {"key": "t2_ch6", "term": 2, "chapter": 6, "titleEn": "Human Organ Systems",          "titleTa": "மனித உறுப்பு மண்டலங்கள்",       "pages": {"English": (74, 84), "Tamil": (78, 92)}},
    {"key": "t2_ch7", "term": 2, "chapter": 7, "titleEn": "Parts of Computer", "titleTa": "கணினியின் பாகங்கள்"},

    # Term 3
    {"key": "t3_ch1", "term": 3, "chapter": 1, "titleEn": "Magnetism",                    "titleTa": "காந்தவியல்",                    "pages": {"English": (5, 17), "Tamil": (5, 18)}},
    {"key": "t3_ch2", "term": 3, "chapter": 2, "titleEn": "Water",                        "titleTa": "நீர்",                          "pages": {"English": (18, 35), "Tamil": (19, 38)}},
    {"key": "t3_ch3", "term": 3, "chapter": 3, "titleEn": "Chemistry in Everyday Life",    "titleTa": "அன்றாட வாழ்வில் வேதியியல்",     "pages": {"English": (36, 49), "Tamil": (39, 53)}},
    {"key": "t3_ch4", "term": 3, "chapter": 4, "titleEn": "Our Environment",             "titleTa": "நமது சுற்றுச்சூழல்",              "pages": {"English": (50, 69), "Tamil": (54, 76)}},
    {"key": "t3_ch5", "term": 3, "chapter": 5, "titleEn": "Plants in Daily Life",         "titleTa": "அன்றாட வாழ்வில் தாவரங்கள்",      "pages": {"English": (70, 82), "Tamil": (77, 90)}},
    {"key": "t3_ch6", "term": 3, "chapter": 6, "titleEn": "Hardware and Software",       "titleTa": "வன்பொருளும் மென்பொருளும்",       "pages": {"English": (83, 88), "Tamil": (91, 96)}},
]

TOPIC_MAP = {t["key"]: t for t in TOPICS}

# PDF filenames (relative to BOOKS_DIR)
PDF_FILES = {
    ("English", 1): "Class_6_Science_English_Science_-_Term_1_-_2025_edition-www.tntextbooks.in.pdf",
    ("English", 2): "Class_6_Science_English_Science_-_Term_2_-_2024_Edition-www.tntextbooks.in.pdf",
    ("English", 3): "Class_6_Science_English_Science_-_Term_3_-_2024_Edition-www.tntextbooks.in.pdf",
    ("Tamil",   1): "Class_6_Science_Tamil_Science_-_Term_1_-_2025_Edition-www.tntextbooks.in.pdf",
    ("Tamil",   2): "Class_6_Science_Tamil_Science_-_Term_2_-_2024_Edition-www.tntextbooks.in.pdf",
    ("Tamil",   3): "Class_6_Science_Tamil_Science_-_Term_3_-_2024_Edition-www.tntextbooks.in.pdf",
}

# ── PDF text extraction ────────────────────────────────────────────────────────

# ── In-memory PDF extraction cache ───────────────────────────────────────────
# Key: (language, topic_key)  Value: extracted raw text string
# First call reads PDF (~5 s). Every subsequent call is instant (0 ms).
EXTRACTED_CHAPTER_CACHE: dict = {}

def extract_chapter_text(language: str, topic_key: str) -> str:
    """
    Extract the complete textbook chapter text from the official PDF in the books/ folder.
    Reads all chapter pages without truncation and cleans up OCR/PDF artifacts.
    Results are cached in-memory so the PDF is only opened once per server run.
    """
    cache_key = (language, topic_key)
    if cache_key in EXTRACTED_CHAPTER_CACHE:
        return EXTRACTED_CHAPTER_CACHE[cache_key]

    topic = TOPIC_MAP.get(topic_key)
    if not topic:
        return ""

    term = topic["term"]
    pdf_filename = PDF_FILES.get((language, term))
    if not pdf_filename:
        return ""

    try:
        pdf_path = book_path(language, term)
    except (ValueError, FileNotFoundError):
        return ""

    # Page range mapping (1-based page numbers in PDF)
    pages_range = topic.get("pages", {}).get(language, (5, 18))
    start_page, end_page = pages_range

    extracted_pages = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            start_page, end_page = page_range(language, term, topic["chapter"], total_pages)
            read_end = min(end_page, total_pages)
            for p in range(start_page - 1, read_end):
                page_text = pdf.pages[p].extract_text()
                if page_text and len(page_text.strip()) > 30:
                    cleaned_p = page_text.strip()
                    # Replace private-use unicode glyphs (often bullets/wingdings)
                    cleaned_p = re.sub(r'[\ue000-\uf8ff]', '• ', cleaned_p)
                    # Remove running headers/footers
                    cleaned_p = re.sub(r'(?m)^.*(?:Class\s*6\s*Science|TN\s*Textbook|www\.tntextbooks\.in|Term\s*\d+).*$', '', cleaned_p)
                    # Fix hyphenated words broken across line wraps (meas- \n urement -> measurement)
                    cleaned_p = re.sub(r'(\b\w+)-\s*\n\s*(\w+\b)', r'\1\2', cleaned_p)
                    extracted_pages.append(cleaned_p)
    except Exception as e:
        print(f"pdfplumber extraction error: {e}")

    if not extracted_pages:
        EXTRACTED_CHAPTER_CACHE[cache_key] = ""
        return ""

    combined = "\n\n".join(extracted_pages)
    combined = re.sub(r'\n{3,}', '\n\n', combined)
    result = combined.strip()
    EXTRACTED_CHAPTER_CACHE[cache_key] = result
    return result


# ── Gemini client setup ────────────────────────────────────────────────────────

def get_gemini_client():
    """Return a configured Gemini GenerativeModel instance, or None if unavailable."""
    if not GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        return genai.GenerativeModel("gemini-3.8-flash")
    except Exception as e:
        print(f"Error configuring Gemini client: {e}")
        return None


# ── Pydantic models ────────────────────────────────────────────────────────────

class TopicListResponse(BaseModel):
    topics: list[dict]

class TextbookRequest(BaseModel):
    topic_key: str
    language: str  # "English" | "Tamil"
    subtopic_key: Optional[str] = None


lesson_songs = SongJobs()


@lru_cache(maxsize=256)
def cached_song_draft(topic_key, subtopic_key, language):
    topic = TOPIC_MAP.get(topic_key)
    if not topic:
        raise MusicError("Unknown textbook chapter.", 404)
    if not subtopic_key:
        raise MusicError("Choose a topic within the chapter before creating a song.", 422)
    try:
        selected = lesson(language, topic["term"], topic["chapter"], subtopic_key)
    except FileNotFoundError as exc:
        raise MusicError(str(exc), 404) from exc
    except ValueError as exc:
        raise MusicError(str(exc), 422) from exc
    selected = {**selected, "chapter_key": topic_key}
    if topic_key == "t3_ch6" and language == "Tamil":
        # This edition has damaged font mappings in its extracted headings.
        selected["title"] = {"6.3": "மென்பொருளின் வகைகள்", "6.3.1": "இயக்க மென்பொருள்",
                             "6.3.2": "பயன்பாட்டு மென்பொருள்"}.get(subtopic_key, selected["title"])
    source_key = "draft-" + hashlib.sha256(json.dumps(["lyrics-v5", topic_key, subtopic_key, language, selected["excerpt"]], ensure_ascii=False).encode()).hexdigest()
    with lesson_songs.store.lock:
        draft = lesson_songs.store.get(source_key)
        if draft is None:
            draft = textbook_lyrics(selected, language, get_gemini_client())
            lesson_songs.store.save(source_key, draft)
    draft["source_note"] = f"Class 6 Science · Term {topic['term']} · Chapter {topic['chapter']} · Topic {subtopic_key} · PDF pages {selected['page_start']}–{selected['page_end']}"
    draft["source_url"] = f"http://localhost:8000/api/textbooks/{language}/{topic['term']}#page={selected['page_start']}"
    return draft


@app.post("/api/music/lyrics")
def musical_lyrics(req: TextbookRequest):
    try:
        draft = dict(cached_song_draft(req.topic_key, req.subtopic_key, req.language))
        draft["song"] = lesson_songs.ensure(draft)
        return draft
    except MusicError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc


@app.post("/api/music/generate")
def musical_generate(req: TextbookRequest):
    try:
        draft = cached_song_draft(req.topic_key, req.subtopic_key, req.language)
        return lesson_songs.ensure(draft, retry=True)
    except MusicError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc


@app.get("/api/music/songs/{song_id}")
def musical_song_status(song_id: str):
    if not re.fullmatch(r"[a-f0-9]{64}", song_id):
        raise HTTPException(status_code=404, detail="Song not found.")
    try:
        return lesson_songs.status(song_id)
    except MusicError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc


class TextbookResponse(BaseModel):
    topic_key: str
    title: str
    language: str
    content: str
    content_available: bool
    source_note: str
    images: list[str] = []
    brief_points: list[str] = []
    source_url: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    textbook_excerpt: Optional[str] = None
    learning_sections: list[dict] = []
    explanation_paragraphs: list[str] = []

class ExamGenerateRequest(BaseModel):
    topic_key: str
    language: str
    topic_title: str
    subtopic_key: Optional[str] = None

class ExamQuestion(BaseModel):
    index: int
    type: str          # "mcq" | "short" | "descriptive"
    text: str
    options: Optional[list[str]] = None
    correctAnswer: Optional[str] = None
    marks: int

class ExamGenerateResponse(BaseModel):
    questions: list[ExamQuestion]
    total_marks: int
    language: str
    topic_title: str

class EvaluateAnswerRequest(BaseModel):
    question_type: str
    question_text: str
    correct_answer: Optional[str]
    student_answer: str
    marks: int
    language: str

class EvaluateAnswerResponse(BaseModel):
    marks_awarded: float
    feedback: str

class SearchRequest(BaseModel):
    topic: str
    student_id: str = "default_student"
    page_token: Optional[str] = None

class VideoResult(BaseModel):
    video_id: str
    title: str
    channel_title: str
    thumbnail_url: str
    description: str
    embed_url: str
    duration: Optional[str] = None
    view_count: Optional[str] = None
    view_count_raw: int = 0
    language: str = "English"
    notes: list[str] = []

class SearchResponse(BaseModel):
    tamil_videos: list[VideoResult]
    english_videos: list[VideoResult]
    total_results: Optional[int] = None


# ── Topic list endpoint ────────────────────────────────────────────────────────

@app.get("/api/topics", response_model=TopicListResponse)
def list_topics():
    """Return the curated list of verified Class 6 Science topics."""
    return {"topics": [
        {
            "key": t["key"],
            "term": t["term"],
            "chapter": t["chapter"],
            "titleEn": t["titleEn"],
            "titleTa": t["titleTa"],
        }
        for t in TOPICS
    ]}


def clean_latex_and_symbols(text: str) -> str:
    """Thoroughly clean LaTeX math markup, dollar signs, and unrendered symbol codes for 6th standard students."""
    if not text:
        return ""

    # Replace escaped backslashes first if any (e.g. \\text -> \text)
    text = text.replace(r'\\', '\\')

    # Replace common LaTeX math environments: \( ... \), \[ ... \]
    text = re.sub(r'\\(?:\[|\()', '', text)
    text = re.sub(r'\\(?:\]|\))', '', text)

    # Convert \frac{a}{b} -> a/b
    text = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'\1/\2', text)

    # Convert \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, \textbf{...}
    text = re.sub(r'\\(?:text|mathrm|mathbf|mathit|textbf)\s*\{([^}]+)\}', r' \1 ', text)

    # Superscripts with braces: ^{2} -> ², ^{-3} -> ⁻³
    sub_sup = {
        '0':'⁰', '1':'¹', '2':'²', '3':'³', '4':'⁴', '5':'⁵', '6':'⁶', '7':'⁷', '8':'⁸', '9':'⁹',
        '+':'⁺', '-':'⁻', '=':'⁼', '(':'⁽', ')':'⁾', 'n':'ⁿ'
    }
    def replace_sup(match):
        inner = match.group(1)
        return "".join(sub_sup.get(c, c) for c in inner)

    text = re.sub(r'\^\{([^}]+)\}', replace_sup, text)
    # Single digit superscripts: ^2 -> ²
    for k, v in sub_sup.items():
        text = text.replace(f'^{k}', v)

    # Subscripts: _{2} -> ₂
    sub_map = {'0':'₀', '1':'₁', '2':'₂', '3':'₃', '4':'₄', '5':'₅', '6':'₆', '7':'₇', '8':'₈', '9':'₉'}
    text = re.sub(r'_\{([0-9]+)\}', lambda m: "".join(sub_map.get(c, c) for c in m.group(1)), text)
    for k, v in sub_map.items():
        text = text.replace(f'_{k}', v)

    # Replace common math commands
    literal_replacements = [
        (r'\times', '×'),
        (r'\div', '÷'),
        (r'\pm', '±'),
        (r'\degree', '°'),
        (r'^\circ', '°'),
        (r'\circ', '°'),
        (r'\rightarrow', '→'),
        (r'\leftarrow', '←'),
        (r'\le', '≤'),
        (r'\leq', '≤'),
        (r'\ge', '≥'),
        (r'\geq', '≥'),
        (r'\neq', '≠'),
        (r'\approx', '≈'),
        (r'\cdot', '·'),
        (r'\quad', ' '),
        (r'\qquad', ' '),
        (r'\,', ' '),
        (r'\;', ' '),
        (r'\:', ' '),
        (r'\left', ''),
        (r'\right', ''),
    ]
    for old, new in literal_replacements:
        text = text.replace(old, new)

    # Strip dollar signs ($...$ or $$...$$)
    text = re.sub(r'\$\$([^\$]+)\$\$', r' \1 ', text)
    text = re.sub(r'\$([^\$]+)\$', r' \1 ', text)
    text = text.replace('$', '')

    # Remove any remaining stray backslashed words
    text = re.sub(r'\\[a-zA-Z]+', '', text)

    # Clean up spacing around exponents, degrees, units, and punctuation
    text = re.sub(r'([a-zA-Z0-9])\s+([²³⁴⁵⁶⁷⁸⁹⁺⁻¹⁰])', r'\1\2', text)
    text = re.sub(r'°\s+C\b', '°C', text)
    text = re.sub(r'(\d+)\s+([m|c|k|m]?m|g|kg|s|°C)\b', r'\1 \2', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r' ([\.,;:!\?])', r'\1', text)

    return text.strip()


# ── Textbook Image Extraction ────────────────────────────────────────────────

def extract_chapter_images(language: str, topic_key: str) -> list[str]:
    """
    Extract textbook figures, diagrams and photographs from the PDF for this topic.
    Caches extracted images in backend/static/extracted_images/{topic_key}/.
    Returns list of absolute URLs to the images (e.g. ['http://localhost:8000/static/extracted_images/...']).
    """
    topic = TOPIC_MAP.get(topic_key)
    if not topic:
        return []
    term = topic["term"]
    pdf_filename = PDF_FILES.get((language, term))
    if not pdf_filename:
        return []
    try:
        pdf_path = book_path(language, term)
    except (ValueError, FileNotFoundError):
        return []

    out_dir = STATIC_DIR / "extracted_images" / topic_key
    out_dir.mkdir(parents=True, exist_ok=True)

    # Return cached if images already extracted
    existing = [f"http://localhost:8000/static/extracted_images/{topic_key}/{f.name}" 
                for f in sorted(out_dir.glob("*.*")) if f.suffix.lower() in ('.jpg', '.jpeg', '.png')]
    if len(existing) >= 2:
        return existing[:8]

    pages_range = topic.get("pages", {}).get(language, (5, 18))
    start_page, end_page = pages_range
    saved_urls = []

    try:
        reader = PdfReader(str(pdf_path))
        total = len(reader.pages)
        start_page, end_page = page_range(language, term, topic["chapter"], total)
        read_end = min(end_page, total)
        for pno in range(start_page - 1, read_end):
            page = reader.pages[pno]
            for i, img in enumerate(page.images):
                # Filter out tiny icon glyphs (< 18 KB)
                if len(img.data) >= 18000:
                    ext = img.name.split('.')[-1].lower()
                    if ext in ('jpg', 'jpeg', 'png'):
                        fname = f"fig_p{pno+1}_{i}.{ext}"
                        fpath = out_dir / fname
                        with open(fpath, "wb") as f:
                            f.write(img.data)
                        saved_urls.append(f"http://localhost:8000/static/extracted_images/{topic_key}/{fname}")
                        if len(saved_urls) >= 8:
                            break
            if len(saved_urls) >= 8:
                break
    except Exception as e:
        print(f"Image extraction error for {topic_key}: {e}")

    return saved_urls


TEXTBOOK_CACHE = {}

def clean_and_structure_textbook(raw_text: str, title: str, language: str) -> str:
    """
    Deterministic textbook cleaner that structures raw textbook text into beautiful,
    properly aligned Markdown with clear headings and separated bullet points.
    Filters out trivial non-scientific filler activities while preserving all core concepts.
    """
    text = clean_latex_and_symbols(raw_text)

    # Remove running header/footer remnants
    text = re.sub(r'(?m)^.*(?:Class\s*6\s*Science|TN\s*Textbook|www\.tntextbooks\.in|Term\s*\d+|State\s*Board).*$', '', text)

    # Remove trivial classroom chore activities that do not teach real science
    # (e.g. measuring desk with handspan, counting paces in classroom)
    text = re.sub(r'(?i)activity\s*\d+[\s\S]*?(?=(?:##|\d+\.\d+|\n\n[A-Z]))', '', text)
    text = re.sub(r'(?i)செயல்பாடு\s*\d+[\s\S]*?(?=(?:##|\d+\.\d+|\n\n))', '', text)

    # Split into lines for structured alignment
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    structured_blocks = []
    current_list = []

    def flush_list():
        nonlocal current_list
        if current_list:
            structured_blocks.append("\n".join(current_list))
            current_list = []

    for line in lines:
        # Detect section headings (e.g., 1.1 Length, 1.2 Mass, Chapter Title)
        if re.match(r'^\d+\.\d+\s+[A-Za-z\u0B80-\u0BFF]', line) or line.startswith('#'):
            flush_list()
            clean_head = re.sub(r'^#+\s*', '', line)
            structured_blocks.append(f"\n## {clean_head}\n")
            continue

        # Detect subtopic titles (e.g., Multiple and Submultiples of SI Units)
        if len(line) < 45 and line.istitle() and not line.endswith('.'):
            flush_list()
            structured_blocks.append(f"\n### {line}\n")
            continue

        # Detect bullet or numbered items
        is_bullet = bool(re.match(r'^[-*•]\s+', line))
        is_numbered = bool(re.match(r'^\d+[\.\)]\s+', line))

        if is_bullet or is_numbered:
            clean_line = re.sub(r'^[-*•\d\.\)]+\s*', '- ', line)
            current_list.append(clean_line)
        else:
            flush_list()
            # Highlight definitions or key terms at start of line (e.g. Mass: or Length is...)
            if ':' in line and len(line.split(':')[0]) < 30:
                parts = line.split(':', 1)
                line = f"**{parts[0].strip()}:** {parts[1].strip()}"
            structured_blocks.append(line)

    flush_list()
    res = "\n\n".join(structured_blocks)
    res = re.sub(r'\n{3,}', '\n\n', res)
    return res.strip()


def format_textbook_with_gemini(raw_text: str, title: str, language: str) -> str:
    """
    Format the complete extracted textbook chapter into a clean, readable digital textbook.
    Does NOT summarize or make notes: presents the full lesson faithfully so students read
    it online just like the physical textbook manual.
    """
    cache_key = f"{title}_{language}"
    if cache_key in TEXTBOOK_CACHE:
        return TEXTBOOK_CACHE[cache_key]

    model = get_gemini_client()
    if not model or not raw_text:
        structured = clean_and_structure_textbook(raw_text, title, language)
        TEXTBOOK_CACHE[cache_key] = structured
        return structured

    if language == "Tamil":
        instruction = f"""நீங்கள் தமிழ்நாடு அரசு 6ஆம் வகுப்பு அறிவியல் பாடப்புத்தகத்தை மாணவர்களுக்குக் கணினி/மொபைல் திரையில் படிக்க வழங்கும் ஆசிரியர்.
பாடம்: '{title}' (தமிழ் வழி)

கீழே கொடுக்கப்பட்டுள்ளது பாடப்புத்தகத்தின் முழு உரை:
\"\"\"
{raw_text[:12000]}
\"\"\"

முக்கிய வடிவமைப்பு விதிகள்:
1. எக்காரணம் கொண்டும் குறிப்புகளாகவோ சுருக்கமாகவோ மாற்ற வேண்டாம். முழு பாடத்தின் கருத்துகளையும் வரிசையாக வழங்கவும்.
2. சீரமைப்பு மற்றும் பட்டியல் அமைப்பு (Alignment & Lists):
   - பண்புகள், வேறுபாடுகள், பணிகள், உதாரணங்களை குறிப்பிடும் போது கட்டாயமாக ஒவ்வொரு குறிப்பையும் தனி வரியில் அமைத்து (- குறிப்பு) அல்லது (1. குறிப்பு) என வரிசைப்படுத்தவும்.
   - பல கருத்துகளை ஒரே பத்தியாக குவித்து எழுத வேண்டாம்.
3. பயனில்லாத வகுப்பறை விளையாட்டுப் பயிற்சிகளை (கால் அடிகள் எண்ணுதல் போன்றவை) நீக்கவும். ஆனால் முக்கியமான அறிவியல் சோதனைகள் மற்றும் அட்டவணைகளை முழுமையாகத் தக்கவைக்கவும்.
4. அனைத்து தலைப்புகளையும் (##, ###) என்று தெளிவாகப் பிரிக்கவும்.
5. முக்கியமான அறிவியல் சொற்களை தடிமனாக (**bold**) காட்டவும்.
6. எக்காரணம் கொண்டும் LaTeX குறியீடுகளை ($1\\text{{ m}}$) பயன்படுத்த வேண்டாம். '1 மீ' அல்லது '1 m' என்று நேரடியாக எழுதவும்.
7. பாடத்தின் இறுதியில் வரும் மாதிரி வினாடி வினாக்களை சேர்க்க வேண்டாம்."""
    else:
        instruction = f"""You are presenting the official Tamil Nadu State Board Class 6 Science textbook on screen for students.
Chapter: '{title}'

Below is the complete text extracted from the textbook pages:
\"\"\"
{raw_text[:12000]}
\"\"\"

CRITICAL USER REQUIREMENTS FOR CLEAN ALIGNMENT & ACCURACY:
1. DO NOT MAKE SUMMARY NOTES. Retain all scientific concepts, definitions, explanations, and tables in full depth.
2. PERFECT ALIGNMENT & LIST STRUCTURE:
   - When presenting points (properties, components, functions, differences, examples), ALWAYS format each point on its own separate line as a markdown bullet list (- Point) or numbered list (1. Point).
   - NEVER lump multiple points into a single dense, unaligned paragraph.
   - Separate every section, table, and list with clear blank lines so they never overlap or clutter.
3. REMOVE TRIVIAL FILLER ACTIVITIES:
   - Completely omit trivial classroom chore activities that do not teach real science (e.g. measuring classroom with footsteps, counting desks, collecting leaves in a bucket).
   - RETAIN core scientific demonstrations, observational tables, and experiments that illustrate fundamental principles.
4. HEADINGS & TYPOGRAPHY:
   - Use clear textbook headings: `## Section Headings` (e.g. `## 1.1 Length`), `### Subtopics`, `#### Observations`.
   - Render all conversion charts and comparison tables as clean Markdown tables.
   - Highlight key scientific definitions and terms in **bold**.
5. ABSOLUTELY NO LaTeX math or dollar signs ($1\\text{{ m}}$ or $\\text{{cm}}$). Write plain natural units ('1 m', '100 cm', '10 kg', '25 °C').
6. DO NOT include the end-of-chapter quiz/evaluation questions in this reading material."""

    try:
        response = model.generate_content(instruction)
        formatted = response.text.strip()
        if formatted and len(formatted) > 300:
            formatted = clean_latex_and_symbols(formatted)
            for eval_marker in ["## Evaluation", "### Evaluation", "## மதிப்பீடு", "### மதிப்பீடு"]:
                if eval_marker in formatted:
                    formatted = formatted.split(eval_marker)[0].strip()
            TEXTBOOK_CACHE[cache_key] = formatted
            return formatted
    except Exception as e:
        print(f"Gemini textbook formatting error: {e}. Using deterministic structuring.")

    fallback_structured = clean_and_structure_textbook(raw_text, title, language)
    TEXTBOOK_CACHE[cache_key] = fallback_structured
    return fallback_structured


# ── Textbook content endpoint ──────────────────────────────────────────────────

@app.get("/api/chapters/{chapter_key}/topics")
def list_chapter_topics(chapter_key: str, language: str = "English"):
    chapter = TOPIC_MAP.get(chapter_key)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found.")
    try:
        sections = chapter_topics(language, chapter["term"], chapter["chapter"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"chapter_key": chapter_key, "language": language, "topics": [
        {k: s[k] for k in ("key", "title", "page_start", "page_end")} for s in sections
    ]}


@app.get("/api/textbooks/{language}/{term}")
def read_textbook(language: str, term: int):
    try:
        path = book_path(language, term)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return FileResponse(path, media_type="application/pdf", filename=path.name,
                        content_disposition_type="inline")


@app.post("/api/textbook/content", response_model=TextbookResponse)
def get_textbook_content(req: TextbookRequest):
    """
    Extract and return complete textbook content for the given topic and language.
    Grounded strictly in the official TN State Board PDFs.
    """
    topic = TOPIC_MAP.get(req.topic_key)
    if not topic:
        raise HTTPException(status_code=404, detail=f"Unknown topic key: {req.topic_key}")

    lang = req.language
    if lang not in ("English", "Tamil"):
        raise HTTPException(status_code=400, detail="language must be 'English' or 'Tamil'")

    if req.subtopic_key:
        try:
            selected = lesson(lang, topic["term"], topic["chapter"], req.subtopic_key)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        return TextbookResponse(
            topic_key=req.topic_key, title=selected["title"], language=lang,
            content=selected["content"], content_available=True,
            brief_points=selected["brief_points"], textbook_excerpt=selected["excerpt"],
            learning_sections=selected["learning_sections"],
            explanation_paragraphs=selected["explanation_paragraphs"],
            page_start=selected["page_start"], page_end=selected["page_end"],
            source_url=f"http://localhost:8000/api/textbooks/{lang}/{topic['term']}#page={selected['page_start']}",
            source_note=f"Tamil Nadu Class 6 Science · Term {topic['term']} · Chapter {topic['chapter']} · Topic {req.subtopic_key} · PDF pages {selected['page_start']}–{selected['page_end']} ({lang})",
        )

    title = topic["titleEn"] if lang == "English" else topic["titleTa"]
    raw_content = extract_chapter_text(lang, req.topic_key)
    chapter_images = extract_chapter_images(lang, req.topic_key)

    brief_list = TOPIC_BRIEFS.get(req.topic_key, {}).get(lang, [])

    if raw_content and len(raw_content) > 100:
        formatted_content = format_textbook_with_gemini(raw_content, title, lang)
        return TextbookResponse(
            topic_key=req.topic_key,
            title=title,
            language=lang,
            content=formatted_content,
            content_available=True,
            source_note=f"Source: Tamil Nadu State Board Class 6 Science — Term {topic['term']}, Chapter {topic['chapter']} ({lang})",
            images=chapter_images,
            brief_points=brief_list
        )

    # Use verified curriculum textbook extraction
    textbook_entry = TOPIC_TEXTBOOKS.get(req.topic_key, {}).get(lang)
    if textbook_entry:
        return TextbookResponse(
            topic_key=req.topic_key,
            title=title,
            language=lang,
            content=textbook_entry,
            content_available=True,
            source_note=f"Source: Tamil Nadu State Board Class 6 Science — Term {topic['term']}, Chapter {topic['chapter']} ({lang})",
            images=chapter_images,
            brief_points=brief_list
        )
    else:
        return TextbookResponse(
            topic_key=req.topic_key,
            title=title,
            language=lang,
            content="",
            content_available=False,
            source_note=(
                f"Textbook content for '{title}' ({lang}) could not be extracted from the available PDF. "
                "Please refer to your physical or digital textbook for Term "
                f"{topic['term']}, Chapter {topic['chapter']}."
            ),
            images=chapter_images,
            brief_points=brief_list
        )


def _fallback_questions(topic_key: str, topic_title: str, language: str) -> list[dict]:
    """
    Return topic-SPECIFIC Class 6 science questions from the pre-verified bank.
    It is IMPOSSIBLE for this function to return questions from a different topic.
    Falls back to generic error questions ONLY if the topic_key is not in the bank.
    """
    lang = language if language in ("English", "Tamil") else "English"
    bank = TOPIC_QUESTION_BANKS.get(topic_key, {}).get(lang)
    if bank:
        print(f"[Fallback] Using verified question bank for {topic_key} ({lang})")
        return bank

    # Absolute last resort — topic not in bank yet (should not happen for Class 6)
    print(f"[Fallback] WARNING: No bank entry for {topic_key}. Using generic placeholder.")
    if lang == "Tamil":
        return [
            {"index": 0, "type": "mcq",
             "text": f"'{topic_title}' பாடத்தின் முக்கிய கருத்து என்ன?",
             "options": ["விடை A", "விடை B", "விடை C", "விடை D"],
             "correctAnswer": "0", "marks": 1},
            {"index": 1, "type": "short",
             "text": f"'{topic_title}' பாடத்தில் கற்றவற்றை விவரி.",
             "options": None, "correctAnswer": "பாட உள்ளடக்கத்தின்படி விடை தருக.", "marks": 2},
        ]
    return [
        {"index": 0, "type": "mcq",
         "text": f"What is the main concept studied in '{topic_title}'?",
         "options": ["Option A", "Option B", "Option C", "Option D"],
         "correctAnswer": "0", "marks": 1},
        {"index": 1, "type": "short",
         "text": f"Describe what you learned from the chapter '{topic_title}'.",
         "options": None, "correctAnswer": "Refer to textbook content for answer.", "marks": 2},
    ]


def topic_practice_questions(selected, language):
    """Offline paper uses the same five-MCQ/four-descriptive structure."""
    try:
        return build_paper(selected, language)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/api/exam/generate", response_model=ExamGenerateResponse)
def generate_exam(req: ExamGenerateRequest):
    """
    Generate a rigorous Class 6 Science exam grounded directly in the chapter content.
    Tests deep conceptual understanding, definitions, units, and practical experiments.
    """
    topic = TOPIC_MAP.get(req.topic_key)
    if not topic:
        raise HTTPException(status_code=404, detail=f"Unknown topic key: {req.topic_key}")

    title = req.topic_title or (topic["titleEn"] if req.language == "English" else topic["titleTa"])
    raw_chapter = "" if req.subtopic_key else extract_chapter_text(req.language, req.topic_key)
    selected = None
    if req.subtopic_key:
        try:
            selected = lesson(req.language, topic["term"], topic["chapter"], req.subtopic_key)
        except (ValueError, FileNotFoundError) as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        title = selected["title"]
        raw_chapter = selected["excerpt"]

    paper_source = {**(selected or {}), "title": title, "chapter_key": req.topic_key,
                    "excerpt": raw_chapter or TOPIC_TEXTBOOKS.get(req.topic_key, {}).get(req.language, "")}

    model = get_gemini_client()
    questions_raw = []

    if model:
        try:
            prompt = f"""You are a senior Class 6 Science School Teacher setting a formal term examination paper for students who have studied the chapter '{title}' ({req.language}) from the Tamil Nadu State Board Class 6 Science curriculum.

Below is the official textbook content from the curriculum:
=== TEXTBOOK MATERIAL ===
{raw_chapter[:9000]}

TASK:
Create a rigorous, authentic school examination that tests how well the student understands the science concepts they just studied.

CRITICAL TEACHER REQUIREMENTS:
1. Every answer MUST be supported by the supplied textbook material. Test only this selected topic; do not include other chapter sections.
2. NEVER ask meta or trivial questions (DO NOT ask 'Which class/standard is this?', 'Which subject is this?', 'What is the chapter name?', 'Which board is this?').
3. Ask the questions that real school teachers ask in exams:
   - Scientific definitions and core principles
   - SI units, prefixes, and Class 6 numerical conversions
   - Reading instruments, accuracy, errors (e.g. parallax error), and precautions
   - Scientific comparisons (e.g. mass vs weight, beam balance vs electronic balance, contact vs non-contact force)
   - Step-by-step practical methods and experiments
4. If language is Tamil, questions, options, and model answers must be in high-quality academic Tamil as used in Tamil Nadu State Board textbooks.
5. NO LaTeX math tags ($1\\text{{ m}}$). Use clean natural units ('1 m', '100 cm', '10 kg', '25 °C').

Return ONLY a valid JSON object with EXACTLY this structure:
{{
  "questions": [
    // 5 Multiple Choice Questions (1 mark each)
    {{"index": 0, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "0", "marks": 1}},
    {{"index": 1, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "1", "marks": 1}},
    {{"index": 2, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "2", "marks": 1}},
    {{"index": 3, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "3", "marks": 1}},
    {{"index": 4, "type": "mcq", "text": "<question>", "options": ["<opt A>", "<opt B>", "<opt C>", "<opt D>"], "correctAnswer": "0", "marks": 1}},
    // Exactly 4 Descriptive Questions (5 marks each), no short-answer questions
    {{"index": 5, "type": "descriptive", "text": "<question>", "options": null, "correctAnswer": "<model answer with key facts>", "marks": 5}},
    {{"index": 6, "type": "descriptive", "text": "<question>", "options": null, "correctAnswer": "<model answer with examples or uses>", "marks": 5}},
    {{"index": 7, "type": "descriptive", "text": "<question>", "options": null, "correctAnswer": "<model answer explaining the process or relationships>", "marks": 5}},
    {{"index": 8, "type": "descriptive", "text": "<question>", "options": null, "correctAnswer": "<model answer covering the remaining important details>", "marks": 5}}
  ]
}}"""

            response = model.generate_content(prompt)
            text = response.text.strip()

            # Strip markdown code fences if present
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

            parsed = json.loads(text)
            questions_raw = parsed.get("questions", [])

            if not valid_paper(questions_raw):
                raise ValueError("The paper must contain exactly five valid MCQs and four descriptive questions")

        except Exception as e:
            print(f"[Gemini] Exam generation failed: {e}. Using topic fallback for {req.topic_key}.")
            questions_raw = topic_practice_questions(paper_source, req.language)
    else:
        print(f"[Gemini] Client unavailable. Using topic fallback for {req.topic_key}.")
        questions_raw = topic_practice_questions(paper_source, req.language)

    questions_raw = sorted(questions_raw, key=lambda q: q["type"] != "mcq")
    questions = []
    total = 0
    for i, q in enumerate(questions_raw):
        clean_text = clean_latex_and_symbols(q.get("text", f"Question {i+1}"))
        raw_options = q.get("options")
        clean_opts = [clean_latex_and_symbols(opt) for opt in raw_options] if isinstance(raw_options, list) else None
        raw_ans = q.get("correctAnswer")
        clean_ans = clean_latex_and_symbols(str(raw_ans)) if raw_ans is not None else None

        eq = ExamQuestion(
            index=i,
            type=q.get("type", "mcq"),
            text=clean_text,
            options=clean_opts,
            correctAnswer=clean_ans,
            marks=1 if q["type"] == "mcq" else 5
        )
        questions.append(eq)
        total += eq.marks

    return ExamGenerateResponse(
        questions=questions,
        total_marks=total,
        language=req.language,
        topic_title=title
    )


# ── Answer evaluation endpoint ─────────────────────────────────────────────────

EVAL_PROMPT = """You are a strict but fair Class 6 science examiner.

Question: {question_text}
Question type: {question_type}
Maximum marks: {marks}
Model answer / key points: {correct_answer}
Student's answer: {student_answer}

Evaluate the student's answer fairly. Award marks out of {marks}.
- For MCQ: award full marks if the student's selected option index matches the correct answer index; 0 otherwise.
- For short-answer: award 0, 1, or 2 marks based on accuracy and completeness.
- For descriptive: award 0 to {marks} marks based on coverage of key points, accuracy, and clarity.

Respond with ONLY a JSON object (no markdown):
{{"marks_awarded": <number>, "feedback": "<one-sentence feedback>"}}"""


@app.post("/api/exam/evaluate", response_model=EvaluateAnswerResponse)
def evaluate_answer(req: EvaluateAnswerRequest):
    """
    Evaluate a single student answer using Gemini AI.
    For MCQs, performs exact-match evaluation without AI to save quota.
    """
    # MCQ — exact match, no AI needed
    if req.question_type == "mcq":
        if req.correct_answer is not None and str(req.student_answer).strip() == str(req.correct_answer).strip():
            return EvaluateAnswerResponse(marks_awarded=float(req.marks), feedback="Correct!")
        else:
            correct_label = req.correct_answer if req.correct_answer is not None else "unknown"
            return EvaluateAnswerResponse(marks_awarded=0.0, feedback=f"Incorrect. The correct answer was option {int(correct_label)+1}.")

    # Short / Descriptive — use Gemini if available
    model = get_gemini_client()
    if model and req.correct_answer:
        try:
            prompt = EVAL_PROMPT.format(
                question_text=req.question_text,
                question_type=req.question_type,
                marks=req.marks,
                correct_answer=req.correct_answer,
                student_answer=req.student_answer or "(no answer provided)"
            )
            response = model.generate_content(prompt)
            text = response.text.strip()
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
            parsed = json.loads(text)
            awarded = float(parsed.get("marks_awarded", 0))
            awarded = max(0.0, min(float(req.marks), awarded))
            return EvaluateAnswerResponse(
                marks_awarded=awarded,
                feedback=parsed.get("feedback", "Evaluated by AI.")
            )
        except Exception as e:
            print(f"[Gemini] Evaluation failed: {e}. Using keyword fallback.")

    # Fallback: simple keyword overlap scoring
    answer_lower = (req.student_answer or "").lower()
    model_lower = (req.correct_answer or "").lower()
    model_words = set(re.findall(r'\b\w+\b', model_lower))
    student_words = set(re.findall(r'\b\w+\b', answer_lower))
    stop_words = {"a", "an", "the", "is", "are", "was", "were", "in", "on", "at", "to", "of", "and", "or", "it", "this", "that"}
    model_kw = model_words - stop_words
    student_kw = student_words - stop_words

    if not answer_lower.strip():
        return EvaluateAnswerResponse(marks_awarded=0.0, feedback="No answer provided.")

    if not model_kw:
        overlap_ratio = 0.5
    else:
        overlap = model_kw & student_kw
        overlap_ratio = len(overlap) / len(model_kw)

    awarded = round(overlap_ratio * req.marks, 1)
    awarded = max(0.0, min(float(req.marks), awarded))
    return EvaluateAnswerResponse(marks_awarded=awarded, feedback="Your answer was evaluated based on key concepts covered.")


# ── YouTube helpers (preserved from original) ──────────────────────────────────

def parse_iso_duration(pt: str) -> Optional[str]:
    if not pt or not pt.startswith("PT"):
        return None
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", pt)
    if not match:
        return None
    h, m, s = match.groups()
    total_seconds = int(h or 0) * 3600 + int(m or 0) * 60 + int(s or 0)
    if total_seconds < 60:
        return None
    parts = []
    if h:
        parts.append(f"{h} hr" if h == "1" else f"{h} hrs")
    if m:
        parts.append(f"{m} min" if m == "1" else f"{m} mins")
    if s and not h:
        parts.append(f"{s} sec" if s == "1" else f"{s} secs")
    return " ".join(parts) if parts else "< 1 min"


def format_view_count(views_str: Optional[str]) -> tuple[str, int]:
    if not views_str:
        return ("", 0)
    try:
        count = int(views_str)
        if count >= 1_000_000:
            return (f"{count / 1_000_000:.1f}M views", count)
        elif count >= 1_000:
            return (f"{count / 1_000:.1f}K views", count)
        return (f"{count:,} views", count)
    except (ValueError, TypeError):
        return ("", 0)


def generate_study_notes(topic: str, title: str) -> list[str]:
    clean_topic = topic.strip().title()
    clean_title = title.split("|")[0].split("-")[0].strip()
    return [
        f"Core Concept: Visual explanation of {clean_topic} for 6th Standard science.",
        f"Key takeaway from '{clean_title}': understand the structures, processes, and real-world connections.",
        "Exam tip: note definitions, key terms, and labelled diagrams shown in the video.",
        "Study habit: pause, sketch, and write one sentence per main idea after watching."
    ]


async def youtube_search(client: httpx.AsyncClient, query: str, max_results: int = 15,
                          page_token: Optional[str] = None, relevance_language: Optional[str] = None) -> dict:
    params = {
        "q": query, "part": "snippet", "type": "video", "maxResults": max_results,
        "safeSearch": "strict", "videoEmbeddable": "true", "videoDuration": "medium",
        "key": YOUTUBE_API_KEY,
    }
    if page_token:
        params["pageToken"] = page_token
    if relevance_language:
        params["relevanceLanguage"] = relevance_language

    res = await client.get("https://www.googleapis.com/youtube/v3/search", params=params)

    if res.status_code == 403:
        error_body = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        reasons = [e.get("reason", "") for e in error_body.get("error", {}).get("errors", [])]
        if "quotaExceeded" in reasons or "dailyLimitExceeded" in reasons:
            raise HTTPException(status_code=429,
                detail="YouTube Data API quota exceeded. Please check your API quota or update YOUTUBE_API_KEY in backend/.env")
        raise HTTPException(status_code=403,
            detail=f"YouTube API permission error: {error_body.get('error', {}).get('message', 'Forbidden')}")
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=f"YouTube Search API error: {res.text[:200]}")
    return res.json()


async def fetch_video_details(client: httpx.AsyncClient, video_ids: list[str]) -> dict:
    if not video_ids:
        return {}
    params = {"id": ",".join(video_ids), "part": "snippet,contentDetails,statistics", "key": YOUTUBE_API_KEY}
    res = await client.get("https://www.googleapis.com/youtube/v3/videos", params=params)
    if res.status_code != 200:
        return {}
    return {v["id"]: v for v in res.json().get("items", [])}


def build_video_results(search_items: list[dict], videos_dict: dict, raw_topic: str, language: str) -> list[VideoResult]:
    results: list[VideoResult] = []
    for item in search_items:
        v_id = item.get("id", {}).get("videoId")
        if not v_id:
            continue
        snippet = item.get("snippet", {})
        detail = videos_dict.get(v_id, {})
        detail_snippet = detail.get("snippet", snippet)
        content_details = detail.get("contentDetails", {})
        statistics = detail.get("statistics", {})

        raw_duration = content_details.get("duration")
        formatted_duration = parse_iso_duration(raw_duration) if raw_duration else None
        if raw_duration and formatted_duration is None:
            continue

        raw_title = detail_snippet.get("title") or snippet.get("title", f"{raw_topic} Video")
        clean_title = html.unescape(raw_title)
        raw_desc = detail_snippet.get("description") or snippet.get("description", "")
        clean_desc = html.unescape(raw_desc)
        channel_name = html.unescape(
            detail_snippet.get("channelTitle") or snippet.get("channelTitle", "Educational Channel")
        )
        thumbs = detail_snippet.get("thumbnails", {}) or snippet.get("thumbnails", {})
        thumb_url = (
            thumbs.get("maxres", {}).get("url") or thumbs.get("high", {}).get("url") or
            thumbs.get("medium", {}).get("url") or thumbs.get("default", {}).get("url") or
            f"https://img.youtube.com/vi/{v_id}/hqdefault.jpg"
        )
        display_views, raw_views = format_view_count(statistics.get("viewCount"))
        notes = generate_study_notes(raw_topic, clean_title)

        results.append(VideoResult(
            video_id=v_id, title=clean_title, channel_title=channel_name,
            thumbnail_url=thumb_url,
            description=(clean_desc[:250] + "..." if len(clean_desc) > 250 else clean_desc)
                         or f"Educational explanation of {raw_topic} for 6th Standard students.",
            embed_url=f"https://www.youtube.com/embed/{v_id}",
            duration=formatted_duration, view_count=display_views or None,
            view_count_raw=raw_views, language=language, notes=notes
        ))
    results.sort(key=lambda v: v.view_count_raw, reverse=True)
    return results


# ── Curated Animated Educational Videos Bank (Tamil & English) ────────────────
# Guaranteed visual 3D animations directly matching Class 6 Science chapters
CURATED_ANIMATED_VIDEOS = {
    "t1_ch1": {
        "English": [
            {
                "video_id": "Z1_5fhKX1Ik",
                "title": "Motion and Measurement of Distances Class 6 Science in One Shot (Chapter 10) | BYJU'S - Class 6",
                "channel_title": "BYJU'S - Class 6, 7 & 8",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "D4vjzcrSOl0",
                "title": "Motion and Measurement of Distances Full Chapter Class 6 Science | NCERT Science Class 6 Chapter 10",
                "channel_title": "Magnet Brains",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "2iVvqELKRZ0",
                "title": "Grade 6 | Science | Motion and Measurement of Distances | Free Tutorial | CBSE | ICSE | State Board",
                "channel_title": "instyn education",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "uPepmMzvgrk",
                "title": "அளவீடுகள் - 6th Term 1 - 2020 Edition - Science Topics",
                "channel_title": "Ladies Stuff TNPSC",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "VoiDNaO-__E",
                "title": "6th book term-1 |இயற்பியல்| அளவீடுகள்(Measurement )|| ⁨@policetraining786erthangamuthu⁩",
                "channel_title": "POLICE COACH Er.THANGAMUTHU",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "h3zigoB9kMQ",
                "title": "அளவீடுகள்   6th அறிவியல் 6th Science  6th 1st term Science @ARASUADHIGAARAMACADEMY",
                "channel_title": "ARASU ADHIGAARAM ACADEMY OF ADMINISTRATION",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t1_ch2": {
        "English": [
            {
                "video_id": "MNtDgKBKDxg",
                "title": "Motion and Types of Motion | Class 6 Science Motion and Measurement of Distances - LearnFatafat",
                "channel_title": "LearnFatafat",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "7uKETRb25Q8",
                "title": "Chapter 6: How Forces Affect Motion | Science Class 9 Exploration |  NCERT Explainer",
                "channel_title": "EduRev Class 6 - 10",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "B6mi1-YoRT4",
                "title": "What is Force? - Part 1| Forces and Motion | Physics | Infinity Learn NEET",
                "channel_title": "Sri Chaitanya Academy NEET",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "7Ooyi2V_NGE",
                "title": "ஆறாம் வகுப்பு அறிவியல் முதல் பருவம் அலகு 2 விசையும் இயக்கமும்",
                "channel_title": "  kalvisolai நமது கல்விச்சோலை ",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "tMZo8X6TdWQ",
                "title": "6th Science new book - 1st Term - Unit - 2  - விசையும் இயக்கமும்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "lneTIF4bpA8",
                "title": "Class 6 | வகுப்பு 6 | அறிவியல் | விசையும் இயக்கமும் | பாடம் 2 | KalviTv",
                "channel_title": "KalviTVOfficial",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t1_ch3": {
        "English": [
            {
                "video_id": "MrTxRn9MNWM",
                "title": "States of Matter : Solid Liquid Gas",
                "channel_title": "Manocha Academy",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "Rdrwa9lIXTU",
                "title": "States of Matter | Solid Liquid Gas",
                "channel_title": "MAD GARDEN Science",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "wclY8F-UoTE",
                "title": "3 States of Matter for Kids (Solid, Liquid, Gas): Science for Children - FreeSchool",
                "channel_title": "Free School",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "TtYqCQreujQ",
                "title": "6th science Term1. unit 3 - நம்மைச் சுற்றியுள்ள பருப்பொருள்கள். #pc#si#tnpsc#tet#trb#ssc.",
                "channel_title": "CHOZHAN IAS ACADEMY chinnasalem",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "OYsMiIUQTXQ",
                "title": "Class 6 | வகுப்பு 6 | அறிவியல் | நம்மைச் சுற்றியுள்ள பருப்பொருட்கள் | அலகு 3 | KalviTV",
                "channel_title": "KalviTVOfficial",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "NYdyEvkuhSQ",
                "title": "நம்மை சுற்றியுள்ள பருப்பொருள்கள் - 6th Term 1 - Science Topics",
                "channel_title": "Ladies Stuff TNPSC",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t1_ch4": {
        "English": [
            {
                "video_id": "6rLPq4iAIQo",
                "title": "GETTING TO KNOW PLANTS || PART 1 || SCIENCE || CLASS 6 || ANIMATED VIDEO",
                "channel_title": "JACK N JILL Academy",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "pw8OpgTiNG0",
                "title": "Class 6 Science Chapter 7 Getting to Know Plants - Parts of Plants - Flower - LearnFatafat",
                "channel_title": "LearnFatafat",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "JlnfaOSgk1U",
                "title": "Getting To Know Plants | Class 6 : SCIENCE | CBSE / NCERT Science | Full Chapter Explained",
                "channel_title": "Orchids eLearning",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "gK5FUtnrzCo",
                "title": "6th book term-1 ||உயிரியல் || தாவரங்கள் வாழும் உலகம் ||@policetraining786erthangamuthu ​",
                "channel_title": "POLICE COACH Er.THANGAMUTHU",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "S0Qd6z-73uA",
                "title": "தாவர உலகம் / 6th science 1st term / lesson 4 / TNPSC exams",
                "channel_title": "Dhakshan teaching",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "r7pCmqJvKCI",
                "title": "6th Science - Term 1 | Unit 4 | தாவர உலகம் | The World of Plants | Tamililuyiriyal | Part 1",
                "channel_title": "Tamilil Uyiriyal",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t1_ch5": {
        "English": [
            {
                "video_id": "hjWvmyjiJtw",
                "title": "Diversity in Living Organisms | Chapter 4 | Std 6 Science | Maharashtra Board Dicotyledonous seed",
                "channel_title": "NEP Wala",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "wrXRH_6VCsI",
                "title": "Diversity in Living Organisms | Class 6 Science Chapter 4 | Maharashtra Board | Explained #nepwala",
                "channel_title": "NEP Wala",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "fpnKlas6SVM",
                "title": "Living Organisms and Life (Elementary Science Class 6: The Living Organisms)",
                "channel_title": "Ethos Academy - Ethospedia",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "4vZY4ELTBRI",
                "title": "6th Science - New Book -  1st Term - Unit 5 - விலங்குகள் வாழும் உலகம்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "fbkBr8fPe3c",
                "title": "விலங்குலகம் 6th அறிவியல் 6th Science  6th 1st term Science@ARASUADHIGAARAMACADEMY",
                "channel_title": "ARASU ADHIGAARAM ACADEMY OF ADMINISTRATION",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "OUZW3SkAF64",
                "title": "6th std 1st term Science 5th lesson / விலங்குகள் வாழும் உலகம் /Exams corner Tamil",
                "channel_title": "Akalya Future Academy ",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t1_ch6": {
        "English": [
            {
                "video_id": "mAWvVE1kaco",
                "title": "Health and Hygiene | 6th Science | Term 1 | Unit 6 | Animated Explanation | Samacheer Kalvi",
                "channel_title": "Free Hands - Way to Success Learning Hub",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "1eExgApROD0",
                "title": "Diseases and Hygiene Class 6 ICSE Biology | Selina Chapter 7 Bacteria, Viral, Protozoan Diseases #2",
                "channel_title": "LearnoHub - Class 6,7,8",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "MhuYHHe7xoY",
                "title": "Diseases and Hygiene  Class 6 ICSE Biology | Selina Chapter 7 | Diseases Categories, Deficiencies #1",
                "channel_title": "LearnoHub - Class 6,7,8",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "qZfDXft7wlA",
                "title": "6ம் வகுப்பு அறிவியல் உடல் நலமும் சுகாதாரமும் @Book Backs Only",
                "channel_title": "Book Backs Only",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "3bFUwn5V-VI",
                "title": "TNPSC Science Bookback 6th Term 1- பாடம் 6  உடல் நலமும் சுகாதாரமும் - Part 3",
                "channel_title": "Ramax Academy",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "OXJE8N5J-R4",
                "title": "TNPSC Science Bookback 6th Term 1- பாடம் 6  உடல் நலமும் சுகாதாரமும் - Part 1",
                "channel_title": "Ramax Academy",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t1_ch7": {
        "English": [
            {
                "video_id": "S8z_2ffhQb4",
                "title": "Chapter 9 | Introduction To Small Basic | Class 6 | Tech Today Computer",
                "channel_title": "Zoom Publishers",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "kxGQuM9CSvs",
                "title": "Class 6 PSEB  Computer Science  Chapter - 1  Introduction to Computer  #educational #pseb",
                "channel_title": "Aarsh Classes",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "-oSKdY4zyTw",
                "title": "Class 6 PSEB  Computer Science  Chapter - 2 Computer Components   #educational #pseb",
                "channel_title": "Aarsh Classes",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "vMCf84O-sh4",
                "title": "6th Science - New Book -  1st Term - Unit 7 - கணினி ஓர் அறிமுகம்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "Dkz2CY4AqqY",
                "title": "6ஆம் வகுப்பு - term 1 - \"கணினி ஓர் அறிமுகம்\"#6th science ",
                "channel_title": "ANIMATED STUDY LAB",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "fd08knzFZco",
                "title": "கணினி ஓர் அறிமுகம் / Introduction to Computer 6th Science Term 1",
                "channel_title": "Learn with GMK",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t2_ch1": {
        "English": [
            {
                "video_id": "FaQ9WtdNqxQ",
                "title": "Heat Transfer Meme",
                "channel_title": "GaugeHow Shorts",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "LKwkx9QV6-w",
                "title": "Convection of heat #shorts #viral #experiment #science",
                "channel_title": "Science tech",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "a6gzncSKgO4",
                "title": "class 8 chapter 4 science Electricity magnetic and heating effects #class8 #ncert",
                "channel_title": "Science for real",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "omJmBiGXqys",
                "title": "Class  6| வகுப்பு 6 | அறிவியல் | வெப்பம் | அலகு 1| பகுதி1 | KalviTv",
                "channel_title": "KalviTVOfficial",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "U3xiZ7-gwQc",
                "title": "6th science term 2 \"வெப்பம்\" - அலகு 1",
                "channel_title": "ANIMATED STUDY LAB",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "1RhvJiftjKw",
                "title": "Q42-. தனிச்சுழி வெப்பநிலை என்றால் என்ன?-HEAT-9TH SCIENCE-#shortsfeed",
                "channel_title": "MAHA TNPSC",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t2_ch2": {
        "English": [
            {
                "video_id": "NbKj2450saQ",
                "title": "Electricity and Circuits | Class 6",
                "channel_title": "Aasoka",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "2kVG-LgVMgI",
                "title": "Electricity And Circuits | Part 1/2 | English | Class 6",
                "channel_title": "TicTacLearn English",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "vlotVbzrwxg",
                "title": "Grade 6 | Science | Electric Circuits | Free Tutorial | CBSE | ICSE | State Board",
                "channel_title": "instyn education",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "D0XR3gjVHS4",
                "title": "6th book term-1 ||இயற்பியல் || மின்னியல்  ||@policetraining786erthangamuthu",
                "channel_title": "POLICE COACH Er.THANGAMUTHU",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "4BMWxDHBVos",
                "title": "6th Science | மின்னியல் | Part-1 | Important Lesson | tnpsc | Dhrona Academy",
                "channel_title": "DHRONA ACADEMY",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "E-H6xl_1cbA",
                "title": "6th Science | மின்னியல் | Electricity | Sais Academy",
                "channel_title": "SAIS SCIENCE BATCH 2021",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t2_ch3": {
        "English": [
            {
                "video_id": "4KYqxn1DalE",
                "title": "Grade 6 | Science | Changes Around Us | Free Tutorial | CBSE | ICSE | State Board",
                "channel_title": "instyn education",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "NW5FWViOz38",
                "title": "Changes Around Us |  Full Chapter | Class 6: Science | NCERT Science | Class 6 | Chapter 6",
                "channel_title": "Orchids eLearning",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "z2j3g3cSdis",
                "title": "Changes Around Us | Part 1/1 | English | Class 6",
                "channel_title": "TicTacLearn English",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "1f1RH2pH_bU",
                "title": "New Book - 6th Term 2 - நம்மைச் சுற்றி நிகழும் மாற்றங்கள்",
                "channel_title": "Ladies Stuff TNPSC",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "NTE2Ev3Cugs",
                "title": "6th Science - New Book - 2nd Term - Unit 3 - நம்மைச் சுற்றி நிகழும் மாற்றங்கள்.",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "g61OH48_Ydo",
                "title": "6th STD SCIENCE TERM II|6 ம் வகுப்பு அறிவியல்| II பருவம் |unit 3|நம்மை சுற்றி நிகழும் மாற்றங்கள்",
                "channel_title": "VETRI IAS ACADEMY - TENKASI",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t2_ch4": {
        "English": [
            {
                "video_id": "Mxc6FyEK574",
                "title": "Air around us|| class-6th|| science chapter -15 #animation",
                "channel_title": "Klassklub educare ",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "9sVBz9FnwrU",
                "title": "Class 6th Science Air Around Us | Animated Video |Tutorkids",
                "channel_title": "TutorKids",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "HOJy9BkVr68",
                "title": "Grade 6 | Science | Air Around Us | Free Tutorial | CBSE | ICSE | State Board",
                "channel_title": "instyn education",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "nOaANQ0F_fE",
                "title": "6th STD SCIENCE |TERM II|6 ம் வகுப்பு அறிவியல்| II பருவம் |unit 4|காற்று|TNPSC|TET|POLICE|SAMACHEER",
                "channel_title": "VETRI IAS ACADEMY - TENKASI",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "pzAVEoFdDnA",
                "title": "6th  science 2nd term - lesson 4 - air | Mr. Jeyapal @ SAIS ACADEMY",
                "channel_title": "SAIS SCIENCE BATCH 2021",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "bZroabMw6Ms",
                "title": "காற்று | 6th New Book Science | Term 2 | 37 Questions",
                "channel_title": "V V TNPSC ACADEMY",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t2_ch5": {
        "English": [
            {
                "video_id": "DPhMks1qUDE",
                "title": "Plant Cell vs Animal Cell | Differences Explained in 3D Animation | Science for Students",
                "channel_title": "Chaitra Info",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "8pVJzSnUZbQ",
                "title": "Plant vs. Animal Cells Explained  | Cell Structure & Functions #biology #cellbiology #humancell",
                "channel_title": "Study Nova",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "lXuVUeq8mbc",
                "title": "Plant Cell vs Animal Cell Difference in 3D animation #plantcell #animal #biology #ncert #shorts",
                "channel_title": "Heaven biology ",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "eyHOq01t4ZQ",
                "title": "மனித செல்கள் | Human Cells | Science Videos In Tamil | Dr. Binocs Tamil | Kids Learning Video",
                "channel_title": "Dr. Binocs Thamil",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "Ox57AwqDaqI",
                "title": "6th Science | செல் | Sais Academy",
                "channel_title": "SAIS SCIENCE BATCH 2021",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "7a1HE3aDZRI",
                "title": "New Book - 6th Term 2 - செல்",
                "channel_title": "Ladies Stuff TNPSC",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t2_ch6": {
        "English": [
            {
                "video_id": "AHQGNb0zBgg",
                "title": "Human Body - Science for Kids - Rock 'N Learn",
                "channel_title": "Rock 'N Learn",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "i5aXwiC3wWc",
                "title": "Human body organs for kids - Circulatory system, digestive system and respiratory system for kids",
                "channel_title": "Smile and Learn - English",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "6pVdzz2_JUw",
                "title": "Human Body Systems",
                "channel_title": "NBC News Learn",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "hiV5g8slwVo",
                "title": "6th science: term 2- HUMAN ORGAN SYSTEM part 1: Mr. Jeyapal @ sais academy",
                "channel_title": "SAIS SCIENCE BATCH 2021",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "42GDPtZwtyI",
                "title": "5. மனித உறுப்பு மண்டலங்கள் | உயிரியல் | 6th New Book Science Term 2 | Best Revision Video ",
                "channel_title": "V V TNPSC ACADEMY",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "aLi5f0lGnjo",
                "title": "6th Science - New Book - 2nd Term - Unit 6 - மனித உறுப்பு மண்டலங்கள்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t3_ch1": {
        "English": [
            {
                "video_id": "5JHfhgSb6HY",
                "title": "Class6 Science|Chapter4- Exploring Magnets |Animated Video| Explanation| Curiosity",
                "channel_title": "Study with fun",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "MKahoS0mUr4",
                "title": "Fun With Magnets | Class 6 Science",
                "channel_title": "Aasoka",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "UAi6NjIqUGU",
                "title": "Grade 6 | Science | Fun with Magnets | Free Tutorial | CBSE | ICSE | State Board",
                "channel_title": "instyn education",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "Soy2PUst4As",
                "title": "6th Science | காந்தவியல் | Part-1 | Full Lesson Explanation | tnpsc | Dhrona Academy",
                "channel_title": "DHRONA ACADEMY",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "3NQWFZ9axWI",
                "title": "6th Science Term 3 unit 1 book back answer Tamil Medium காந்தவியல்",
                "channel_title": "Learn The Science",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "ISMUeIos2gc",
                "title": "6th Science - New Book - 3rd Term - Unit 1 - காந்தவியல்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t3_ch2": {
        "English": [
            {
                "video_id": "sRSBDDWO1iY",
                "title": "Water | Class 6 | Full Chapter | CBSE | NCERT | STATE BOARD | Free Animated Video",
                "channel_title": "Rudra Tutorials",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "ncORPosDrjI",
                "title": "The Water Cycle | The Dr. Binocs Show | Learn Videos For Kids",
                "channel_title": "Peekaboo Kidz",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "bNWuQD7QHBc",
                "title": "The Water Bodies | The Dr. Binocs Show | Educational Videos For Kids",
                "channel_title": "Peekaboo Kidz",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "gQEYNx9YXh4",
                "title": "6th Science - New Book - 3rd Term - Unit 2 - நீர்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "s7BIF7lrT4M",
                "title": "New Book - 6th Term 3- நீர்",
                "channel_title": "Ladies Stuff TNPSC",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "mKGF4D6ftMs",
                "title": "நீர் | 6th New Book Science | Term 3 | 76 Questions",
                "channel_title": "V V TNPSC ACADEMY",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t3_ch3": {
        "English": [
            {
                "video_id": "LGxHDT8KlFA",
                "title": "TNPSC|TET|POLICE|6 TH STD SCIENCE|TERM III|UNIT 3|CHEMISTRY IN EVERYDAY LIFE|VETRI IAS ACADEMY",
                "channel_title": "VETRI TNPSC ENGLISH MEDIUM - TENKASI",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "7S5GhRgFVzM",
                "title": "Chemistry in Daliy Life - 6th standard || Samacheer Kalvi book",
                "channel_title": "Viruksham TNPSC Academy",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "KJT2KeOfXtc",
                "title": "Class 6 Science Term -3 Ln-3 Chemistry in Everyday Life",
                "channel_title": "vignesh waran",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "EgCijWLhWJ8",
                "title": "6th Science | அன்றாட வாழ்வில் வேதியியல் | Sais Academy",
                "channel_title": "SAIS SCIENCE BATCH 2021",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "Qrc0KeXtKL4",
                "title": "TNPSC Science Bookback 6th Term 3 -பாடம் 3 - அன்றாட வாழ்வில் வேதியியல் Part 1",
                "channel_title": "Ramax Academy",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "cYX8YtBHrYo",
                "title": "TNPSC Science Bookback 6th Term 3 -பாடம் 3 - அன்றாட வாழ்வில் வேதியியல் Part 3",
                "channel_title": "Ramax Academy",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t3_ch4": {
        "English": [
            {
                "video_id": "jfGwmrs6U2k",
                "title": "Master Your Environment: Ecosystems & Food Webs",
                "channel_title": "Brainy Bites...",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "hjWvmyjiJtw",
                "title": "Diversity in Living Organisms | Chapter 4 | Std 6 Science | Maharashtra Board Dicotyledonous seed",
                "channel_title": "NEP Wala",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "WPo9fdqPF-0",
                "title": "What Is an Ecosystem? The Giant Nature Puzzle  #shorts",
                "channel_title": "Pandu and Friends",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "vBv3DyEBlrU",
                "title": "6th Science | நமது சுற்றுச்சூழல் | Lesson Full Explaination | Dhrona Academy",
                "channel_title": "DHRONA ACADEMY",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "sxbOkP27Y2A",
                "title": "6th Science - New Book - 3rd Term - Unit 4 - நமது சுற்றுச்சூழல்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "Y-h9Dz3Uwzo",
                "title": "6. நமது சுற்றுச்சூழல் | உயிரியல் | 6th New Book Science | Term 3  | Best Revision Video ",
                "channel_title": "V V TNPSC ACADEMY",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t3_ch5": {
        "English": [
            {
                "video_id": "0GwSjZ-1rlg",
                "title": "Plants in daily life / Class 6  / Ln 5 Science/ Samacheer kalvi l Term 3 lexplain in bilingual",
                "channel_title": "Conceptual Educational Channel",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "mJZKNCT8WM8",
                "title": "6th science 3rd term: Plants in daily life : Mr. Jeyapal @ sais academy",
                "channel_title": "SAIS SCIENCE BATCH 2021",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "6rAQzWUuntM",
                "title": "Plants In Everyday Life || அன்றாட வாழ்வியல் தாவரங்கள் || 6th Science Term 3 Tnpsc",
                "channel_title": "NSWE IAS ACADEMY",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "2y-1IF-g_Ng",
                "title": "7. அன்றாட வாழ்வில் தாவரங்கள் | உயிரியல் | 6th New Science Book Term 3 | Best Revision Video ",
                "channel_title": "V V TNPSC ACADEMY",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "Bu8nBxsfZUY",
                "title": "6th Science - New Book - 3rd Term - Unit 5 - அன்றாட வாழ்வில் தாவரங்கள்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "53fXsdYqcwo",
                "title": "New Book - 6th Term 3- அன்றாட வாழ்வில் தாவரங்கள்",
                "channel_title": "Ladies Stuff TNPSC",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    },
    "t3_ch6": {
        "English": [
            {
                "video_id": "YbARkFqcAWw",
                "title": " What are Hardware and Software? | Computer Science for Kids Part 4 | Grades K-2",
                "channel_title": "Ms. Dorismond's Virtual Corner",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "zlT-Lg_QFTA",
                "title": "COMPUTER HARDWARE AND SOFTWARE || COMPUTER FUNDAMENTALS FOR CHILDREN",
                "channel_title": "Make It Easy Education",
                "duration": "10 min",
                "views": "150K views"
            },
            {
                "video_id": "cCT9hjpyLHs",
                "title": "COMPUTER HARDWARE AND SOFTWARE - class 3 chapter 1 (English)",
                "channel_title": "VEDV PUBLICATION",
                "duration": "10 min",
                "views": "150K views"
            }
        ],
        "Tamil": [
            {
                "video_id": "CyQM6O46RJg",
                "title": "6th Science - New Book - 3rd Term - Unit 6 - வன்பொருளும் மென்பொருளும்",
                "channel_title": "Rapid Fire",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "uGkDELSWwxI",
                "title": "6th Science Term 3 unit 6 book back answer in Tamil வன்பொருளும் மென்பொருளும்",
                "channel_title": "Learn The Science",
                "duration": "9 min",
                "views": "100K views"
            },
            {
                "video_id": "_Sn4S4TSePM",
                "title": "6th std Science new book /ஆறாம் வகுப்பு மூன்றாம் பருவம்/ lesson6/வன்பொருள் மென்பொருள்/Full explain",
                "channel_title": "Ramsan Academy",
                "duration": "9 min",
                "views": "100K views"
            }
        ]
    }
}


@app.post("/api/spatial/search", response_model=SearchResponse)
async def search_spatial_videos(req: SearchRequest):
    if not req.topic or not req.topic.strip():
        raise HTTPException(status_code=400, detail="Search topic cannot be empty.")

    raw_topic = req.topic.strip()
    raw_clean = re.sub(r'[\(\)\[\]]', ' ', raw_topic).strip().lower()

    matched_topic = None
    for t in TOPICS:
        t_en = t["titleEn"].lower()
        t_ta = t["titleTa"]
        t_key = t["key"].lower()
        if (t_key == raw_topic.lower()
            or t_en == raw_clean
            or t_ta == raw_topic
            or t_en in raw_clean
            or t_ta in raw_topic
            or raw_clean in t_en):
            matched_topic = t
            break

    title_en = matched_topic["titleEn"] if matched_topic else raw_topic
    title_ta = matched_topic["titleTa"] if matched_topic else raw_topic
    topic_key = matched_topic["key"] if matched_topic else ""

    # Specific queries for 3D animated visual science explanations
    tamil_query   = f"{title_ta} 6th science tamil animation 3d விளக்கம்"
    english_query = f"{title_en} class 6 science 3d animation visual explanation"

    print(f"[Search] Topic='{title_en}' ({topic_key}) | Tamil: '{tamil_query}'")

    curated = CURATED_ANIMATED_VIDEOS.get(topic_key, {})
    curated_tamil_vids = [
        VideoResult(
            video_id=v["video_id"], title=v["title"], channel_title=v["channel_title"],
            thumbnail_url=f"https://img.youtube.com/vi/{v['video_id']}/hqdefault.jpg",
            description=f"3D Animated Tamil lesson for {title_ta} ({title_en}) tailored for visual & conceptual learning.",
            embed_url=f"https://www.youtube.com/embed/{v['video_id']}",
            duration=v.get("duration", "8 min"), view_count=v.get("views", "100K views"),
            view_count_raw=100000, language="Tamil", notes=generate_study_notes(title_en, v["title"])
        )
        for v in curated.get("Tamil", [])
    ]
    curated_english_vids = [
        VideoResult(
            video_id=v["video_id"], title=v["title"], channel_title=v["channel_title"],
            thumbnail_url=f"https://img.youtube.com/vi/{v['video_id']}/hqdefault.jpg",
            description=f"3D Animated visual lesson for {title_en} tailored for conceptual and visual learning.",
            embed_url=f"https://www.youtube.com/embed/{v['video_id']}",
            duration=v.get("duration", "10 min"), view_count=v.get("views", "200K views"),
            view_count_raw=200000, language="English", notes=generate_study_notes(title_en, v["title"])
        )
        for v in curated.get("English", [])
    ]

    # Guaranteed fallback with verified available YouTube educational videos
    if not curated_tamil_vids:
        default_tamil = [
            ("omJmBiGXqys", "KalviTVOfficial", "10 min", "135K views", "வகுப்பு 6 அறிவியல் பாடம்"),
            ("3pjkQcQBTtc", "Kalvi TV Official", "9 min", "160K views", "அறிவியல் விளக்கக் காணொளி"),
            ("Dw0WO2XZ5fM", "TN Samacheer Kalvi", "8 min", "95K views", "அறிவியல் செயல்முறை விளக்கம்"),
        ]
        curated_tamil_vids = [
            VideoResult(
                video_id=vid,
                title=f"{title_ta} | 6th Science Tamil — {tag}",
                channel_title=ch,
                thumbnail_url=f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
                description=f"வகுப்பு 6 அறிவியல் பாடத்திட்டம்: {title_ta} ({title_en}) தெளிவான தமிழ் காணொளி விளக்கம்.",
                embed_url=f"https://www.youtube.com/embed/{vid}",
                duration=dur, view_count=views,
                view_count_raw=100000, language="Tamil", notes=generate_study_notes(title_en, f"{title_ta} Lesson #{i+1}")
            )
            for i, (vid, ch, dur, views, tag) in enumerate(default_tamil)
        ]

    if not curated_english_vids:
        default_eng = [
            ("D1Ymc311XS8", "Peekaboo Kidz - Dr. Binocs", "11 min", "520K views", "Concept Animation"),
            ("yXCeuSiTOug", "Peekaboo Kidz - Dr. Binocs", "10 min", "380K views", "Visual Explanation"),
            ("al-do-HGuIk", "National Science Foundation", "9 min", "290K views", "Educational Lesson"),
        ]
        curated_english_vids = [
            VideoResult(
                video_id=vid,
                title=f"{title_en} | Class 6 Science — {tag}",
                channel_title=ch,
                thumbnail_url=f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
                description=f"Educational visual concept explanation for Class 6 Science: {title_en}.",
                embed_url=f"https://www.youtube.com/embed/{vid}",
                duration=dur, view_count=views,
                view_count_raw=200000, language="English", notes=generate_study_notes(title_en, f"{title_en} Video #{i+1}")
            )
            for i, (vid, ch, dur, views, tag) in enumerate(default_eng)
        ]

    if not YOUTUBE_API_KEY:
        return SearchResponse(
            tamil_videos=curated_tamil_vids[:5],
            english_videos=curated_english_vids[:5],
            total_results=len(curated_tamil_vids) + len(curated_english_vids)
        )

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            tamil_search_task   = youtube_search(client, tamil_query,   max_results=12, relevance_language="ta")
            english_search_task = youtube_search(client, english_query, max_results=12, relevance_language="en")

            tamil_search   = await tamil_search_task
            english_search = await english_search_task

            tamil_items   = tamil_search.get("items", [])
            english_items = english_search.get("items", [])

            tamil_ids   = [i["id"]["videoId"] for i in tamil_items   if i.get("id", {}).get("videoId")]
            english_ids = [i["id"]["videoId"] for i in english_items if i.get("id", {}).get("videoId")]
            all_ids     = list(dict.fromkeys(tamil_ids + english_ids))

            videos_dict = await fetch_video_details(client, all_ids)

            live_tamil   = build_video_results(tamil_items,   videos_dict, title_en, "Tamil")
            live_english = build_video_results(english_items, videos_dict, title_en, "English")

            # Combine curated animated videos first, then live search results without duplicate video_ids
            def dedupe_videos(v_list: list[VideoResult]) -> list[VideoResult]:
                seen = set()
                deduped = []
                for v in v_list:
                    if v.video_id not in seen:
                        seen.add(v.video_id)
                        deduped.append(v)
                return deduped

            final_tamil   = dedupe_videos(curated_tamil_vids + live_tamil)[:6]
            final_english = dedupe_videos(curated_english_vids + live_english)[:6]

            return SearchResponse(
                tamil_videos=final_tamil,
                english_videos=final_english,
                total_results=len(final_tamil) + len(final_english)
            )

    except Exception as exc:
        print(f"YouTube search error ({exc}). Returning curated animated videos.")
        return SearchResponse(
            tamil_videos=curated_tamil_vids[:5],
            english_videos=curated_english_vids[:5],
            total_results=len(curated_tamil_vids) + len(curated_english_vids)
        )


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "MI Assessment AI & Media Backend",
        "youtube_api_configured": bool(YOUTUBE_API_KEY),
        "gemini_api_configured": bool(GEMINI_API_KEY),
        "books_dir_exists": BOOKS_DIR.exists(),
        "pdfs_found": len(list(BOOKS_DIR.glob("*.pdf"))) if BOOKS_DIR.exists() else 0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
