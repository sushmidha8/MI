import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LearningSpatial() {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="page" style={{ paddingTop: '2rem' }}>
      <button className="btn back-btn" onClick={() => navigate('/results')}>← Back to Results</button>
      <h2 className="glow-text section-title">Spatial Intelligence — Personalized Learning</h2>
      
      {/* Option 1: Storytelling */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: '2rem' }}>
        <div className={`interactive-card ${isPlaying ? 'active' : ''}`} 
             onClick={() => setIsPlaying(true)}
             style={{ flexDirection: 'column', padding: '2rem', maxWidth: '700px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', borderBottom: '1px solid var(--primary-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div className="card-title" style={{ fontSize: '1.5rem' }}>Storytelling: Habitat of Animals</div>
          </div>
          <div style={{ color: 'var(--text-main)', lineHeight: '1.6', fontSize: '1.1rem' }}>
            <p>Explore the diverse environments where animals live through this immersive visual story. Watch how different creatures navigate their spatial worlds!</p>
          </div>
          <div style={{ marginTop: '1.5rem', width: '100%', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 'bold' }}>
            {isPlaying ? 'Playing Video...' : 'Click to watch the visual habitat story'}
          </div>
        </div>
      </div>

      {isPlaying && (
        <div className="player-container" style={{ maxWidth: '750px', margin: '0 auto 2rem auto' }}>
          <video controls autoPlay className="styled-player" src="/video6.mp4" style={{ width: '100%', borderRadius: '16px' }} />
        </div>
      )}

      {/* Option 2: Treasure Hunt */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: '2rem' }}>
        <a href="/hunt.html" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', width: '100%', maxWidth: '700px' }}>
          <div className="interactive-card" 
               style={{ flexDirection: 'column', padding: '2rem', width: '100%', cursor: 'pointer', borderTop: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', borderBottom: '1px solid #f59e0b', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div className="card-title" style={{ fontSize: '1.5rem', color: '#0f172a' }}>Activity: Treasure Hunt Challenge</div>
            </div>
            <div style={{ color: 'var(--text-main)', lineHeight: '1.6', fontSize: '1.1rem' }}>
              <p>Put your visualization and mental mapping skills to the test! Navigate through a challenging environment to find the hidden treasure.</p>
            </div>
            <div style={{ marginTop: '1.5rem', width: '100%', textAlign: 'center' }}>
              <div className="btn primary-btn" style={{ background: '#f59e0b', borderColor: '#f59e0b', display: 'inline-block' }}>Launch Treasure Hunt</div>
            </div>
          </div>
        </a>
      </div>

    </div>
  );
}
