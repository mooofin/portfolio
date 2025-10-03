import React from 'react';

export default function VideoBackground({ src = '/images/video/blg.mp4', poster }) {
  return (
    <div className="video-background">
      <video
        className="video-background-media"
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
      />
    </div>
  );
}


