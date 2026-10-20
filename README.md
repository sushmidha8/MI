# Multi-Intelligence Assessment

A web application for assessing multiple intelligences, including spatial, linguistic, and musical intelligence.

## Local development

Run from the directory containing `package.json`:

```sh
npm ci
python -m pip install -r backend/requirements.txt
npm run dev
```

Vite prints the frontend URL. Express uses port 3001 and FastAPI uses port 8000;
stop older instances before starting the application again.

## Textbook learning

Place the six Class 6 Science English/Tamil term PDFs in `books/` using the
filenames in `books/README.md`. Select a language, a chapter, and then a topic
within that chapter. The topic is saved with the learning session and used for
the reading overview, linguistic explanation, and exam generation.

Explanations use short passages from the selected textbook section and link to
the original PDF pages. No API key is needed for textbook reading or the offline
topic practice questions. New Test A papers contain five MCQs (one mark each)
and four descriptive questions (five marks each), for 25 marks. The AI and
offline paths use the same structure. Test B reuses the saved Test A paper.
Older completed sessions retain their original paper; start a new topic session
to use the updated format.

Linguistic reading shows two or three explanatory paragraphs covering the selected
topic and its nested concepts, with a link to the original textbook pages.

Completed intelligence modules are disabled on the dashboard. All assessments
monitor tab/window departures, submit recorded answers on the third departure or
when time expires, block clipboard actions, and warn before leaving the page.
Timers continue while the window is in the background.

## Generated musical lessons

Opening musical learning automatically queues a topic-specific song. The backend
synthesizes the textbook lyrics locally in English or Tamil, gives the voice a
melody and bar-based timing, and mixes it with the supplied accompaniment. The
page plays the resulting MP3 and highlights the current lyric line. There are no
external music links, embeds, provider setup controls, or copy/upload controls.
The voice is electronic synthetic singing; it is not a studio-quality singer.

Audio setup on a new checkout:

```sh
python -m pip install -r backend/requirements-audio.txt
python backend/setup_audio.py --backing "C:/path/to/background.weba"
```

This workspace has its small decoder/vocoder packages installed under ignored
`backend/audio_runtime/`; the renderer also supports normal Python installation.
The imported accompaniment is `backend/audio_assets/backing-track.weba`. English
and Tamil voice weights are in `backend/audio_assets/models/`. These files and
all generated audio are ignored. Keep the source accompaniment available when
copying the project. Restart FastAPI after replacing it.

A single CPU worker renders songs in the background. Lyrics, backing fingerprint,
language, and renderer version identify each cached song. Completed MP3s and
line timings are saved in `backend/static/lesson_songs/` and `backend/music.db`.
Requests for the same song reuse it; interrupted jobs resume when polled; failed
jobs show a retry action. Synthesis needs no music API account or network access
after model setup. Topic lyrics use the textbook section and an optional Gemini
rewrite, with a factual local fallback when Gemini is unavailable.

The voice models are Meta's [MMS English](https://huggingface.co/facebook/mms-tts-eng)
and [MMS Tamil](https://huggingface.co/facebook/mms-tts-tam), licensed **CC-BY-NC 4.0**
for noncommercial use. Credit: Vineel Pratap et al., *Scaling Speech Technology to
1,000+ Languages* (Meta AI, 2023). Pitch and timing synthesis uses the
[WORLD vocoder](https://github.com/JeremyCCHsu/Python-Wrapper-for-World-Vocoder).

Run music checks with `python -m unittest discover -s backend -p 'test_music_learning.py'`.
Queue/cache tests use a fake renderer; real audio is verified separately.

```sh
npm run build
npm run lint
node --test src/utils/assessmentProtocol.test.js
python -m unittest discover -s backend -p 'test_*.py'
```

The Python tests require the local textbook PDFs. Existing frontend lint findings
are separate from these textbook checks.
