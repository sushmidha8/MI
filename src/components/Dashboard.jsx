import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState({
    Spatial: null,
    Linguistic: null,
    Musical: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3001/api/assessments/${user.id}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const comp = { Spatial: null, Linguistic: null, Musical: null };
        if (Array.isArray(data)) {
            data.forEach(assessment => {
                if (comp[assessment.type] !== undefined) comp[assessment.type] = assessment.score;
            });
        }
        setCompleted(comp);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);


  if (loading) return <div className="page"><h2 className="glow-text">Loading...</h2></div>;

  return (
    <div className="page" id="page-dashboard">
      <h2 className="glow-text section-title" style={{ fontSize: '2.5rem', marginTop: '2rem' }}>Welcome, {user.username}!</h2>
      
      {/* First-time Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        borderRadius: '16px',
        padding: '1.2rem 1.5rem',
        marginBottom: '2rem',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '6px' }}>
           Welcome to Multi-Intelligence Assessment!
        </div>
        <div style={{ color: 'var(--text-main)', fontSize: '1.02rem', lineHeight: '1.5' }}>
          First, you should attend a test on <strong>Spatial</strong>, <strong>Linguistic</strong>, and <strong>Musical</strong> intelligence to determine your best intelligence.
        </div>
      </div>

      <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '1rem' }}>
        Select an intelligence module to begin your assessment:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '600px' }}>
        {[
          { type: 'Spatial', route: '/spatial', description: '3 videos, 9 questions' },
          { type: 'Linguistic', route: '/linguistic', description: '25 questions' },
          { type: 'Musical', route: '/musical', description: '20 questions' },
        ].map(module => {
          const done = completed[module.type] !== null;
          return (
            <button type="button" key={module.type} disabled={done}
              className={`interactive-card ${done ? 'completed' : ''}`}
              style={{ textAlign: 'left', fontFamily: 'inherit', cursor: done ? 'default' : 'pointer', opacity: done ? .7 : 1, maxWidth: '100%', borderColor: done ? 'var(--success-color)' : '' }}
              onClick={() => !done && navigate(module.route)}>
              <div style={{ flex: 1 }}>
                <div className="card-title">{module.type} Intelligence</div>
                <div style={{ fontSize: '.9rem', color: 'var(--text-muted)' }}>
                  {done ? `Completed: ${completed[module.type]}%` : module.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: '3rem', width: '100%', maxWidth: '600px', display: 'flex', justifyContent: 'center' }}>
        <button 
          className="btn primary-btn" 
          style={{ width: '100%' }}
          onClick={() => navigate('/results')}
        >
          View Dashboard Analysis
        </button>
      </div>

    </div>
  );
}
