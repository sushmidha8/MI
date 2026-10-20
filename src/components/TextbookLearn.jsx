// src/components/TextbookLearn.jsx
// Phase 1: Concise Topic Overview & Brief Key Concepts before Baseline Examination (Test A).
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, CheckCircle2, ChevronLeft, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function TextbookLearn() {
  const navigate = useNavigate();
  const sessionId  = sessionStorage.getItem('currentSessionId');
  const topicKey   = sessionStorage.getItem('currentTopicKey');
  const subtopicKey = sessionStorage.getItem('currentSubtopicKey');
  const language   = sessionStorage.getItem('currentLanguage') || 'English';

  const [content, setContent]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [readConfirmed, setReadConfirmed] = useState(false);

  useEffect(() => {
    if (!sessionId || !topicKey) {
      navigate('/topic-select');
      return;
    }

    const fetchContent = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/textbook/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic_key: topicKey, subtopic_key: subtopicKey || null, language }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Status ${res.status}`);
        setContent(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [language, navigate, sessionId, topicKey, subtopicKey]);

  const handleStartTest = () => {
    sessionStorage.setItem('examPhase', 'baseline');
    navigate('/exam/baseline');
  };

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center', paddingTop: '4rem' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={44} color="#2563eb" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
          <h2 className="glow-text">Loading Topic Overview...</h2>
          <p style={{ color: '#64748b' }}>Preparing Class 6 Science brief overview...</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ paddingTop: '2rem' }}>
        <button className="btn back-btn" onClick={() => navigate('/topic-select')}>← Back to Topic Selection</button>
        <div className="card" style={{ textAlign: 'center', color: '#ef4444', marginTop: '2rem', padding: '2rem' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ fontSize: '1.2rem', fontWeight: 700 }}> Could not load topic overview</p>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{error}</p>
        </div>
      </div>
    );
  }

  const topicTitle = content?.title || sessionStorage.getItem('currentTopicTitle') || 'Science Topic';
  const briefPoints = content?.brief_points && content.brief_points.length > 0
    ? content.brief_points
    : [
        `Introduction to the fundamental scientific principles of ${topicTitle}.`,
        'Observation and classification of everyday physical phenomena and natural materials.',
        'Core scientific vocabulary, definitions, and real-world practical applications.',
        'Foundation concepts tested in the Class 6 Tamil Nadu State Board curriculum.'
      ];

  return (
    <div className="page" style={{ paddingTop: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <button className="btn back-btn" onClick={() => navigate('/topic-select')}>
        <ChevronLeft size={16} /> Back to Topic Selection
      </button>

      {/* Header */}
      <div style={{ width: '100%', marginBottom: '1.5rem', marginTop: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{
            background: '#eff6ff', color: '#2563eb', padding: '4px 12px',
            borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700
          }}>
             Topic overview
          </span>
          <span style={{
            background: language === 'English' ? '#f0fdf4' : '#fef3c7',
            color: language === 'English' ? '#059669' : '#d97706',
            padding: '4px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700
          }}>
            {language === 'English' ? ' English' : ' Tamil'}
          </span>
        </div>

        <h2 className="glow-text section-title" style={{ fontSize: '1.9rem', marginBottom: '0.3rem' }}>
          {topicTitle}
        </h2>
        <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
          {content?.source_note || 'Tamil Nadu State Board Class 6 Science'}
        </p>
      </div>

      {/* Compact Brief Card */}
      <div className="card" style={{
        borderTop: '5px solid #2563eb',
        padding: '2rem',
        borderRadius: '22px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.8rem' }}>
          <span style={{ fontSize: '1.5rem' }}></span>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#0f172a', fontWeight: '800' }}>
              Topic Overview in Brief
            </h3>
          </div>
        </div>

        {/* Concise Bullet Points */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.6rem' }}>
          {briefPoints.map((point, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.9rem 1.1rem',
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: '#eff6ff',
                color: '#2563eb', fontWeight: 800, fontSize: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px'
              }}>
                {idx + 1}
              </div>
              <div style={{ color: '#334155', fontSize: '0.94rem', lineHeight: '1.55' }}>
                {point}
              </div>
            </div>
          ))}
        </div>

        {content?.source_url && (
          <p style={{ color: '#64748b', fontSize: '.85rem', marginBottom: '1.5rem' }}>
            <a href={content.source_url} target="_blank" rel="noreferrer">Read the original textbook pages </a>
          </p>
        )}


        {/* Confirmation Checkbox */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', userSelect: 'none',
          padding: '0.8rem', background: '#f8fafc',
          borderRadius: '10px', border: '1px solid #e2e8f0',
          marginBottom: '1.5rem'
        }}>
          <input
            type="checkbox"
            checked={readConfirmed}
            onChange={(e) => setReadConfirmed(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
          />
          <span style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600 }}>
            I have reviewed the brief overview for <strong>{topicTitle}</strong> and am ready for Test A.
          </span>
        </label>

        {/* Start Button */}
        <button
          className="btn"
          onClick={handleStartTest}
          disabled={!readConfirmed}
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.05rem',
            fontWeight: 800,
            background: readConfirmed
              ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
              : '#94a3b8',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            cursor: readConfirmed ? 'pointer' : 'not-allowed',
            boxShadow: readConfirmed ? '0 6px 18px rgba(37,99,235,0.35)' : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          Start Baseline Test (Test A)  <ArrowRight size={18} />
        </button>
      </div>

      <div style={{ height: '2rem' }} />
    </div>
  );
}
