// src/components/ExamResults.jsx
// Shows results after Test A or Test B, with the "Learn Better" CTA for Test A.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const NODE_URL = 'http://localhost:3001';

export default function ExamResults() {
  const navigate = useNavigate();
  const { phase } = useParams();   // 'baseline' | 'final'
  const isBaseline = phase === 'baseline';

  const sessionId = sessionStorage.getItem('currentSessionId');
  const language  = sessionStorage.getItem('currentLanguage') || 'English';

  const result = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(`examResult_${phase}`) || 'null'); }
    catch { return null; }
  }, [phase]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { navigate('/topic-select'); return; }

    // Also fetch session info for dominant intelligence routing
    fetch(`${NODE_URL}/api/sessions/by-id/${sessionId}`)
      .then(r => r.json())
      .then(s => { setSession(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [navigate, phase, sessionId]);

  const handleLearnBetter = () => {
    const intel = session?.dominant_intelligence || sessionStorage.getItem('dominantIntelligence') || 'Spatial';
    if (intel === 'Linguistic') {
      navigate('/learn-linguistic');
    } else if (intel === 'Musical') {
      navigate('/learn-musical');
    } else {
      navigate('/spatial-learning');
    }
  };

  const handleViewComparison = () => {
    navigate('/compare');
  };

  if (loading || !result) {
    return (
      <div className="page" style={{ justifyContent: 'center', paddingTop: '4rem' }}>
        <h2 className="glow-text">Loading Results...</h2>
      </div>
    );
  }

  const percentage = result.totalMarks > 0
    ? Math.round((result.marksObtained / result.totalMarks) * 100)
    : 0;

  const getScoreColor = (pct) => {
    if (pct >= 80) return '#52715b';
    if (pct >= 60) return '#425f50';
    if (pct >= 40) return '#857455';
    return '#9b514b';
  };



  const scoreColor = getScoreColor(percentage);


  return (
    <div className="page" style={{ paddingTop: '2rem', maxWidth: '700px' }}>

      {/* Header */}
      {isBaseline ? (
        <div style={{
          background: '#edf0e5',
          border: '2px solid #c6d1bc',
          borderRadius: '12px', padding: '2.2rem 2rem', width: '100%', textAlign: 'center', marginBottom: '2rem',
          boxShadow: 'none'
        }}>
          <div style={{
            display: 'inline-block', padding: '5px 16px', borderRadius: '10px',
            background: '#425f50', color: 'white',
            fontSize: '0.82rem', fontWeight: 700, marginBottom: '1.2rem', textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
             Test A (Baseline) — Completed
          </div>

          <h2 style={{ fontSize: '1.8rem', color: '#354b3d', margin: 0 }}>Answers submitted</h2>
        </div>
      ) : (
        <div style={{
          background: '#edf0e5',
          border: '2px solid #d3ceb9',
          borderRadius: '12px', padding: '2rem', width: '100%', textAlign: 'center', marginBottom: '2rem'
        }}>
          <div style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: '10px',
            background: '#787565', color: 'white',
            fontSize: '0.82rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase'
          }}>
             Test B — Final Results
          </div>

          <div style={{ fontSize: '4rem', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
            {result.marksObtained}
            <span style={{ fontSize: '1.8rem', color: '#697061' }}>/{result.totalMarks}</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: scoreColor, marginTop: '6px' }}>
            {percentage}%
          </div>
          <div style={{ color: '#697061', fontSize: '0.92rem', marginTop: '8px' }}>
            Topic: <strong>{session?.topic}</strong> · Language: <strong>{language}</strong>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', width: '100%', marginBottom: '2rem' }}>
        {[
          { label: 'Questions', value: result.questionsCount || '—' },
          { label: isBaseline ? 'Submission Status' : 'Marks Obtained', value: isBaseline ? 'Recorded ' : result.marksObtained },
          { label: 'Time Taken', value: result.timeTakenSecs ? `${Math.floor(result.timeTakenSecs/60)}m ${result.timeTakenSecs%60}s` : '—' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'white', border: '1px solid #dddfd4', borderRadius: '16px',
            padding: '1.2rem', textAlign: 'center', boxShadow: 'none'
          }}>
            <div style={{ fontSize: isBaseline && stat.label === 'Submission Status' ? '1.05rem' : '1.4rem', fontWeight: 800, color: '#263c34' }}>{stat.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#697061', fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Phase-specific CTA */}
      {isBaseline ? (
        <div style={{ width: '100%' }}>
          <div style={{
            background: '#eeefe5',
            border: '1px solid rgba(66,95,80,0.3)', borderRadius: '10px',
            padding: '1.8rem', textAlign: 'center', marginBottom: '1.5rem'
          }}>
            <button
              onClick={handleLearnBetter}
              style={{
                background: '#425f50',
                color: 'white', border: 'none', padding: '1.1rem 2rem',
                borderRadius: '14px', fontSize: '1.1rem', fontWeight: 800,
                cursor: 'pointer', boxShadow: 'none',
                width: '100%', transition: 'all 0.2s'
              }}
            >
              Continue learning →
            </button>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          <div style={{
            background: '#f0eee5', border: '1px solid #d3ceb9', borderRadius: '10px',
            padding: '1.8rem', textAlign: 'center', marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: '#56513e', marginBottom: '0.5rem' }}>
              Test B complete
            </h3>
            <p style={{ color: '#625d4b', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              View your performance comparison below.
            </p>
            <button
              onClick={handleViewComparison}
              style={{
                background: '#425f50',
                color: 'white', border: 'none', padding: '1rem 2rem',
                borderRadius: '14px', fontSize: '1.08rem', fontWeight: 800,
                cursor: 'pointer', boxShadow: 'none',
                width: '100%'
              }}
            >
               View Performance Comparison →
            </button>
          </div>
        </div>
      )}

      <button className="btn back-btn" onClick={() => navigate('/results')}>
        ← Back to Intelligence Results
      </button>
      <div style={{ height: '2rem' }} />
    </div>
  );
}
