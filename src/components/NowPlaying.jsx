import { useState, useEffect, useMemo, memo } from 'react';
import './NowPlaying.css';

const NowPlaying = memo(function NowPlaying() {
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchNowPlaying = async () => {
      try {
        const response = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=kxllswxch&api_key=f267c25a5476436b36dbfcb7dc93a540&format=json&limit=1`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch track data');
        }

        const data = await response.json();

        if (data.recenttracks && data.recenttracks.track && data.recenttracks.track.length > 0) {
          const currentTrack = data.recenttracks.track[0];
          const isNowPlaying = currentTrack['@attr'] && currentTrack['@attr'].nowplaying === 'true';

          setTrack({
            name: currentTrack.name,
            artist: currentTrack.artist['#text'],
            album: currentTrack.album['#text'],
            image: currentTrack.image[2]['#text'],
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
    const interval = setInterval(fetchNowPlaying, 30000);
    return () => clearInterval(interval);
  }, []);

  // Memoize the transform style to prevent recalculation
  const imageStyle = useMemo(() => ({
    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
    transition: 'transform 0.3s ease'
  }), [isHovered]);

  if (loading) {
    return (
      <div className="now-playing">
        <div className="now-playing-content loading-crazy">
          <span className="glitch-text">Loading music...</span>
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="now-playing">
        <div className="now-playing-content">
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
          <div className="track-image" style={imageStyle}>
            <img src={track.image} alt={`${track.artist} - ${track.name}`} loading="lazy" />
            {track.isNowPlaying && (
              <div className="vinyl-effect"></div>
            )}
          </div>
          <div className="track-meta">
            <div className="track-name glitch-text-subtle">{track.name}</div>
            <div className="track-artist">{track.artist}</div>
          </div>
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
              {[...Array(6)].map((_, i) => (
                <div key={i} className="particle" style={{ animationDelay: `${i * 0.2}s` }}></div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default NowPlaying;
