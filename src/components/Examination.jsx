// src/components/Examination.jsx
// Handles both Test A (baseline) and Test B (final).
// For Test B: fetches the exact saved Test A questions from the backend — never generates new ones.
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cleanMathText } from '../utils/mathCleaner';
import useAssessmentProtocol from '../hooks/useAssessmentProtocol';
import AssessmentProtocolNotice from './AssessmentProtocolNotice';
import AssessmentRules from './AssessmentRules';

const PYTHON_URL = 'http://localhost:8000';
const NODE_URL   = 'http://localhost:3001';

export default function Examination() {
  const navigate = useNavigate();
  const { phase } = useParams();   // 'baseline' | 'final'
  const isBaseline = phase === 'baseline';

  const sessionId  = sessionStorage.getItem('currentSessionId');
  const topicKey   = sessionStorage.getItem('currentTopicKey');
  const language   = sessionStorage.getItem('currentLanguage') || 'English';

  const [questions, setQuestions]   = useState([]);
  const [answers, setAnswers]       = useState({});  // { questionIndex: studentAnswerString }
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [totalMarks, setTotalMarks] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [examStarted, setExamStarted] = useState(false);

  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!sessionId || !topicKey) { navigate('/topic-select'); return; }
    let active = true;
    const validBaseline = paper => Array.isArray(paper) && paper.length === 9
      && paper.filter(q => q.type === 'mcq').length === 5
      && paper.filter(q => q.type === 'descriptive').length === 4;
    const load = async () => {
      try {
        const sessionRes = await fetch(`${NODE_URL}/api/sessions/by-id/${sessionId}`);
        if (!sessionRes.ok) throw new Error('Could not load your learning session');
        const session = await sessionRes.json();
        const savedRes = await fetch(`${NODE_URL}/api/sessions/${sessionId}/questions`);
        if (!savedRes.ok) throw new Error('Could not retrieve examination questions');
        let paper = await savedRes.json();
        if (isBaseline && paper.length && !validBaseline(paper)) {
          throw new Error('This session uses an earlier exam format. Choose your topic again to start Test A with 5 MCQs and 4 descriptive questions.');
        }
        if (isBaseline && !paper.length) {
          if (!active) return;
          const generatedRes = await fetch(`${PYTHON_URL}/api/exam/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic_key: session.topic_key, subtopic_key: session.subtopic_key || null,
              language: session.language, topic_title: session.topic }),
          });
          const generated = await generatedRes.json();
          if (!generatedRes.ok) throw new Error(generated.detail || 'Question generation failed');
          if (!validBaseline(generated.questions)) throw new Error('The examination must contain 5 MCQs and 4 descriptive questions. Please try again.');
          if (!active) return;
          const saveRes = await fetch(`${NODE_URL}/api/sessions/${sessionId}/questions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: generated.questions }),
          });
          if (!saveRes.ok && saveRes.status !== 409) throw new Error('Could not save the examination. Please try again.');
          // Render the saved paper, including on a concurrent/repeated load.
          // Test B and the submitted answer IDs must refer to these questions.
          const confirmed = await fetch(`${NODE_URL}/api/sessions/${sessionId}/questions`);
          if (!confirmed.ok) throw new Error('Could not confirm saved questions');
          paper = await confirmed.json();
          if (!validBaseline(paper)) throw new Error('The saved paper uses an earlier format. Please choose your topic again.');
        }
        if (!paper.length) throw new Error('Please complete Test A first.');
        if (active) {
          setQuestions(paper);
          setTotalMarks(paper.reduce((sum, q) => sum + q.marks, 0));
          setTopicTitle(session.topic);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [isBaseline, navigate, sessionId, topicKey]);

  const handleAnswer = (qIndex, value) => {
    setAnswers(prev => ({ ...prev, [String(qIndex)]: value }));
  };

  const allAnswered = () => {
    return questions.every((_, i) => {
      const ans = answers[String(i)];
      return ans !== undefined && ans !== null && String(ans).trim() !== '';
    });
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      // Evaluate each answer
      let totalObtained = 0;
      const savedQuestions = await fetch(`${NODE_URL}/api/sessions/${sessionId}/questions`)
        .then(r => r.json()).catch(() => []);

      const answersPayload = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const studentAns = String(answers[String(i)] || '');
        const dbQuestion = savedQuestions[i] || null;
        const questionId = dbQuestion?.id || null;

        let evalRes;
        try {
          const evalResponse = await fetch(`${PYTHON_URL}/api/exam/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question_type: q.type,
              question_text: q.text,
              correct_answer: q.correctAnswer,
              student_answer: studentAns,
              marks: q.marks,
              language,
            }),
          });
          evalRes = await evalResponse.json();
        } catch {
          // Fallback: 0 marks
          evalRes = { marks_awarded: 0, feedback: 'Evaluation unavailable.' };
        }

        totalObtained += evalRes.marks_awarded || 0;
        if (questionId) {
          answersPayload.push({
            questionId,
            studentAnswer: studentAns,
            marksAwarded: evalRes.marks_awarded || 0,
            feedback: evalRes.feedback || '',
          });
        }
      }

      // Save attempt
      const attemptRes = await fetch(`${NODE_URL}/api/sessions/${sessionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: isBaseline ? 'baseline' : 'final',
          answers: answersPayload,
          totalMarksPossible: totalMarks,
          marksObtained: Math.round(totalObtained * 10) / 10,
        }),
      });

      if (!attemptRes.ok) {
        const errData = await attemptRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save attempt');
      }

      const attemptData = await attemptRes.json();

      // Store result for the results page
      sessionStorage.setItem(`examResult_${phase}`, JSON.stringify({
        marksObtained: Math.round(totalObtained * 10) / 10,
        totalMarks,
        phase,
        attemptId: attemptData.attemptId,
        questionsCount: questions.length,
        timeTakenSecs: Math.floor((Date.now() - startTime) / 1000),
      }));

      navigate(`/exam-results/${phase}`);
    } catch (e) {
      alert('Submission error: ' + e.message);
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const protocol = useAssessmentProtocol({ active: examStarted && !loading && !submitting && questions.length > 0,
    onForceSubmit: handleSubmit, durationSeconds: 1800 });

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center', paddingTop: '4rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 className="glow-text">
            {isBaseline ? 'Generating Examination Questions...' : 'Loading Examination...'}
          </h2>
          <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>
            {isBaseline
              ? 'Preparing your questions…'
              : 'Retrieving your original Test A questions to ensure a fair comparison.'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', color: '#ef4444' }}>
          <h3>Examination Load Error</h3>
          <p style={{ color: '#64748b' }}>{error}</p>
          <button className="btn back-btn" style={{ marginTop: '1.5rem' }}
            onClick={() => navigate(isBaseline ? '/topic-select' : '/spatial-learning')}>
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="page" style={{ paddingTop: '2rem', maxWidth: 760 }}>
        <div className="card" style={{ padding: '2rem' }}>
          <h1>{isBaseline ? 'Test A — Baseline Examination' : 'Test B — Final Examination'}</h1>
          <h2 style={{ marginTop: 12 }}>{topicTitle}</h2>
          <p style={{ marginTop: 12 }}>{questions.length} questions · {totalMarks} marks · 30 minutes</p>
          <AssessmentRules />
          <button className="btn" onClick={() => { setStartTime(Date.now()); setExamStarted(true); }}>Start {isBaseline ? 'Test A' : 'Test B'}</button>
        </div>
      </div>
    );
  }

  const mcqQuestions   = questions.filter(q => q.type === 'mcq');
  const shortQuestions = questions.filter(q => q.type === 'short');
  const descQuestions  = questions.filter(q => q.type === 'descriptive');
  const answeredCount  = Object.keys(answers).filter(k => String(answers[k]).trim() !== '').length;

  return (
    <div className="page" style={{ paddingTop: '1.5rem', maxWidth: '860px' }}>

      <AssessmentProtocolNotice protocol={protocol} submitting={submitting} />
      <div inert={Boolean(protocol.warning || protocol.endReason)} style={{ display: 'contents' }}>

      {/* Header */}
      <div style={{
        width: '100%', background: isBaseline
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
          : 'linear-gradient(135deg, #1a0530 0%, #2d0a4e 100%)',
        borderRadius: '20px', padding: '1.5rem',
        border: isBaseline ? '2px solid #38bdf8' : '2px solid #a855f7',
        marginBottom: '2rem', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
            color: isBaseline ? '#38bdf8' : '#a855f7', marginBottom: '4px' }}>
            {isBaseline ? ' Test A — Baseline Examination' : ' Test B — Final Examination'}
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white' }}>{topicTitle}</div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>
            Language: {language} · {questions.length} questions · {totalMarks} total marks
            <br />Time remaining: {Math.floor(protocol.timeLeft / 60)}:{String(protocol.timeLeft % 60).padStart(2, '0')} · Departures: {protocol.warningCount}/3
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Answered</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900,
            color: answeredCount === questions.length ? '#34d399' : '#f59e0b' }}>
            {answeredCount}/{questions.length}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '12px',
        padding: '1rem 1.3rem', marginBottom: '2rem', width: '100%', fontSize: '0.9rem', color: '#78350f'
      }}>
        <strong> Instructions:</strong> Answer all questions carefully.
        MCQs are worth 1 mark each. {shortQuestions.length > 0 && 'Short-answer questions are worth 2 marks each. '}
        Descriptive questions are worth 5 marks each. Total marks: <strong>{totalMarks}</strong>.
      </div>

      {/* MCQ Section */}
      {mcqQuestions.length > 0 && (
        <div style={{ width: '100%', marginBottom: '2rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#0f172a',
            borderBottom: '2px solid #2563eb', paddingBottom: '8px', marginBottom: '1.2rem' }}>
            Section A — Multiple Choice Questions (1 mark each)
          </h3>
          {mcqQuestions.map((q, sectionIdx) => {
            const globalIdx = questions.indexOf(q);
            return (
              <div key={globalIdx} className="question-card" style={{ marginBottom: '1.2rem' }}>
                <div className="weight-badge">1 mark</div>
                <div className="question-text" style={{ fontSize: '1.05rem', paddingRight: '80px' }}>
                  Q{sectionIdx + 1}. {cleanMathText(q.text)}
                </div>
                <div className="options-container">
                  {(q.options || []).map((opt, oIdx) => (
                    <label key={oIdx}
                      className={`option-label ${answers[String(globalIdx)] === String(oIdx) ? 'selected' : ''}`}>
                      <input type="radio" className="option-input"
                        name={`q_${globalIdx}`}
                        onChange={() => handleAnswer(globalIdx, String(oIdx))}
                        checked={answers[String(globalIdx)] === String(oIdx)} />
                      <div className="custom-radio" />
                      <span className="option-text">
                        <span style={{ fontWeight: 700, marginRight: '6px' }}>
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        {cleanMathText(opt)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Short Answer Section */}
      {shortQuestions.length > 0 && (
        <div style={{ width: '100%', marginBottom: '2rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#0f172a',
            borderBottom: '2px solid #059669', paddingBottom: '8px', marginBottom: '1.2rem' }}>
            Section B — Short Answer Questions (2 marks each)
          </h3>
          {shortQuestions.map((q, sectionIdx) => {
            const globalIdx = questions.indexOf(q);
            return (
              <div key={globalIdx} className="question-card" style={{ marginBottom: '1.2rem' }}>
                <div className="weight-badge" style={{ background: '#f0fdf4', color: '#059669', borderColor: '#86efac' }}>
                  2 marks
                </div>
                <div className="question-text" style={{ fontSize: '1.05rem', paddingRight: '80px' }}>
                  Q{mcqQuestions.length + sectionIdx + 1}. {cleanMathText(q.text)}
                </div>
                <textarea
                  placeholder="Write your answer here (2-3 sentences)..."
                  value={answers[String(globalIdx)] || ''}
                  onChange={e => handleAnswer(globalIdx, e.target.value)}
                  rows={4}
                  style={{
                    width: '100%', padding: '0.9rem', borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '1rem', outline: 'none', resize: 'vertical', color: '#1e293b',
                    background: '#f8fafc', lineHeight: '1.6',
                    fontFamily: language === 'Tamil' ? "'Noto Sans Tamil', sans-serif" : 'inherit'
                  }}
                  onFocus={e => e.target.style.borderColor = '#059669'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Descriptive Section */}
      {descQuestions.length > 0 && (
        <div style={{ width: '100%', marginBottom: '2rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#0f172a',
            borderBottom: '2px solid #7c3aed', paddingBottom: '8px', marginBottom: '1.2rem' }}>
            Section {shortQuestions.length ? 'C' : 'B'} — Descriptive Questions (5 marks each)
          </h3>
          {descQuestions.map((q, sectionIdx) => {
            const globalIdx = questions.indexOf(q);
            return (
              <div key={globalIdx} className="question-card" style={{ marginBottom: '1.2rem' }}>
                <div className="weight-badge" style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#c4b5fd' }}>
                  5 marks
                </div>
                <div className="question-text" style={{ fontSize: '1.05rem', paddingRight: '80px' }}>
                  Q{mcqQuestions.length + shortQuestions.length + sectionIdx + 1}. {cleanMathText(q.text)}
                </div>
                <textarea
                  placeholder="Write a detailed answer (1-2 paragraphs with examples)..."
                  value={answers[String(globalIdx)] || ''}
                  onChange={e => handleAnswer(globalIdx, e.target.value)}
                  rows={8}
                  style={{
                    width: '100%', padding: '0.9rem', borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '1rem', outline: 'none', resize: 'vertical', color: '#1e293b',
                    background: '#f8fafc', lineHeight: '1.7',
                    fontFamily: language === 'Tamil' ? "'Noto Sans Tamil', sans-serif" : 'inherit'
                  }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Submit */}
      <div style={{ width: '100%', marginBottom: '3rem' }}>
        {!allAnswered() && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            padding: '0.8rem 1.2rem', marginBottom: '1rem', color: '#b91c1c', fontSize: '0.9rem'
          }}>
             Please answer all {questions.length} questions before submitting.
            ({answeredCount}/{questions.length} answered)
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || !allAnswered()}
          className="btn primary-btn"
          style={{
            width: '100%', fontSize: '1.1rem',
            background: submitting ? '#94a3b8'
              : isBaseline ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
              : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            opacity: (!allAnswered() && !submitting) ? 0.5 : 1,
            cursor: (!allAnswered() && !submitting) ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting
            ? ' Evaluating answers and saving results...'
            : `Submit ${isBaseline ? 'Test A' : 'Test B'} — ${totalMarks} Total Marks`
          }
        </button>
      </div>
      </div>
    </div>
  );
}
