import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Orbit,
  Dna,
  Droplet,
  Zap,
  Play,
  X,
  Compass,
  ChevronLeft,
  Loader2,
  Clock,
  BookOpen,
  Star,
  Award,
  Eye,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Leaf,
  HeartPulse,
  Globe,
} from 'lucide-react';

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

  // ── Shared styles ────────────────────────────────────────────────────────────
  const tabBase = {
    border: '1px solid',
    borderRadius: '12px',
    padding: '8px 18px',
    fontSize: '0.88rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  };

  const tabActive   = (color) => ({ ...tabBase, backgroundColor: color, color: '#ffffff', borderColor: color });
  const tabInactive = () => ({ ...tabBase, backgroundColor: '#1e293b', color: '#cbd5e1', borderColor: '#334155' });

  // ── Video Card ───────────────────────────────────────────────────────────────
  const VideoCard = ({ vid, index }) => {
    const isTamil = vid.language === 'Tamil';

    return (
      <div
        style={{
          backgroundColor: '#151c2c',
          borderRadius: '20px',
          border: '1px solid #28354e',
          overflow: 'hidden',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '1.5rem',
          padding: '1.2rem',
          transition: 'border-color 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = isTamil ? '#f59e0b' : '#38bdf8';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = '#28354e';
        }}
      >
        {/* Thumbnail */}
        <div
          onClick={() => setActiveVideo(vid)}
          style={{
            position: 'relative',
            borderRadius: '14px',
            overflow: 'hidden',
            cursor: 'pointer',
            height: '210px',
            backgroundColor: '#0f172a',
          }}
        >
          <img
            src={vid.thumbnail_url}
            alt={vid.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Language badge */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: isTamil ? 'rgba(245,158,11,0.92)' : 'rgba(56,189,248,0.92)',
              backdropFilter: 'blur(4px)',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {isTamil ? ' Tamil' : ' English'}
          </div>

          {/* Duration pill */}
          {vid.duration && (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.85)',
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Clock size={12} /> {vid.duration}
            </div>
          )}

          {/* Play overlay */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(56,189,248,0.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(56,189,248,0.6)',
            }}
          >
            <Play size={24} color="#0f172a" style={{ marginLeft: '3px' }} />
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* Channel + views */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: isTamil ? '#f59e0b' : '#38bdf8', fontWeight: '700' }}>
                 {vid.channel_title}
              </span>
              {vid.view_count && (
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Eye size={13} /> {vid.view_count}
                </span>
              )}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: isTamil ? '#f59e0b' : '#38bdf8',
                  border: `1px solid ${isTamil ? 'rgba(245,158,11,0.4)' : 'rgba(56,189,248,0.4)'}`,
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                {vid.language}
              </span>
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: '1.15rem',
                fontWeight: '700',
                color: '#ffffff',
                margin: '0 0 0.5rem 0',
                lineHeight: '1.35',
              }}
            >
              {index + 1}. {vid.title}
            </h3>

            {/* Description */}
            <p
              style={{
                fontSize: '0.88rem',
                color: '#94a3b8',
                margin: '0 0 1rem 0',
                lineHeight: '1.5',
              }}
            >
              {vid.description}
            </p>

            {/* Study notes */}
            <div
              style={{
                background: '#0f172a',
                borderRadius: '12px',
                border: '1px solid #1e293b',
                padding: '0.8rem 1rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: '#a855f7',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <BookOpen size={14} /> Lesson Takeaways & Revision Notes:
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.2rem',
                  color: '#cbd5e1',
                  fontSize: '0.85rem',
                  lineHeight: '1.55',
                }}
              >
                {(vid.notes && vid.notes.length > 0
                  ? vid.notes
                  : [
                      `Visual explanation of ${searchedTopic} key concepts`,
                      'Notice how the video depicts processes and key terms',
                      'Essential exam takeaway points for 6th Standard revision',
                    ]
                ).map((note, nIdx) => (
                  <li key={nIdx}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '0.8rem',
              borderTop: '1px solid #1e293b',
            }}
          >
            {/* Star rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '600' }}>Rate:</span>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3, 4, 5].map((starNum) => (
                  <button
                    key={starNum}
                    onClick={() => handleRateVideo(vid.video_id, starNum)}
                    title={`Rate ${starNum} stars`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                  >
                    <Star
                      size={18}
                      fill={(ratings[vid.video_id] || 0) >= starNum ? '#f59e0b' : 'none'}
                      color={(ratings[vid.video_id] || 0) >= starNum ? '#f59e0b' : '#64748b'}
                    />
                  </button>
                ))}
              </div>
              {(ratings[vid.video_id] || 0) > 0 && (
                <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 'bold' }}>
                  ({ratings[vid.video_id]}/5)
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href={`https://www.youtube.com/watch?v=${vid.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <ExternalLink size={14} /> YouTube
              </a>
              <button
                onClick={() => setActiveVideo(vid)}
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
                }}
              >
                <Play size={14} /> Watch Video
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b0f19',
        color: '#f1f5f9',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '2rem 1.5rem 4rem 1.5rem',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'fixed', top: '-10%', left: '20%', width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'fixed', bottom: '10%', right: '15%', width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button
            onClick={() => navigate('/results')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155',
              padding: '10px 18px', borderRadius: '12px', cursor: 'pointer',
              fontWeight: '600', fontSize: '0.95rem',
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#334155'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e)  => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = '#cbd5e1'; }}
          >
            <ChevronLeft size={18} /> Back to Results
          </button>

          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)',
              padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', color: '#38bdf8',
            }}
          >
            <Compass size={16} /> 6th Standard Science Explorer
          </div>
        </div>

        {/* Hero banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)',
            borderRadius: '24px',
            border: '1px solid rgba(56,189,248,0.25)',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5), 0 0 20px rgba(56,189,248,0.1)',
            padding: '2.5rem 2rem',
            marginBottom: '2.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'linear-gradient(90deg, #38bdf8 0%, #a855f7 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  fontWeight: '800', fontSize: '0.9rem', letterSpacing: '1px',
                  textTransform: 'uppercase', marginBottom: '8px',
                }}
              >
                <Sparkles size={16} color="#38bdf8" /> Spatial Intelligence Learning Hub
              </div>
              <h1 style={{ fontSize: '2.3rem', fontWeight: '800', color: '#ffffff', margin: '0 0 0.6rem 0', letterSpacing: '-0.5px' }}>
                The Explorer's Lab 
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '1.05rem', margin: 0, maxWidth: '680px', lineHeight: '1.5' }}>
                Search any topic from your 6th Standard science textbook and discover the best informative educational videos — in <strong style={{ color: '#f59e0b' }}>Tamil</strong> and <strong style={{ color: '#38bdf8' }}>English</strong>, ranked by most views!
              </p>
            </div>

            <div
              style={{
                background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(168,85,247,0.4)',
                borderRadius: '20px', padding: '1rem 1.4rem',
                display: 'flex', alignItems: 'center', gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '46px', height: '46px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Award size={24} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: '700', textTransform: 'uppercase' }}>STUDENT BADGE</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#ffffff' }}>Spatial Master  Level 2</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Hub */}
        <div
          style={{
            background: '#151c2c', borderRadius: '20px', border: '1px solid #28354e',
            padding: '2rem', marginBottom: '2.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f8fafc', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={22} color="#38bdf8" /> 6th Standard Science Search Hub
          </h2>

          {/* Search input */}
          <div style={{ position: 'relative', maxWidth: '780px', margin: '0 auto 1.5rem auto' }}>
            <input
              type="text"
              value={searchTopic}
              onChange={(e) => setSearchTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search any 6th Standard topic (e.g., Plant Habitats, Electricity, Water Cycle)..."
              style={{
                width: '100%', backgroundColor: '#0f172a', color: '#ffffff',
                border: '2px solid #334155', borderRadius: '16px',
                padding: '16px 130px 16px 52px', fontSize: '1.02rem',
                outline: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
              onBlur={(e)  => (e.target.style.borderColor = '#334155')}
            />
            <Search size={22} color="#94a3b8" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)' }} />
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                color: '#ffffff', border: 'none', borderRadius: '12px',
                padding: '10px 22px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Search '}
            </button>
          </div>

          {/* Quick chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
            {filterChips.map((chip, idx) => {
              const IconComp = chip.icon;
              return (
                <button
                  key={idx}
                  onClick={() => { setSearchTopic(chip.query); handleSearch(chip.query); }}
                  style={{
                    backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
                    borderRadius: '30px', padding: '8px 16px', fontSize: '0.88rem',
                    fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.backgroundColor = 'rgba(56,189,248,0.15)'; }}
                  onMouseOut={(e)  => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.backgroundColor = '#1e293b'; }}
                >
                  <IconComp size={15} color="#38bdf8" /> {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Results area ─────────────────────────────────────────────────── */}
        {!hasSearched ? (
          /* Initial empty state */
          <div
            style={{
              textAlign: 'center', padding: '4rem 2rem',
              background: '#151c2c', borderRadius: '24px',
              border: '2px dashed #28354e', marginBottom: '2.5rem',
            }}
          >
            <div
              style={{
                width: '70px', height: '70px', borderRadius: '50%',
                background: 'rgba(56,189,248,0.1)', color: '#38bdf8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem auto',
              }}
            >
              <Globe size={36} />
            </div>
            <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '0.5rem', fontWeight: '700' }}>
              Explore 6th Standard Science in Tamil & English
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '1.02rem', maxWidth: '520px', margin: '0 auto', lineHeight: '1.5' }}>
              Type any textbook topic above (like <strong>Plant Habitats</strong>, <strong>Human Body</strong>, or <strong>Electricity</strong>) to discover the top informative educational videos ranked by views!
            </p>
          </div>
        ) : (
          <div>
            {/* Filter tabs + result count */}
            <div
              style={{
                display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '1.8rem',
                background: '#151c2c', padding: '1.2rem 1.6rem',
                borderRadius: '18px', border: '1px solid #28354e',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                  <Sparkles size={22} color="#a855f7" /> Results for "{searchedTopic}"
                </h2>
                <span style={{ fontSize: '0.88rem', color: '#38bdf8', fontWeight: '600' }}>
                  {countTamil} Tamil · {countEnglish} English · {countAll} Total
                </span>
              </div>

              {/* Language tabs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1rem' }}>
                <button
                  onClick={() => setActiveFilter('ALL')}
                  style={activeFilter === 'ALL' ? tabActive('#6366f1') : tabInactive()}
                >
                   All Videos ({countAll})
                </button>
                <button
                  onClick={() => setActiveFilter('Tamil')}
                  style={activeFilter === 'Tamil' ? tabActive('#f59e0b') : tabInactive()}
                >
                   Tamil ({countTamil})
                </button>
                <button
                  onClick={() => setActiveFilter('English')}
                  style={activeFilter === 'English' ? tabActive('#38bdf8') : tabInactive()}
                >
                   English ({countEnglish})
                </button>
              </div>
            </div>

            {/* Loading state */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#151c2c', borderRadius: '20px', border: '1px solid #28354e' }}>
                <Loader2 size={44} color="#38bdf8" style={{ animation: 'spin 1s linear infinite' }} />
                <h3 style={{ color: '#ffffff', marginTop: '1.2rem', fontSize: '1.2rem' }}>
                  Finding Best Educational Videos...
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                  Searching Tamil & English YouTube videos and ranking by views for "{searchedTopic}"
                </p>
              </div>

            ) : error ? (
              /* Error state */
              <div
                style={{
                  textAlign: 'center', padding: '3.5rem 2rem',
                  background: 'rgba(239,68,68,0.08)', borderRadius: '20px',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}
              >
                <AlertCircle size={44} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
                <h3 style={{ color: '#fca5a5', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Unable to Load Videos</h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                  {error}
                </p>
                <button
                  onClick={() => handleSearch(searchedTopic)}
                  style={{
                    background: '#ef4444', color: '#ffffff', border: 'none',
                    padding: '10px 22px', borderRadius: '12px', fontWeight: '700',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <RefreshCw size={16} /> Try Again
                </button>
              </div>

            ) : filteredVideos.length === 0 ? (
              /* No results for this filter */
              <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#151c2c', borderRadius: '20px', color: '#94a3b8' }}>
                <h3 style={{ color: '#ffffff', fontSize: '1.15rem', marginBottom: '0.5rem' }}>
                  No videos found under "{activeFilter}"
                </h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem' }}>
                  {allVideos.length > 0
                    ? `Try "All Videos" to see the ${allVideos.length} other available videos.`
                    : 'No relevant educational videos found. Try another search topic!'}
                </p>
                {allVideos.length > 0 && (
                  <button
                    onClick={() => setActiveFilter('ALL')}
                    style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    View All Videos ({allVideos.length})
                  </button>
                )}
              </div>

            ) : (
              /* Video cards */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2.5rem' }}>
                {filteredVideos.map((vid, i) => (
                  <VideoCard key={vid.video_id || i} vid={vid} index={i} />
                ))}
              </div>
            )}

            {/* End-of-results notice (when not loading and videos exist) */}
            {!loading && !error && filteredVideos.length > 0 && (
              <div style={{ textAlign: 'center', margin: '1.5rem 0 3rem 0' }}>
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    color: '#94a3b8', fontSize: '0.92rem', background: '#151c2c',
                    padding: '10px 20px', borderRadius: '20px', border: '1px solid #28354e',
                  }}
                >
                  ✓ Showing the top {filteredVideos.length} most-viewed {activeFilter === 'ALL' ? '' : activeFilter + ' '}videos for "{searchedTopic}"
                </div>
              </div>
            )}

            {/* Quiz section */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #151c2c 100%)',
                borderRadius: '24px', border: '2px solid #a855f7',
                padding: '2.5rem 2rem', boxShadow: '0 15px 35px rgba(168,85,247,0.15)',
                marginTop: '3rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#a855f7', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
                     Topic Knowledge Quiz
                  </div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ffffff', margin: '4px 0 0 0' }}>
                    Test Your Knowledge on {searchedTopic || 'Science'}
                  </h2>
                </div>
                {!quizStarted && (
                  <button
                    onClick={() => setQuizStarted(true)}
                    style={{
                      background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                      color: '#ffffff', border: 'none', padding: '12px 24px',
                      borderRadius: '14px', fontWeight: '800', fontSize: '1rem',
                      cursor: 'pointer', boxShadow: '0 4px 15px rgba(168,85,247,0.4)',
                    }}
                  >
                    Start Quiz Now 
                  </button>
                )}
              </div>

              {!quizStarted ? (
                <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.5' }}>
                  Finished watching the videos above? Test how well you understood <strong>{searchedTopic || 'this topic'}</strong> with these quick questions!
                </p>
              ) : quizSubmitted ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <h3 style={{ fontSize: '1.5rem', color: '#ffffff', marginBottom: '0.5rem' }}>Quiz Completed!</h3>
                  <div style={{ fontSize: '2rem', fontWeight: '900', color: '#38bdf8', marginBottom: '1rem' }}>
                    Score: {calculateQuizScore()} / {sampleQuizQuestions.length} ({Math.round((calculateQuizScore() / sampleQuizQuestions.length) * 100)}%)
                  </div>
                  <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Great job! Keep exploring more science topics.</p>
                  <button
                    onClick={() => { setQuizStarted(false); setQuizSubmitted(false); setSelectedAnswers({}); }}
                    style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Retake Quiz
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#a855f7', fontWeight: 'bold', marginBottom: '1rem' }}>
                    <span>Question {currentQuestionIndex + 1} of {sampleQuizQuestions.length}</span>
                    <span>Topic: {searchedTopic}</span>
                  </div>
                  <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #1e293b', marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '1.1rem', color: '#ffffff', margin: '0 0 1rem 0', fontWeight: '700' }}>
                      {sampleQuizQuestions[currentQuestionIndex].question}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sampleQuizQuestions[currentQuestionIndex].options.map((opt, oIdx) => (
                        <button
                          key={oIdx}
                          onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: oIdx }))}
                          style={{
                            textAlign: 'left',
                            backgroundColor: selectedAnswers[currentQuestionIndex] === oIdx ? 'rgba(168,85,247,0.25)' : '#1e293b',
                            border: `2px solid ${selectedAnswers[currentQuestionIndex] === oIdx ? '#a855f7' : '#334155'}`,
                            color: '#ffffff', padding: '12px 16px', borderRadius: '12px',
                            cursor: 'pointer', fontSize: '0.95rem',
                            fontWeight: selectedAnswers[currentQuestionIndex] === oIdx ? 'bold' : 'normal',
                          }}
                        >
                          {String.fromCharCode(65 + oIdx)}. {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                      style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', opacity: currentQuestionIndex === 0 ? 0.5 : 1 }}
                    >
                      Previous
                    </button>
                    {currentQuestionIndex < sampleQuizQuestions.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                        style={{ background: '#a855f7', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Next Question
                      </button>
                    ) : (
                      <button
                        onClick={() => setQuizSubmitted(true)}
                        style={{ background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Submit Quiz
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Video modal */}
      {activeVideo && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(11,15,25,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setActiveVideo(null); }}
        >
          <div
            style={{
              backgroundColor: '#151c2c', border: '1px solid #38bdf8',
              borderRadius: '24px', width: '100%', maxWidth: '850px',
              overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(56,189,248,0.25)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem 1.5rem', borderBottom: '1px solid #28354e' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: activeVideo.language === 'Tamil' ? '#f59e0b' : '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {activeVideo.language === 'Tamil' ? ' Tamil' : ' English'} · {activeVideo.channel_title}
                  {activeVideo.view_count && ` · ${activeVideo.view_count}`}
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', margin: '2px 0 0 0', paddingRight: '1rem' }}>
                  {activeVideo.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                style={{ backgroundColor: '#1e293b', border: 'none', color: '#cbd5e1', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Embedded player */}
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000' }}>
              <iframe
                src={`${activeVideo.embed_url}?autoplay=1`}
                title={activeVideo.title}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Modal footer */}
            <div style={{ padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0, lineHeight: '1.5', maxWidth: '600px' }}>
                {activeVideo.description}
              </p>
              <a
                href={`https://www.youtube.com/watch?v=${activeVideo.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#38bdf8', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
              >
                Open on YouTube <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
