import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ChevronLeft, Compass, Dna, Droplet, HeartPulse, Leaf, Loader2, Orbit, Search, Zap } from 'lucide-react';
import { VideoCard, VideoFilters, VideoModal } from './VideoLessons';

export default function SpatialDashboard({ user }) {
  const navigate = useNavigate();
  const [searchTopic, setSearchTopic]     = useState('');
  const [searchedTopic, setSearchedTopic] = useState('');
  const [hasSearched, setHasSearched]     = useState(false);

  // Video data from API
  const [tamilVideos, setTamilVideos]     = useState([]);
  const [englishVideos, setEnglishVideos] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);

  // Language filter tab: 'ALL' | 'Tamil' | 'English'
  const [activeFilter, setActiveFilter]   = useState('ALL');

  // Modal & Rating
  const [activeVideo, setActiveVideo]     = useState(null);
  const [ratings, setRatings]             = useState({});

  // Quiz state
  const [quizStarted, setQuizStarted]               = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers]         = useState({});
  const [quizSubmitted, setQuizSubmitted]             = useState(false);

  // Quick topic chips
  const filterChips = [
    { label: 'Plant Habitats',  icon: Leaf,      query: 'Plant Habitats' },
    { label: 'Human Body',      icon: HeartPulse, query: 'Human Body Organs and Systems' },
    { label: 'Water Cycle',     icon: Droplet,   query: 'Water Cycle' },
    { label: 'Electricity',     icon: Zap,       query: 'Electricity and Electric Circuits' },
    { label: 'Solar System',    icon: Orbit,     query: 'Solar System Planets' },
    { label: 'Magnets & Forces',icon: Dna,       query: 'Magnets and Magnetic Fields' },
  ];

  // Quiz questions
  const sampleQuizQuestions = [
    {
      question: `What is the primary concept in understanding ${searchedTopic || 'this science topic'}?`,
      options: [
        'How the parts interact and function together in a system',
        'A flat static diagram with no movement or explanation',
        'Random particle behaviour with no pattern',
        'Single-line text with no supporting diagrams',
      ],
      correct: 0,
    },
    {
      question: `Why do educational videos make ${searchedTopic || 'science concepts'} easier to learn?`,
      options: [
        'They show processes and structures that are hard to see with the naked eye',
        'They remove the need to read textbook definitions',
        'They make all science formulas identical',
        'They focus only on entertainment rather than concepts',
      ],
      correct: 0,
    },
    {
      question: 'Which habit helps you remember science lessons best for exams?',
      options: [
        'Connecting video explanations to textbook terms and sketching diagrams',
        'Memorising only video titles without watching the content',
        'Skipping explanations to guess the answers',
        'Watching videos at triple speed without taking notes',
      ],
      correct: 0,
    },
  ];

  // ── Search handler ──────────────────────────────────────────────────────────
  const handleSearch = async (queryToSearch) => {
    const topic = (queryToSearch !== undefined ? queryToSearch : searchTopic).trim();
    if (!topic) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setSearchedTopic(topic);
    setSearchTopic(topic);
    setTamilVideos([]);
    setEnglishVideos([]);
    setActiveFilter('ALL');
    setQuizStarted(false);
    setQuizSubmitted(false);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);

    try {
      const response = await fetch('http://localhost:8000/api/spatial/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          student_id: user?.id ? String(user.id) : 'student_6th',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Search failed with status ${response.status}`);
      }

      const data = await response.json();
      setTamilVideos(data.tamil_videos   || []);
      setEnglishVideos(data.english_videos || []);
    } catch (err) {
      console.error('Error searching videos:', err);
      setError(err.message || 'Failed to search educational videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const handleRateVideo = (videoId, starCount) =>
    setRatings((prev) => ({ ...prev, [videoId]: starCount }));

  const calculateQuizScore = () => {
    let score = 0;
    sampleQuizQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct) score++;
    });
    return score;
  };

  // Derive the video list shown based on active filter
  const allVideos     = [...tamilVideos, ...englishVideos];
  const filteredVideos =
    activeFilter === 'Tamil'   ? tamilVideos :
    activeFilter === 'English' ? englishVideos :
    allVideos;

  const countAll     = allVideos.length;
  const countTamil   = tamilVideos.length;
  const countEnglish = englishVideos.length;

  return (
    <div className="page video-page">
      <button className="btn back-btn" onClick={() => navigate('/results')}><ChevronLeft size={15} /> Back to Results</button>
      <header className="lesson-heading"><span className="eyebrow">The science collection · Spatial learning</span><h1>See a little further.</h1><p className="text-muted">Explore your Class 6 Science topics through video lessons in English and Tamil.</p></header>
      <section className="card" aria-labelledby="search-heading"><h2 id="search-heading">What would you like to explore?</h2>
        <form className="search-form" onSubmit={event => { event.preventDefault(); handleSearch(); }}><input aria-label="Science topic" placeholder="Search a science topic…" value={searchTopic} onChange={event => setSearchTopic(event.target.value)} /><button className="btn" disabled={loading || !searchTopic.trim()} type="submit"><Search size={16} /> Search lessons</button></form>
        <div className="search-chips">{filterChips.map(chip => { const Icon = chip.icon; return <button type="button" key={chip.label} onClick={() => handleSearch(chip.query)}><Icon size={13} />{chip.label}</button>; })}</div>
      </section>
      {!hasSearched && <div className="empty-state"><Compass size={36} strokeWidth={1} /><h3>Curiosity is a good place to start.</h3><p>Choose a topic above to find your next lesson.</p></div>}
      {hasSearched && <>
        <div className="section-heading"><div><span className="eyebrow">Your lesson collection</span><h2>{searchedTopic}</h2></div><span className="small-label">{countAll} lessons</span></div>
        <div style={{ marginBottom: '1.5rem' }}><VideoFilters active={activeFilter} onChange={setActiveFilter} tamilCount={countTamil} englishCount={countEnglish} /></div>
        {loading ? <div className="empty-state" role="status"><Loader2 size={28} className="animate-spin" /><h3>Finding your video lessons…</h3></div> : error ? <div className="empty-state" role="alert"><AlertCircle size={28} /><h3>Lessons could not be loaded.</h3><p>{error}</p><button className="btn secondary-btn" onClick={() => handleSearch(searchedTopic)}>Try again</button></div> : filteredVideos.length ? <div className="video-grid">{filteredVideos.map((video, index) => <VideoCard key={video.video_id || index} video={video} onPlay={setActiveVideo} rating={ratings[video.video_id] || 0} onRate={handleRateVideo} />)}</div> : <div className="empty-state"><h3>No lessons found.</h3><p>Try another language or search for a different topic.</p></div>}
        <section className="card" style={{ marginTop: '2rem' }} aria-labelledby="practice-title"><span className="eyebrow">A moment to reflect</span><h2 id="practice-title">Check your understanding.</h2>
          {!quizStarted ? <><p className="text-muted">Practise connecting what you see to what you learn.</p><button className="btn" style={{ marginTop: '1rem' }} onClick={() => setQuizStarted(true)}>Start practice <ArrowRight size={16} /></button></> : quizSubmitted ? <div><h3>Practice complete.</h3><p className="result-score">{calculateQuizScore()} / {sampleQuizQuestions.length}</p><button className="btn secondary-btn" onClick={() => { setQuizStarted(false); setQuizSubmitted(false); setSelectedAnswers({}); setCurrentQuestionIndex(0); }}>Practise again</button></div> : <>
            <p className="small-label" style={{ marginBottom: '1rem' }}>Question {currentQuestionIndex + 1} of {sampleQuizQuestions.length}</p>
            <div className="question-card"><p className="question-text">{sampleQuizQuestions[currentQuestionIndex].question}</p><div className="options-container">{sampleQuizQuestions[currentQuestionIndex].options.map((option, index) => <button type="button" key={index} aria-pressed={selectedAnswers[currentQuestionIndex] === index} className={`option-label${selectedAnswers[currentQuestionIndex] === index ? ' selected' : ''}`} onClick={() => setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: index }))}>{String.fromCharCode(65 + index)}. {option}</button>)}</div></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><button className="btn secondary-btn" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(prev => prev - 1)}>Previous</button>{currentQuestionIndex < sampleQuizQuestions.length - 1 ? <button className="btn" onClick={() => setCurrentQuestionIndex(prev => prev + 1)}>Next question <ArrowRight size={15} /></button> : <button className="btn" onClick={() => setQuizSubmitted(true)}>Finish practice</button>}</div>
          </>}
        </section>
      </>}
      {activeVideo && <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />}
    </div>
  );
}
