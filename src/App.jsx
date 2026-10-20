import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Existing components (preserved)
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import SpatialAssessment from './components/SpatialAssessment';
import LinguisticAssessment from './components/LinguisticAssessment';
import MusicalAssessment from './components/MusicalAssessment';
import Results from './components/Results';
import LearningSpatial from './components/LearningSpatial';
import LearningLinguistic from './components/LearningLinguistic';
import LearningMusical from './components/LearningMusical';
import SpatialDashboard from './components/SpatialDashboard';

// New pipeline components
import TopicSelect from './components/TopicSelect';
import TextbookLearn from './components/TextbookLearn';
import Examination from './components/Examination';
import ExamResults from './components/ExamResults';
import SpatialLearning from './components/SpatialLearning';
import CompareResults from './components/CompareResults';

import './index.css';

function App() {
  const [user, setUser] = useState(null);

  const guard = (element) => user ? element : <Navigate to="/" />;

  return (
    <Router>
      <div className="modern-bg">
        <div className="bg-shape shape-1" />
        <div className="bg-shape shape-2" />
        <div className="bg-shape shape-3" />
      </div>

      {user && (
        <div style={{
          position: 'absolute', top: '20px', right: '30px', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: '15px'
        }}>
          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-color)', fontSize: '1.1rem' }}>
            Hello, {user.username}
          </span>
          <button
            data-assessment-navigation
            onClick={() => setUser(null)}
            style={{
              background: 'white', border: '1px solid var(--card-border)',
              color: 'var(--text-main)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.9rem', transition: 'all 0.3s', fontWeight: '500', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
            onMouseOver={e => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#cbd5e1'; }}
            onMouseOut={e => { e.target.style.background = 'white'; e.target.style.borderColor = 'var(--card-border)'; }}
          >
            Sign Out
          </button>
        </div>
      )}

      <main>
        <Routes>
          {/* ── Auth ─────────────────────────────────────────────────────── */}
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Auth onLogin={setUser} />} />

          {/* ── Existing routes (preserved) ──────────────────────────────── */}
          <Route path="/dashboard"        element={guard(<Dashboard user={user} onLogout={() => setUser(null)} />)} />
          <Route path="/spatial"          element={guard(<SpatialAssessment user={user} />)} />
          <Route path="/linguistic"       element={guard(<LinguisticAssessment user={user} />)} />
          <Route path="/musical"          element={guard(<MusicalAssessment user={user} />)} />
          <Route path="/results"          element={guard(<Results user={user} />)} />
          <Route path="/spatial-dashboard" element={guard(<SpatialDashboard user={user} />)} />
          <Route path="/learn-spatial"    element={guard(<LearningSpatial />)} />
          <Route path="/learn-linguistic" element={guard(<LearningLinguistic user={user} />)} />
          <Route path="/learn-musical"    element={guard(<LearningMusical user={user} />)} />

          {/* ── New learning pipeline routes ──────────────────────────────── */}
          <Route path="/topic-select"     element={guard(<TopicSelect user={user} />)} />
          <Route path="/textbook-learn"   element={guard(<TextbookLearn user={user} />)} />
          <Route path="/exam/:phase"      element={guard(<Examination user={user} />)} />
          <Route path="/exam-results/:phase" element={guard(<ExamResults user={user} />)} />
          <Route path="/learning"         element={guard(<SpatialLearning user={user} />)} />
          <Route path="/spatial-learning" element={guard(<SpatialLearning user={user} />)} />
          <Route path="/compare"          element={guard(<CompareResults user={user} />)} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
