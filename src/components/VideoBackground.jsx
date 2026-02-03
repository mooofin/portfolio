import { useState, useRef, memo, useCallback, useEffect } from 'react';

const VideoBackground = memo(function VideoBackground({ poster }) {
  const [currentVideo, setCurrentVideo] = useState('/images/video/blg.mp4');
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const videos = [
    '/images/video/blg.mp4',
    '/images/video/bg1.mp4'
  ];

  const toggleVideo = useCallback(() => {
    setCurrentVideo(prev => {
      const currentIndex = videos.indexOf(prev);
      const nextIndex = (currentIndex + 1) % videos.length;
      return videos[nextIndex];
    });
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      // Make it play faster!
      videoRef.current.playbackRate = 1.5;
      videoRef.current.play().catch(error => {
        console.error("Video autoplay failed:", error);
      });
    }
  }, [currentVideo]);

  return (
    <>
      <div className="video-background">
        <video
          ref={videoRef}
          key={currentVideo}
          className="video-background-media"
          src={currentVideo}
          poster={poster}
          autoPlay
          muted={isMuted}
          loop
          playsInline
          preload="metadata"
        />
      </div>
      <div className="video-controls">
        <button
          className="video-toggle-btn"
          onClick={toggleVideo}
          aria-label="Toggle background video"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </button>
        <button
          className="video-toggle-btn video-sound-btn"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
        >
          {isMuted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
});

export default VideoBackground;
