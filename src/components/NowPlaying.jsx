import React, { useState, useEffect } from 'react';

function NowPlaying() {
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div className="now-playing">
        <div className="now-playing-content">
          <div className="music-icon">♫</div>
          <span>Loading music...</span>
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
    <div className="now-playing">
      <div className="now-playing-card">
        <div className="now-playing-header">
          <div className="track-image">
            <img src={track.image} alt={`${track.artist} - ${track.name}`} />
          </div>
          <div className="track-meta">
            <div className="track-name">{track.name}</div>
            <div className="track-artist">{track.artist}</div>
          </div>
          <div className="music-icon">♫</div>
        </div>
        <div className="now-playing-body">
          <div className="track-album">{track.album}</div>
          <div className="track-status">
            {track.isNowPlaying ? 'Now Playing' : 'Last Played'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NowPlaying;
