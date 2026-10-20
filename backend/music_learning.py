"""Textbook-grounded lyrics and persistent storage for local lesson songs."""
import json
import re
import sqlite3
import threading
from contextlib import closing
from pathlib import Path



class MusicError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def music_style(title, language):
    text = title.lower()
    if any(word in text for word in ("computer", "software", "electric", "கணினி", "மென்பொரு", "மின்ன")):
        arrangement = "light synth-pop, steady 100 BPM beat, soft keyboard and handclaps"
    elif any(word in text for word in ("plant", "animal", "air", "தாவர", "விலங்", "காற்று")):
        arrangement = "warm acoustic folk-pop, gentle 90 BPM rhythm, guitar and soft percussion"
    else:
        arrangement = "bright acoustic pop, steady 95 BPM rhythm, piano and light percussion"
    return f"{arrangement}, clear {language} lead vocals, memorable repeated chorus, short pauses between facts, child-friendly educational song, vocals louder than accompaniment"


def source_facts(selected):
    facts = []
    # Musical lessons use the selected topic's brief study facts, not every
    # exercise and activity on the source pages. Detailed reading stays separate.
    groups = ([selected["brief_points"]] if selected.get("brief_points")
              else [section["points"] for section in selected["learning_sections"]])
    for points in groups:
        for point in points:
            # Keep lists and their introductory sentence together. Splitting at
            # every period turns numbered lists into meaningless one-word facts.
            point = re.sub(r"\s+", " ", point).strip()
            if point and point not in facts:
                facts.append(point)
    if not facts:
        raise MusicError("The selected textbook section could not be read. Choose another topic.", 422)
    return facts


def software_song(selected, language):
    key = selected.get("key")
    title = selected["title"].lower()
    is_software = selected.get("chapter_key") == "t3_ch6" or any(word in title for word in ("software", "மென்பொரு"))
    if key not in ("6.3", "6.3.1", "6.3.2") or not is_software:
        return None
    if language == "Tamil":
        opening = "மென்பொருள் வகைகள் இரண்டு என அறிவோம்,\nஇயக்கமும் பயன்பாடும் சேர்த்துப் பாடுவோம்."
        system = "இயக்க மென்பொருள் வன்பொருளை இயக்கிட உதவும்,\nஉள்ளீட்டைச் செயலாக்கி வெளியீட்டைக் காட்டிட உதவும்.\nஇயக்க முறைமை இன்றிக் கணினி இயங்காது அறிவோம்,\nலினக்ஸ், விண்டோஸ், மேக், ஆண்ட்ராய்டு என நினைப்போம்."
        application = "பயனருக்காக ஒரு நிரல் அல்லது தொகுப்பு அறிவோம்,\nபயன்பாட்டு மென்பொருள் என்று அதைப் பாடுவோம்.\nவன்தட்டில் நிறுவிப் பயன்படுத்திடுவோம்,\nஒன்று அல்லது பல பணிகளை முடித்திடுவோம்.\nகாணொளி, ஒலி இயக்கிகளை நினைப்போம்,\nசொல் செயலாக்கத்தில் உரையை எழுதுவோம்.\nவரைதல் கருவியில் படத்தை வரைந்திடுவோம்,\nதிருத்தும் மென்பொருளில் உள்ளடக்கம் திருத்திடுவோம்."
        chorus = "பாடத்தின் கருத்தை அறிந்திடுவோம்,\nஇசையுடன் சேர்ந்து நினைத்திடுவோம்."
    else:
        opening = "Software comes in two kinds we know,\nSystem and application help our work flow."
        system = "System software makes the hardware go,\nProcesses input, lets the monitor show.\nWithout an operating system, a computer cannot run,\nLinux, Windows, Mac and Android help get work done."
        application = "A program or group meets the end user's need,\nApplication software helps the work proceed.\nInstall it on the hard disk, ready to stay,\nOne task or several, it helps through the day.\nVideo players put pictures in a show,\nAudio players let the music flow.\nWord processors help us write,\nDrawing tools make pictures bright.\nEditing software helps us create,\nChange our content, make it great."
        chorus = "Learn what each program helps us do,\nSing the facts and keep them true."
    verses = []
    if key == "6.3":
        verses.append(opening)
    if key in ("6.3", "6.3.1"):
        verses.append(system)
    if key in ("6.3", "6.3.2"):
        verses.append(application)
    return "\n\n".join(f"[Verse {i + 1}]\n{verse}\n\n[Chorus]\n{chorus}" for i, verse in enumerate(verses))


