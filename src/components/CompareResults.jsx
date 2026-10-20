import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cleanMathText } from '../utils/mathCleaner';

const NODE_URL = 'http://localhost:3001';

const ScoreBar = ({ value, max, color, label }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5,
        fontSize: '0.88rem', fontWeight: 600, color: '#64748b' }}>
        <span>{label}</span>
        <span style={{ color }}>{value}/{max} ({Math.round(pct)}%)</span>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: '8px', height: '12px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%',
          background: color, borderRadius: '8px', transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
};

export default function CompareResults() {
  const navigate  = useNavigate();
  const sessionId = sessionStorage.getItem('currentSessionId');

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!sessionId) { navigate('/topic-select'); return; }
    fetch(`${NODE_URL}/api/sessions/${sessionId}/compare`)
      .then(r => r.json())
      .then(d => { setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate, sessionId]);

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center', paddingTop: '4rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 className="glow-text">Loading Comparison...</h2>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', color: '#ef4444' }}>
          <p> {error || 'Could not load comparison data'}</p>
          <button className="btn back-btn" style={{ marginTop: '1rem' }}
            onClick={() => navigate('/results')}>← Back to Results</button>
        </div>
      </div>
    );
  }

  const { session, baseline, final: finalAttempt, questions = [] } = data;
  const maxMarks = baseline?.totalMarksPossible || finalAttempt?.totalMarksPossible || 0;

  // Safe computations
  const baselineScore = baseline?.marksObtained ?? null;
  const finalScore    = finalAttempt?.marksObtained ?? null;

  const basePct = (baselineScore !== null && maxMarks > 0)
    ? Math.round((baselineScore / maxMarks) * 1000) / 10 : null;
  const finalPct = (finalScore !== null && maxMarks > 0)
    ? Math.round((finalScore / maxMarks) * 1000) / 10 : null;

  const marksDiff = (finalScore !== null && baselineScore !== null)
    ? Math.round((finalScore - baselineScore) * 10) / 10 : null;
  const pctDiff   = (finalPct !== null && basePct !== null)
    ? Math.round((finalPct - basePct) * 10) / 10 : null;

  const improved  = marksDiff !== null && marksDiff > 0;
  const decreased = marksDiff !== null && marksDiff < 0;

  const changeColor = improved ? '#059669' : decreased ? '#ef4444' : '#64748b';
  const changeLabel = improved ? 'Improvement' : decreased ? 'Decrease' : 'No Change';



  return (
    <div className="page" style={{ paddingTop: '2rem', maxWidth: '860px' }}>
      <button className="btn back-btn" onClick={() => navigate('/results')}>← Back to Results</button>

      {/* Title */}
      <h2 className="glow-text section-title" style={{ fontSize: '2.2rem' }}>
         Performance Comparison
      </h2>

      {/* Session summary */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(37,99,235,0.08) 0%,rgba(124,58,237,0.08) 100%)',
        border: '1px solid rgba(37,99,235,0.25)', borderRadius: '18px',
        padding: '1.2rem 1.5rem', marginBottom: '2rem', width: '100%',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
          {[
            { label: 'Topic', value: session?.topic },
            { label: 'Language', value: session?.language },
            { label: 'Dominant Intelligence', value: session?.dominant_intelligence },
            { label: 'Maximum Marks', value: maxMarks || '—' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                {item.value || '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score cards side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', width: '100%', marginBottom: '2rem' }}>
        {/* Test A */}
        <div style={{
          background: 'white', border: '2px solid #bfdbfe', borderRadius: '20px', padding: '1.8rem',
          textAlign: 'center', boxShadow: '0 4px 15px rgba(37,99,235,0.1)',
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase',
            marginBottom: 8, letterSpacing: '0.5px' }}>
             Test A — Baseline
          </div>
          {baselineScore !== null ? (
            <>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>
                {baselineScore}
                <span style={{ fontSize: '1.4rem', color: '#94a3b8' }}>/{maxMarks}</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
                {basePct}%
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                After textbook reading
              </div>
            </>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '1rem', padding: '1rem 0' }}>
              Not yet completed
            </div>
          )}
        </div>

        {/* Test B */}
        <div style={{
          background: 'white', border: '2px solid #c4b5fd', borderRadius: '20px', padding: '1.8rem',
          textAlign: 'center', boxShadow: '0 4px 15px rgba(124,58,237,0.1)',
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase',
            marginBottom: 8, letterSpacing: '0.5px' }}>
             Test B — Final
          </div>
          {finalScore !== null ? (
            <>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>
                {finalScore}
                <span style={{ fontSize: '1.4rem', color: '#94a3b8' }}>/{maxMarks}</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed', marginTop: 4 }}>
                {finalPct}%
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                After {session?.dominant_intelligence || 'spatial'} learning
              </div>
            </>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '1rem', padding: '1rem 0' }}>
              Not yet completed
            </div>
          )}
        </div>
      </div>

      {/* Score bars */}
      {(baselineScore !== null || finalScore !== null) && maxMarks > 0 && (
        <div className="card" style={{ padding: '1.8rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#0f172a', marginBottom: '1.2rem' }}>
             Score Comparison
          </h3>
          {baselineScore !== null && (
            <ScoreBar value={baselineScore} max={maxMarks} color="#2563eb" label="Test A (Baseline)" />
          )}
          {finalScore !== null && (
            <ScoreBar value={finalScore} max={maxMarks} color="#7c3aed" label="Test B (Final)" />
          )}
        </div>
      )}

      {/* Change summary */}
      {marksDiff !== null && (
        <div style={{
          background: improved ? '#f0fdf4' : decreased ? '#fef2f2' : '#f8fafc',
          border: `2px solid ${improved ? '#86efac' : decreased ? '#fecaca' : '#e2e8f0'}`,
          borderRadius: '20px', padding: '2rem', width: '100%', textAlign: 'center',
          marginBottom: '2rem',
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: changeColor, textTransform: 'uppercase',
            marginBottom: 4, letterSpacing: '0.5px' }}>
            {changeLabel}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: changeColor }}>
            {improved ? '+' : ''}{marksDiff} marks
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: changeColor, marginTop: 4 }}>
            {pctDiff !== null ? `${improved ? '+' : ''}${pctDiff} percentage points` : '—'}
          </div>
          <p style={{ color: '#64748b', fontSize: '0.93rem', marginTop: '1rem', lineHeight: 1.5, maxWidth: 500, margin: '1rem auto 0' }}>
            {improved
              ? `Great job! Spatial intelligence learning helped you gain ${marksDiff} more mark${marksDiff !== 1 ? 's' : ''} — a ${pctDiff} percentage-point improvement.`
              : decreased
              ? `Your score decreased by ${Math.abs(marksDiff)} mark${Math.abs(marksDiff) !== 1 ? 's' : ''}. This is important data — not every experiment shows improvement.`
              : 'Your score remained the same in both attempts. This is also a valid experimental result.'}
          </p>
        </div>
      )}

      {/* Detailed metrics table */}
      <div className="card" style={{ padding: '1.8rem', marginBottom: '2rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#0f172a', marginBottom: '1.2rem' }}>
           Detailed Metrics
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.93rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>Metric</th>
              <th style={{ textAlign: 'center', padding: '10px 12px', color: '#2563eb', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>Test A</th>
              <th style={{ textAlign: 'center', padding: '10px 12px', color: '#7c3aed', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>Test B</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Marks Obtained',       a: baselineScore, b: finalScore, suffix: ` / ${maxMarks}` },
              { label: 'Percentage',            a: basePct,       b: finalPct,   suffix: '%' },
              { label: 'Maximum Marks',         a: maxMarks,      b: maxMarks,   suffix: '' },
            ].map(row => (
              <tr key={row.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 600 }}>{row.label}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#2563eb', fontWeight: 700 }}>
                  {row.a !== null ? `${row.a}${row.suffix}` : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#7c3aed', fontWeight: 700 }}>
                  {row.b !== null ? `${row.b}${row.suffix}` : '—'}
                </td>
              </tr>
            ))}
            {marksDiff !== null && (
              <tr style={{ background: improved ? '#f0fdf4' : decreased ? '#fef2f2' : '#f8fafc' }}>
                <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 700 }}>Change (B − A)</td>
                <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', color: changeColor, fontWeight: 900 }}>
                  {improved ? '+' : ''}{marksDiff} marks &nbsp;|&nbsp;
                  {pctDiff !== null ? `${improved ? '+' : ''}${pctDiff} pp` : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: '0.8rem', fontSize: '0.78rem', color: '#94a3b8' }}>
          pp = percentage points &nbsp;·&nbsp; Both tests used identical questions and marking criteria.
        </div>
      </div>

      {/* Question-by-Question Deep AI Evaluation Breakdown */}
      {questions.length > 0 && (
        <div style={{ width: '100%', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
            <span style={{ fontSize: '1.6rem' }}></span>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: '#0f172a', fontWeight: '800' }}>
                Question-by-Question Deep AI Evaluation
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Full response comparison between Test A and Test B evaluated by AI against curriculum model answers.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {questions.map((q, idx) => {
              const base = q.baselineAnswer;
              const fin = q.finalAnswer;
              const baseScore = base?.marksObtained ?? 0;
              const finScore = fin?.marksObtained ?? 0;
              const isBetter = finScore > baseScore;
              const isSame = finScore === baseScore && finScore > 0;
              const isWorse = finScore < baseScore;

              return (
                <div key={q.id || idx} style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  border: isBetter ? '2px solid #86efac' : '1px solid #e2e8f0',
                  padding: '1.4rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}>
                  {/* Header: Q Number, Type, Marks & Outcome Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: '#eff6ff', color: '#2563eb', padding: '3px 10px',
                        borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800
                      }}>
                        Q{idx + 1} · {q.type?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                        ({q.marks} Mark{q.marks > 1 ? 's' : ''})
                      </span>
                    </div>

                    {isBetter && (
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                         +{finScore - baseScore} Mark Improvement
                      </span>
                    )}
                    {isSame && (
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                         Maintained Full Score
                      </span>
                    )}
                    {isWorse && (
                      <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                         Needs Review
                      </span>
                    )}
                  </div>

                  {/* Question Text */}
                  <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', lineHeight: 1.5 }}>
                    {cleanMathText(q.text)}
                  </div>

                  {/* Best / Model Answer */}
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '0.8rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.88rem',
                    color: '#166534'
                  }}>
                    <strong> Best / Curriculum Answer:</strong> {cleanMathText(q.correctAnswer)}
                  </div>

                  {/* Comparison Grid: Test A vs Test B */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {/* Test A Card */}
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb' }}>
                           Test A (Baseline)
                        </span>
                        <span style={{
                          fontSize: '0.82rem', fontWeight: 800,
                          color: base?.isCorrect ? '#16a34a' : '#dc2626'
                        }}>
                          {base?.marksObtained ?? 0} / {q.marks}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, marginBottom: '6px' }}>
                        {cleanMathText(base?.studentAnswer) || <em style={{ color: '#94a3b8' }}>No answer provided</em>}
                      </div>
                      {base?.feedback && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px' }}>
                           {cleanMathText(base.feedback)}
                        </div>
                      )}
                    </div>

                    {/* Test B Card */}
                    <div style={{
                      background: fin?.isCorrect ? '#faf5ff' : '#f8fafc',
                      border: fin?.isCorrect ? '1px solid #d8b4fe' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed' }}>
                           Test B (After Spatial Learning)
                        </span>
                        <span style={{
                          fontSize: '0.82rem', fontWeight: 800,
                          color: fin?.isCorrect ? '#16a34a' : '#dc2626'
                        }}>
                          {fin?.marksObtained ?? 0} / {q.marks}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, marginBottom: '6px' }}>
                        {cleanMathText(fin?.studentAnswer) || <em style={{ color: '#94a3b8' }}>No answer provided</em>}
                      </div>
                      {fin?.feedback && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px' }}>
                           {cleanMathText(fin.feedback)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1rem', width: '100%', flexWrap: 'wrap', marginBottom: '3rem' }}>
        <button onClick={() => navigate('/dashboard')} className="btn secondary-btn" style={{ flex: 1 }}>
           Back to Dashboard
        </button>
        <button onClick={() => navigate('/topic-select')} className="btn primary-btn" style={{ flex: 1 }}>
           Start a New Topic
        </button>
      </div>
    </div>
  );
}
