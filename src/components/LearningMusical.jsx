import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Music2 } from 'lucide-react';
import './LearningMusical.css';

const NODE_URL = 'http://localhost:3001';
const PYTHON_URL = 'http://localhost:8000';

async function readResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.error || 'The request could not be completed.');
  return data;
}

export default function LearningMusical() {
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('currentSessionId');
  const [language, setLanguage] = useState(() => sessionStorage.getItem('currentLanguage') || 'English');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!sessionId) { navigate('/topic-select'); return; }
    const controller = new AbortController();
    async function load() {
      try {
        const session = await fetch(`${NODE_URL}/api/sessions/by-id/${sessionId}`, { signal: controller.signal }).then(readResponse);
        const topic = { topic_key: session.topic_key, subtopic_key: session.subtopic_key, language };
        const data = await fetch(`${PYTHON_URL}/api/music/lyrics`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(topic), signal: controller.signal,
        }).then(readResponse);
        if (!controller.signal.aborted) { setDraft(data); }
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [sessionId, language, navigate, retry]);

  const changeLanguage = next => {
    if (language === next) return;
    setLoading(true); setError(null); setDraft(null); setLanguage(next);
  };
  const recording = draft?.recording;
  const lyrics = recording?.lyrics || draft?.lyrics;

  return (
    <div className="page musical-learning">
      <button className="btn back-btn" onClick={() => navigate('/exam-results/baseline')}>
        <ChevronLeft size={16} /> Back to Test A Results
      </button>
      <article className="song-lesson">
        <div className="song-eyebrow"><Music2 size={20} /> Musical learning</div>
        <h1>{draft?.title || sessionStorage.getItem('currentTopicTitle') || 'Your textbook topic'}</h1>
        <p className="song-intro">Learn your textbook topic through rhyme, rhythm and melody.</p>
        <div className="song-languages" role="group" aria-label="Song language">
          {['English', 'Tamil'].map(lang => (
            <button key={lang} type="button" aria-pressed={language === lang}
              onClick={() => changeLanguage(lang)}>{lang === 'Tamil' ? 'தமிழ்' : lang}</button>
          ))}
        </div>
        {loading && <p role="status">Preparing lyrics from your textbook…</p>}
        {error && <div className="song-message song-error" role="alert">
          <p>{error}</p>
          {!draft && <button className="btn" onClick={() => { setError(null); setLoading(true); setRetry(n => n + 1); }}>Try again</button>}
        </div>}
        {!loading && draft && <>
          {recording && <section className="song-player" aria-label="Lesson song">
            <audio key={`${language}-${recording.audio_url}`} controls preload="metadata"
              src={recording.audio_url} aria-label={`Play ${recording.title}`} />
          </section>}
          <section className="song-lyrics" aria-labelledby="lyrics-title" lang={language === 'Tamil' ? 'ta' : 'en'}>
            <h2 id="lyrics-title">{recording ? 'Sing along' : 'Topic lyrics'}</h2>
            <div className="song-lyric-text">{lyrics}</div>
          </section>
          <p className="song-source">{draft.source_note} · {language}<br />
            <a href={draft.source_url} target="_blank" rel="noreferrer">Read the original textbook pages</a>
          </p>
          <div className="song-next"><button className="btn" onClick={() => { sessionStorage.setItem('examPhase', 'final'); navigate('/exam/final'); }}>
            Take Final Test (Test B) <ArrowRight size={18} />
          </button></div>
        </>}
      </article>
    </div>
  );
}
