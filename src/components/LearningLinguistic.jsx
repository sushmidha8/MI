import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, ChevronLeft, Loader2 } from 'lucide-react';

const PYTHON_URL = 'http://localhost:8000';
const NODE_URL = 'http://localhost:3001';

export default function LearningLinguistic() {
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('currentSessionId');
  const [language, setLanguage] = useState(() => sessionStorage.getItem('currentLanguage') || 'English');
  const [textbook, setTextbook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!sessionId) { navigate('/topic-select'); return; }
    const controller = new AbortController();
    const load = async () => {
      try {
        const sessionRes = await fetch(`${NODE_URL}/api/sessions/by-id/${sessionId}`, { signal: controller.signal });
        if (!sessionRes.ok) throw new Error('Your learning session could not be loaded. Please choose your topic again.');
        const session = await sessionRes.json();
        const response = await fetch(`${PYTHON_URL}/api/textbook/content`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ topic_key: session.topic_key, subtopic_key: session.subtopic_key || null, language }),
        });
        const data = await response.json();
        if (!response.ok || !data.content_available) throw new Error(data.detail || data.source_note || 'The textbook could not be read.');
        if (!controller.signal.aborted) { setTextbook(data); setError(null); setLoading(false); }
      } catch (err) {
        if (err.name !== 'AbortError') { setError(err.message); setLoading(false); }
      }
    };
    load();
    return () => controller.abort();
  }, [sessionId, language, navigate, retry]);

  const changeLanguage = next => {
    if (next === language) return;
    setLoading(true);
    setError(null);
    setLanguage(next);
  };

  return (
    <div className="page reading-page" style={{ maxWidth: 880, paddingTop: '2rem', paddingBottom: '3rem' }}>
      <button className="btn back-btn" onClick={() => navigate('/exam-results/baseline')}>
        <ChevronLeft size={16} /> Back to Test A Results
      </button>
      <article style={{ width: '100%', background: '#fff', border: '1px solid #dddfd4', borderRadius: 24, padding: 'clamp(20px, 5vw, 44px)', boxShadow: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#787565', fontWeight: 700 }}>
          <BookOpen size={22} /> Linguistic learning
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', color: '#263c34', margin: '1rem 0' }}>
          {textbook?.title || sessionStorage.getItem('currentTopicTitle') || 'Your textbook topic'}
        </h1>
        <div className="segmented-control" role="group" aria-label="Reading language" style={{ margin: '1.5rem 0' }}>
          {['English', 'Tamil'].map(lang => (
            <button key={lang} type="button" aria-pressed={language === lang} onClick={() => changeLanguage(lang)}>
              {lang === 'Tamil' ? 'தமிழ்' : lang}
            </button>
          ))}
        </div>
        {loading && <p role="status" style={{ color: '#697061' }}><Loader2 size={20} /> Preparing your textbook explanation…</p>}
        {!loading && error && (
          <div role="alert" style={{ color: '#8c4740', padding: 20, background: '#f5eeea', borderRadius: 12 }}>
            <p>{error}</p>
            <button className="btn" onClick={() => { setLoading(true); setRetry(n => n + 1); }}>Try again</button>
            <button className="btn back-btn" onClick={() => navigate('/topic-select')}>Choose a topic</button>
          </div>
        )}
        {!loading && !error && textbook && (
          <div lang={language === 'Tamil' ? 'ta' : 'en'}>
            <div style={{ color: '#35443e', fontSize: '1.05rem', lineHeight: 1.9 }}>
              {(textbook.explanation_paragraphs?.length ? textbook.explanation_paragraphs : textbook.brief_points || [textbook.content]).map((paragraph, index) => (
                <p key={index} style={{ marginBottom: '1.25rem' }}>{paragraph}</p>
              ))}
            </div>
            <p style={{ color: '#697061', fontSize: '.85rem', lineHeight: 1.7 }}>{textbook.source_note}</p>
            {textbook.source_url && <a href={textbook.source_url} target="_blank" rel="noreferrer" style={{ color: '#425f50', display: 'inline-block', margin: '.5rem 0 1.5rem' }}>Read the original textbook pages </a>}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #dddfd4', paddingTop: '1.5rem' }}>
              <button className="btn" onClick={() => { sessionStorage.setItem('examPhase', 'final'); navigate('/exam/final'); }}>
                Take Final Test (Test B) <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
