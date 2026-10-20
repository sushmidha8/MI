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

## Musical learning and Suno connection

Musical learning displays textbook-based topic lyrics and plays finished local
recordings through a native audio player. It contains no external music links,
embeds, provider setup, copying, or file-upload controls.

The intended audio workflow is to separate the reference song's instrumental,
synthesize new topic-specific sung vocals, and mix those vocals with that backing
track. The reference audio file is still needed: the supplied share link can be
played remotely, but its direct audio download returned HTTP 403, and no matching
MP3/WAV was found locally. No replacement-vocal songs have been generated yet.

Finished audio belongs in ignored `backend/static/lesson_songs/`. Register each
recording in `backend/learning_songs.json` with `topic_key`, `subtopic_key`,
`language`, `title`, `filename`, and its exact `lyrics`. A recording is played
only for its exact topic and language, and only when the local file exists.
The registry is currently empty. Never substitute the original full-vocal song
or speech over its existing vocals for a newly generated topic song.

Run music tests with `python -m unittest discover -s backend -p 'test_music_learning.py'`.
They mock provider HTTP calls and do not spend credits.

```sh
npm run build
npm run lint
node --test src/utils/assessmentProtocol.test.js
python -m unittest discover -s backend -p 'test_*.py'
```

The Python tests require the local textbook PDFs. Existing frontend lint findings
are separate from these textbook checks.
