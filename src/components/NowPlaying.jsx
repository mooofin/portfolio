import React, { useState, useEffect } from 'react';
import './NowPlaying.css';

function NowPlaying() {
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const fetchNowPlaying = async () => {
      try {
        // Using Last.fm API to get recent tracks
        const response = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=kxllswxch&api_key=f267c25a5476436b36dbfcb7dc93a540&format=json&limit=1`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch track data');
        }

        const data = await response.json();

        if (data.recenttracks && data.recenttracks.track && data.recenttracks.track.length > 0) {
          const currentTrack = data.recenttracks.track[0];

          // Check if track is currently playing (has @attr.nowplaying)
          const isNowPlaying = currentTrack['@attr'] && currentTrack['@attr'].nowplaying === 'true';

          // Always show the track - either currently playing or last played
          setTrack({
            name: currentTrack.name,
            artist: currentTrack.artist['#text'],
            album: currentTrack.album['#text'],
            image: currentTrack.image[2]['#text'], // Medium size image
            url: currentTrack.url,
            isNowPlaying: isNowPlaying
          });
        }
      } catch (err) {
        console.error('Error fetching now playing:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNowPlaying();

    // Refresh every 30 seconds
    const interval = setInterval(fetchNowPlaying, 30000);

    return () => clearInterval(interval);
  }, []);

  // Crazy pulsing effect
  useEffect(() => {
    if (track?.isNowPlaying) {
      const pulseInterval = setInterval(() => {
        setPulseIntensity(prev => prev === 1 ? 1.15 : 1);
      }, 600);
      return () => clearInterval(pulseInterval);
    }
  }, [track?.isNowPlaying]);

  // Spinning album art
  useEffect(() => {
    if (track?.isNowPlaying) {
      const rotateInterval = setInterval(() => {
        setRotation(prev => (prev + 1) % 360);
      }, 50);
      return () => clearInterval(rotateInterval);
    } else {
      setRotation(0);
    }
  }, [track?.isNowPlaying]);

  if (loading) {
    return (
      <div className="now-playing">
        <div className="now-playing-content loading-crazy">
          <div className="music-icon spinning-icon">♫</div>
          <span className="glitch-text">Loading music...</span>
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="now-playing">
        <div className="now-playing-content">
          <div className="music-icon">♫</div>
          <span>No recent tracks</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`now-playing ${track.isNowPlaying ? 'now-playing-active' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="now-playing-card crazy-card">
        <div className="now-playing-header">
          <div 
            className="track-image" 
            style={{ 
              transform: `rotate(${rotation}deg) scale(${isHovered ? 1.1 : pulseIntensity})`,
              transition: isHovered ? 'transform 0.3s ease' : 'transform 0.1s ease'
            }}
          >
            <img src={track.image} alt={`${track.artist} - ${track.name}`} />
            {track.isNowPlaying && (
              <div className="vinyl-effect"></div>
            )}
          </div>
          <div className="track-meta">
            <div className="track-name glitch-text-subtle">{track.name}</div>
            <div className="track-artist">{track.artist}</div>
          </div>
          <div className={`music-icon ${track.isNowPlaying ? 'music-icon-active' : ''}`}>♫</div>
        </div>
        <div className="now-playing-body">
          <div className="track-album">{track.album}</div>
          <div className={`track-status ${track.isNowPlaying ? 'status-active' : ''}`}>
            {track.isNowPlaying ? (
              <>
                <span className="status-dot"></span>
                <span className="status-text">NOW PLAYING</span>
              </>
            ) : (
              'Last Played'
            )}
          </div>
        </div>
        {track.isNowPlaying && (
          <>
            <div className="sound-wave">
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
            </div>
            <div className="particle-container">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="particle" style={{ animationDelay: `${i * 0.2}s` }}></div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default NowPlaying;
