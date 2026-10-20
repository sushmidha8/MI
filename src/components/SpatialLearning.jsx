// src/components/SpatialLearning.jsx
// Phase 3: Spatial Learning Dashboard — Displays ONLY curated 3D animated video lessons.
// Tailored specifically for Spatial / Visual learners.
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ChevronLeft, Loader2, RefreshCw } from 'lucide-react';
import { VideoCard, VideoFilters, VideoModal } from './VideoLessons';

const NODE_URL   = 'http://localhost:3001';
const PYTHON_URL = 'http://localhost:8000';

export default function SpatialLearning({ user }) {
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('currentSessionId');
  const language  = sessionStorage.getItem('currentLanguage') || 'English';

  const [topic, setTopic]               = useState(sessionStorage.getItem('currentTopicTitle') || 'Heat');
  const [tamilVideos, setTamilVideos]   = useState([]);
  const [englishVideos, setEnglishVideos] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [activeVideo, setActiveVideo]   = useState(null);
  const [activeFilter, setActiveFilter] = useState(language === 'Tamil' ? 'Tamil' : 'ALL');

  const fetchVideos = useCallback(async (topicToSearch) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PYTHON_URL}/api/spatial/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicToSearch, student_id: user?.id ? String(user.id) : 'student' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Video search failed (${res.status})`);
      }
      const data = await res.json();
      setTamilVideos(data.tamil_videos || []);
      setEnglishVideos(data.english_videos || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadSessionThenVideos = useCallback(async () => {
    try {
      let activeTopic = sessionStorage.getItem('currentTopicTitle') || 'Heat';
      let activeLang  = sessionStorage.getItem('currentLanguage') || language;

      if (sessionId) {
        try {
          const sessRes = await fetch(`${NODE_URL}/api/sessions/by-id/${sessionId}`);
          if (sessRes.ok) {
            const sess = await sessRes.json();
            if (sess.topic) activeTopic = sess.topic;
            if (sess.language) activeLang = sess.language;
          }
        } catch (e) {
          console.warn('Session fetch warning:', e);
        }
      }

      setTopic(activeTopic);
      if (activeLang === 'Tamil') {
        setActiveFilter('Tamil');
      }
      await fetchVideos(activeTopic);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, [sessionId, language, fetchVideos]);

  useEffect(() => {
    const storedTopic = sessionStorage.getItem('currentTopicTitle');
    if (!sessionId && !storedTopic) {
      navigate('/topic-select');
      return;
    }
    loadSessionThenVideos();
  }, [sessionId, navigate, loadSessionThenVideos]);

  const handleTakeTest = () => {
    sessionStorage.setItem('examPhase', 'final');
    navigate('/exam/final');
  };

  const allVideos      = [...tamilVideos, ...englishVideos];
  const filteredVideos =
    activeFilter === 'Tamil'   ? tamilVideos :
    activeFilter === 'English' ? englishVideos : allVideos;

  return (
    <div className="page video-page">
      <button className="btn back-btn" onClick={() => navigate('/exam-results/baseline')}><ChevronLeft size={15} /> Back to Test A Results</button>
      <header className="lesson-heading"><span className="eyebrow">Learn your way · Spatial learning</span><h1>{topic}</h1>
        <VideoFilters active={activeFilter} onChange={setActiveFilter} tamilCount={tamilVideos.length} englishCount={englishVideos.length} />
      </header>
      {loading && <div className="empty-state" role="status"><Loader2 size={28} className="animate-spin" /><h3>Finding your video lessons…</h3><p>{topic}</p></div>}
      {error && !loading && <div className="empty-state" role="alert"><AlertCircle size={28} /><h3>Lessons could not be loaded.</h3><p>{error}</p><button className="btn secondary-btn" onClick={() => fetchVideos(topic)}><RefreshCw size={15} /> Try again</button></div>}
      {!loading && !error && (filteredVideos.length ? <div className="video-grid">{filteredVideos.map((video, index) => <VideoCard key={video.video_id || index} video={video} onPlay={setActiveVideo} />)}</div> : <div className="empty-state"><h3>No lessons in this language yet.</h3><p>Try another language to see the available videos.</p></div>)}
      {!loading && <section className="lesson-next"><p>Finished your lessons? Put your understanding into practice.</p><button className="btn" onClick={handleTakeTest}>Take Final Test (Test B)<ArrowRight size={16} /></button></section>}
      {activeVideo && <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />}
    </div>
  );
}
