import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronLeft, Headphones, Music2 } from 'lucide-react';
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
  const [song, setSong] = useState(null);
  const [selection, setSelection] = useState(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playing, setPlaying] = useState(false);
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
        if (!controller.signal.aborted) { setDraft(data); setSong(data.song); setSelection(topic); }
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [sessionId, language, navigate, retry]);

  const songId = song?.id;
  const songStatus = song?.status;
  useEffect(() => {
    if (!songId || ['complete', 'failed'].includes(songStatus)) return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const next = await fetch(`${PYTHON_URL}/api/music/songs/${songId}`, { signal: controller.signal }).then(readResponse);
        if (controller.signal.aborted) return;
        setSong(next);
        if (!['complete', 'failed'].includes(next.status)) timer = setTimeout(poll, 2000);
      } catch (err) {
        if (err.name !== 'AbortError') setError('The connection was interrupted. Reload your song to continue.');
      }
    }
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [songId, songStatus]);

  const retrySong = async () => {
    setError(null);
    try {
      const next = await fetch(`${PYTHON_URL}/api/music/generate`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selection) }).then(readResponse);
      setSong(next);
    } catch (err) { setError(err.message); }
  };

  const changeLanguage = next => {
    if (language === next) return;
    setLoading(true); setError(null); setDraft(null); setSong(null); setPlaybackTime(0); setPlaying(false); setLanguage(next);
  };
  const recording = song?.status === 'complete' ? song.recording : null;
  const lyrics = recording?.lyrics || draft?.lyrics;
  let lineIndex = 0;

  return (
    <div className="page musical-learning">
      <button className="btn back-btn" onClick={() => navigate('/exam-results/baseline')}><ChevronLeft size={15} /> Back to Test A Results</button>
      <header className="music-page-heading">
        <div><span className="eyebrow">Learn your way · Musical learning</span>
          <h1>{draft?.title || sessionStorage.getItem('currentTopicTitle') || 'Your textbook topic'}</h1>
          <p>A little rhythm. A deeper understanding.</p>
        </div>
        <span className="pill"><Headphones size={14} /> Listen & learn</span>
      </header>
      <div className="music-layout">
        <aside className="song-listening-panel" aria-label="Topic recording">
          <div className={`song-artwork${playing ? ' is-playing' : ''}`} aria-hidden="true">
            <span className="artwork-label">THE LEARNING SESSIONS</span>
            <div className="record-disc"><div className="record-label"><Music2 size={29} strokeWidth={1} /><span>MI</span></div></div>
            <span className="artwork-caption">A lesson in every melody</span>
          </div>
          <div className="song-listening-body">
            <span className="eyebrow">Your lesson recording</span>
            <div className="segmented-control song-languages" role="group" aria-label="Song language">
              {['English', 'Tamil'].map(lang => <button key={lang} type="button" aria-pressed={language === lang} onClick={() => changeLanguage(lang)}>{lang === 'Tamil' ? 'தமிழ்' : lang}</button>)}
            </div>
            {loading && <p className="song-status" role="status">Preparing your textbook lyrics…</p>}
            {error && <div className="song-message song-error" role="alert"><p>{error}</p><button className="btn secondary-btn" onClick={() => { setError(null); setLoading(true); setRetry(n => n + 1); }}>Reload song</button></div>}
            {!loading && draft && <>
              {song && !['complete', 'failed'].includes(song.status) && <div className="song-progress" role="status" aria-live="polite">
                <p>Composing your lesson song…</p><p>{song.stage}{song.total_lines ? ` · ${song.completed_lines} of ${song.total_lines} lines` : ''}</p>
                {song.total_lines > 0 && <progress max={song.total_lines} value={song.completed_lines} aria-label="Song generation progress" />}
              </div>}
              {song?.status === 'failed' && <div className="song-message song-error" role="alert"><p>{song.error}</p><button className="btn secondary-btn" onClick={retrySong}>Try again</button></div>}
              {recording && <section className="song-player" aria-label="Lesson song">
                <audio key={`${language}-${recording.audio_url}`} controls preload="metadata" src={recording.audio_url} aria-label={`Play ${recording.title}`}
                  onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                  onTimeUpdate={event => setPlaybackTime(event.currentTarget.currentTime)} />
                <p><Headphones size={13} /> Listen, follow the words, and sing along.</p>
              </section>}
            </>}
          </div>
        </aside>
        <article className="song-lesson">
          <div className="song-lyrics-heading"><div><span className="eyebrow">Words worth remembering</span><h2 id="lyrics-title">{recording ? 'Sing along.' : 'Your lesson lyrics.'}</h2></div><span className="lyric-language">{language === 'Tamil' ? 'தமிழ்' : 'ENGLISH'}</span></div>
          {!lyrics && <p className="song-placeholder">Your topic lyrics will appear here, ready to follow as you listen.</p>}
          {lyrics && <section className="song-lyrics" aria-labelledby="lyrics-title" lang={language === 'Tamil' ? 'ta' : 'en'}>
            <div className="song-lyric-text">{lyrics.split('\n').map((line, index) => {
              const section = /^\[[^\]]+\]$/.test(line.trim());
              const timing = line.trim() && !section ? recording?.line_timings?.[lineIndex++] : null;
              const current = timing && playbackTime >= timing.start && playbackTime < timing.end;
              return <span key={index} className={`lyric-line${section ? ' lyric-section' : ''}${current ? ' lyric-active' : ''}`} aria-current={current ? 'true' : undefined}>{line || '\u00a0'}</span>;
            })}</div>
          </section>}
          {draft && <div className="song-source"><BookOpen size={17} strokeWidth={1.4} /><p>{draft.source_note} · {language}<br /><a href={draft.source_url} target="_blank" rel="noreferrer">Read the original textbook pages</a></p></div>}
        </article>
      </div>
      {!loading && draft && <section className="lesson-next"><div><span className="eyebrow">When you feel ready</span><p>Put what you have learned into practice.</p></div><button className="btn primary-btn" onClick={() => { sessionStorage.setItem('examPhase', 'final'); navigate('/exam/final'); }}>Take Final Test (Test B)<ArrowRight size={16} /></button></section>}
    </div>
  );
}
