// src/components/SpatialLearning.jsx
// Phase 3: Spatial Learning Dashboard — Displays ONLY curated 3D animated video lessons.
// Tailored specifically for Spatial / Visual learners.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  X,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronLeft,
  Sparkles
} from 'lucide-react';

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

  useEffect(() => {
    const storedTopic = sessionStorage.getItem('currentTopicTitle');
    if (!sessionId && !storedTopic) {
      navigate('/topic-select');
      return;
    }
    loadSessionThenVideos();
  }, []);

  const loadSessionThenVideos = async () => {
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
  };

  const fetchVideos = async (topicToSearch) => {
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
  };

  const handleTakeTest = () => {
    sessionStorage.setItem('examPhase', 'final');
    navigate('/exam/final');
  };

  const allVideos      = [...tamilVideos, ...englishVideos];
  const filteredVideos =
    activeFilter === 'Tamil'   ? tamilVideos :
    activeFilter === 'English' ? englishVideos : allVideos;

  return (
    <div style={{
      minHeight: '100vh', background: '#0b0f19', color: '#f1f5f9',
      fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem 1.5rem 5rem',
      position: 'relative', overflowX: 'hidden',
    }}>
      {/* Ambient background glows */}
      <div style={{
        position: 'fixed', top: '-10%', left: '20%', width: 500, height: 500, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(0,0,0,0) 70%)'
      }} />
      <div style={{
        position: 'fixed', bottom: '10%', right: '15%', width: 500, height: 500, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)'
      }} />

      <div style={{ maxWidth: 1120, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Top Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <button
            onClick={() => navigate('/exam-results/baseline')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, background: '#1e293b',
              color: '#cbd5e1', border: '1px solid #334155', padding: '9px 16px',
              borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem'
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#cbd5e1'; }}
          >
            <ChevronLeft size={17} /> Back to Test A Results
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(56,189,248,0.12)',
            border: '1px solid rgba(56,189,248,0.35)', padding: '6px 16px', borderRadius: '20px',
            fontSize: '0.86rem', color: '#38bdf8', fontWeight: 700
          }}>
            <Sparkles size={16} /> Spatial learning
          </div>
        </div>

        {/* Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.92) 100%)',
          borderRadius: '24px', border: '1px solid rgba(56,189,248,0.3)',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.6)',
          padding: '2.2rem', marginBottom: '2rem',
        }}>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.8rem 0' }}>
            {topic}
          </h1>

          {/* Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.6rem', flexWrap: 'wrap', gap: '1rem' }}>

            {/* Language filter buttons */}
            <div style={{ display: 'flex', gap: 6, background: '#0f172a', padding: '4px', borderRadius: '12px', border: '1px solid #334155' }}>
              <button
                onClick={() => setActiveFilter('ALL')}
                style={{
                  background: activeFilter === 'ALL' ? '#6366f1' : 'transparent',
                  color: activeFilter === 'ALL' ? '#fff' : '#94a3b8',
                  border: 'none', padding: '6px 14px', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                }}
              >
                 All ({allVideos.length})
              </button>
              <button
                onClick={() => setActiveFilter('English')}
                style={{
                  background: activeFilter === 'English' ? '#0ea5e9' : 'transparent',
                  color: activeFilter === 'English' ? '#fff' : '#94a3b8',
                  border: 'none', padding: '6px 14px', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                }}
              >
                 English ({englishVideos.length})
              </button>
              <button
                onClick={() => setActiveFilter('Tamil')}
                style={{
                  background: activeFilter === 'Tamil' ? '#f59e0b' : 'transparent',
                  color: activeFilter === 'Tamil' ? '#fff' : '#94a3b8',
                  border: 'none', padding: '6px 14px', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                }}
              >
                 Tamil ({tamilVideos.length})
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#151c2c', borderRadius: 20, border: '1px solid #28354e' }}>
            <Loader2 size={40} color="#38bdf8" style={{ animation: 'spin 1s linear infinite' }} />
            <h3 style={{ color: '#fff', marginTop: '1.2rem' }}>Loading videos…</h3>
            <p style={{ color: '#94a3b8' }}>{topic}</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: 'rgba(239,68,68,0.1)', borderRadius: 20, border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ color: '#fca5a5' }}>Unable to Load Videos</h3>
            <p style={{ color: '#cbd5e1', marginBottom: '1.5rem' }}>{error}</p>
            <button
              onClick={() => fetchVideos(topic)}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={15} /> Try Again
            </button>
          </div>
        )}

        {/* Pure Video Grid: ONLY VIDEOS */}
        {!loading && !error && filteredVideos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#151c2c', borderRadius: '20px', color: '#94a3b8' }}>
            No videos matching the selected filter.
          </div>
        )}

        {!loading && !error && filteredVideos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem'
          }}>
            {filteredVideos.map((vid, idx) => {
              const isTamil = vid.language === 'Tamil';
              const accentColor = isTamil ? '#f59e0b' : '#38bdf8';

              return (
                <div
                  key={vid.video_id || idx}
                  style={{
                    background: '#131b2e',
                    borderRadius: '20px',
                    border: '1px solid #28354e',
                    overflow: 'hidden',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = accentColor;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = '#28354e';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  {/* Video Thumbnail with Hover Overlay */}
                  <div
                    onClick={() => setActiveVideo(vid)}
                    style={{
                      position: 'relative',
                      height: 195,
                      cursor: 'pointer',
                      background: '#0a0f1d',
                      overflow: 'hidden'
                    }}
                  >
                    <img
                      src={vid.thumbnail_url || `https://img.youtube.com/vi/${vid.video_id}/hqdefault.jpg`}
                      alt={vid.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => {
                        e.currentTarget.src = `https://img.youtube.com/vi/${vid.video_id}/hqdefault.jpg`;
                      }}
                    />

                    {/* Language Badge */}
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      background: isTamil ? 'rgba(245,158,11,0.92)' : 'rgba(14,165,233,0.92)',
                      color: '#ffffff', padding: '4px 10px', borderRadius: '8px',
                      fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.3px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                    }}>
                      {isTamil ? ' Tamil' : ' English'}
                    </div>

                    {/* Duration Badge */}
                    {vid.duration && (
                      <div style={{
                        position: 'absolute', bottom: 10, right: 10,
                        background: 'rgba(0,0,0,0.85)', color: '#ffffff',
                        padding: '3px 8px', borderRadius: '6px',
                        fontSize: '0.72rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        <Clock size={11} /> {vid.duration}
                      </div>
                    )}

                    {/* Glowing Play Overlay */}
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'rgba(14,165,233,0.9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 20px rgba(14,165,233,0.6)',
                      transition: 'transform 0.2s ease'
                    }}>
                      <Play size={24} color="#ffffff" style={{ marginLeft: 3 }} />
                    </div>
                  </div>

                  {/* Video Meta & Actions */}
                  <div style={{
                    padding: '1.2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: accentColor, fontWeight: 700, marginBottom: 5 }}>
                         {vid.channel_title}
                      </div>
                      <h3 style={{
                        fontSize: '1rem', fontWeight: 700, color: '#ffffff',
                        margin: '0 0 8px 0', lineHeight: 1.4
                      }}>
                        {vid.title}
                      </h3>
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginTop: '1.2rem', paddingTop: '0.8rem',
                      borderTop: '1px solid #1e293b'
                    }}>
                      <button
                        onClick={() => setActiveVideo(vid)}
                        style={{
                          flex: 1,
                          background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                          color: '#ffffff', border: 'none', padding: '9px 14px',
                          borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 6,
                          boxShadow: '0 4px 12px rgba(14,165,233,0.3)'
                        }}
                      >
                        <Play size={14} /> Watch Lesson
                      </button>

                      <a
                        href={`https://www.youtube.com/watch?v=${vid.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155',
                          padding: '9px 12px', borderRadius: '10px', fontSize: '0.82rem',
                          fontWeight: 600, textDecoration: 'none',
                          display: 'inline-flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ready to Test CTA */}
        {!loading && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(99,102,241,0.2) 100%)',
            border: '2px solid rgba(56,189,248,0.4)', borderRadius: '24px',
            padding: '2.4rem', textAlign: 'center', marginBottom: '2rem'
          }}>
            <button
              onClick={handleTakeTest}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                color: '#ffffff', border: 'none', padding: '1.15rem 2.8rem',
                borderRadius: '16px', fontSize: '1.12rem', fontWeight: 800,
                cursor: 'pointer', boxShadow: '0 10px 28px rgba(14,165,233,0.45)',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'none'}
            >
              Take Final Test (Test B)
            </button>
          </div>
        )}

      </div>

      {/* Video Modal Player */}
      {activeVideo && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1.5rem',
        }}>
          <div style={{
            background: '#0f172a', borderRadius: '24px', width: '100%', maxWidth: 860,
            border: '1px solid rgba(56,189,248,0.3)', overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.5rem', borderBottom: '1px solid #1e293b'
            }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', flex: 1, marginRight: '1rem' }}>
                {activeVideo.title}
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px',
                  padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo.video_id}?autoplay=1&rel=0`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
            <div style={{ padding: '1rem 1.5rem', color: '#94a3b8', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span> {activeVideo.channel_title} {activeVideo.duration && ` ·  ${activeVideo.duration}`}</span>
              <a
                href={`https://www.youtube.com/watch?v=${activeVideo.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                Open on YouTube <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