def textbook_lyrics(selected, language, model=None):
    """Keep every extracted study fact; rhyming refrains never introduce science claims."""
    facts = source_facts(selected)
    fallback = []
    if language == "Tamil":
        chorus = "[Chorus]\nபாடத்தின் கருத்தை அறிந்திடுவோம்,\nஇசையுடன் சேர்ந்து நினைத்திடுவோம்."
        endings = [("என்று அறிவோம்", "இசையோடு பாடுவோம்"), ("என்று கற்போம்", "ஒன்றாக நினைப்போம்")]
    else:
        chorus = "[Chorus]\nLearn the facts and let them flow,\nSing them back and let them grow."
        endings = [("a fact to know", "Sing it back and let it flow"),
                   ("keep this in sight", "Sing it clearly, get it right"),
                   ("learn it today", "Sing it back along the way")]
    for i, fact in enumerate(facts):
        ending, response = endings[i % len(endings)]
        if i % 3 == 0:
            fallback.append(f"[Verse {i // 3 + 1}]")
        fallback.extend([f"{fact.rstrip('.!?')} — {ending},", f"{response}."])
        if i % 3 == 2 or i == len(facts) - 1:
            fallback.extend(["", chorus, ""])
    lyrics = software_song(selected, language) or "\n".join(fallback).strip()
    origin = "Textbook facts with rhyming refrains"
    if model is not None:
        prompt = (f"Create a rhyming study song in {language} for a Class 6 student about {selected['title']}. "
                  "Use ONLY the textbook facts below. Include EVERY fact, examples, units and definitions; "
                  "do not change scientific meaning to force rhyme. Use natural paired end rhymes, short singable "
                  "lines, numbered [Verse] sections and a repeated [Chorus]. No emojis, preamble, markdown fences, "
                  "artist names or unsupported claims. Return JSON with a lyrics string and covered_fact_indices "
                  "listing each included fact index. Maximum 4800 characters. Textbook facts:\n" +
                  json.dumps(list(enumerate(facts)), ensure_ascii=False))
        try:
            response = model.generate_content(prompt)
            raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", response.text.strip())
            data = json.loads(raw)
            candidate = data.get("lyrics", "").strip()
            if (80 <= len(candidate) <= 4800 and "[Chorus]" in candidate
                    and set(data.get("covered_fact_indices", [])) == set(range(len(facts)))):
                lyrics = candidate
                origin = "AI lyrics based on the selected textbook facts"
        except Exception:
            pass  # Accurate local refrains remain available when AI is unavailable.
    return {"title": selected["title"], "language": language, "lyrics": lyrics,
            "style": music_style(selected["title"], language), "facts": facts, "lyrics_origin": origin,
            "page_start": selected["page_start"], "page_end": selected["page_end"],
            "can_generate": True}


class SongStore:
    def __init__(self, path=None):
        self.path = path or Path(__file__).parent / "music.db"
        self.lock = threading.Lock()

    def connect(self):
        db = sqlite3.connect(self.path)
        db.execute("CREATE TABLE IF NOT EXISTS songs (song_key TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        return db

    def get(self, key):
        with closing(self.connect()) as db:
            row = db.execute("SELECT payload FROM songs WHERE song_key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def save(self, key, data):
        with closing(self.connect()) as db:
            db.execute("INSERT OR REPLACE INTO songs VALUES (?, ?)", (key, json.dumps(data)))
            db.commit()
