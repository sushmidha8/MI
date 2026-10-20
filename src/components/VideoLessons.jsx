import { useEffect, useRef } from 'react';
import { ExternalLink, Play, Star, X } from 'lucide-react';

export function VideoCard({ video, onPlay, rating, onRate }) {
  return <article className="video-card">
    <button type="button" className="video-thumbnail" onClick={() => onPlay(video)} aria-label={`Watch ${video.title}`}>
      <img src={video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`} alt="" loading="lazy"
        onError={event => {
          const fallback = `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`;
          if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
        }} />
      <span className="video-play"><Play size={22} strokeWidth={1.5} /></span>
      {video.duration && <span className="video-duration">{video.duration}</span>}
    </button>
    <div className="video-meta">
      <span className="eyebrow">{video.language || 'English'} · {video.channel_title || 'Science lesson'}</span>
      <h3>{video.title}</h3>
      {onRate && <div className="ratings" role="group" aria-label={`Rate ${video.title}`}><span>Your rating</span>{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" onClick={() => onRate(video.video_id, star)} aria-label={`Rate ${star} out of 5`} aria-pressed={rating === star}><Star size={16} fill={rating >= star ? 'currentColor' : 'none'} strokeWidth={1.3} /></button>)}</div>}
      <div className="video-actions"><button className="btn secondary-btn" onClick={() => onPlay(video)}><Play size={13} /> Watch lesson</button><a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noreferrer" aria-label={`Open ${video.title} on YouTube`}><ExternalLink size={16} /></a></div>
    </div>
  </article>;
}

export function VideoModal({ video, onClose }) {
  const closeButton = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    previousFocus.current = document.activeElement;
    closeButton.current?.focus();
    return () => previousFocus.current?.focus();
  }, []);
  return <div className="video-modal" role="dialog" aria-modal="true" aria-labelledby="video-title" onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll('button, iframe, a[href]'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
    <div className="video-modal-panel">
      <div className="video-modal-heading"><h2 id="video-title">{video.title}</h2><button ref={closeButton} onClick={onClose} aria-label="Close video"><X size={21} /></button></div>
      <div className="video-frame"><iframe src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&rel=0`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
      <div className="video-modal-footer"><span>{video.channel_title} · {video.language}</span><a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noreferrer">Open on YouTube <ExternalLink size={13} /></a></div>
    </div>
  </div>;
}

export function VideoFilters({ active, onChange, tamilCount, englishCount }) {
  return <div className="segmented-control" role="group" aria-label="Video language">
    {[['ALL', 'All lessons', tamilCount + englishCount], ['English', 'English', englishCount], ['Tamil', 'தமிழ்', tamilCount]].map(([value, title, count]) => <button type="button" key={value} aria-pressed={active === value} onClick={() => onChange(value)}>{title} ({count})</button>)}
  </div>;
}
