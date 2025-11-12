import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function MusicPage() {
  const [topAlbums, setTopAlbums] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(true);

  useEffect(() => {
    const fetchTopAlbums = async () => {
      try {
        const response = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=kxllswxch&api_key=f267c25a5476436b36dbfcb7dc93a540&format=json&limit=12&period=overall`
        );
        const data = await response.json();
        
        if (data.topalbums && data.topalbums.album) {
          setTopAlbums(data.topalbums.album);
        }
      } catch (err) {
        console.error('Error fetching top albums:', err);
      } finally {
        setLoadingAlbums(false);
      }
    };

    const fetchRecentTracks = async () => {
      try {
        const response = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=kxllswxch&api_key=f267c25a5476436b36dbfcb7dc93a540&format=json&limit=10`
        );
        const data = await response.json();
        
        if (data.recenttracks && data.recenttracks.track) {
          setRecentTracks(data.recenttracks.track);
        }
      } catch (err) {
        console.error('Error fetching recent tracks:', err);
      } finally {
        setLoadingTracks(false);
      }
    };

    fetchTopAlbums();
    fetchRecentTracks();
  }, []);

  return (
    <main className="music-page">
      <div className="music-page-header">
        <Link to="/" className="back-link">Back to Home</Link>
        <h1>Music Space</h1>
      </div>
      
      <div className="music-page-content">
        {/* Top Albums Section */}
        <section className="music-section">
          <h2>Most Played Albums</h2>
          <p className="section-subtitle">My favorite albums of all time</p>
          
          {loadingAlbums ? (
            <div className="music-loading">
              <div className="spinner"></div>
              <p>Loading albums...</p>
            </div>
          ) : (
            <div className="albums-grid">
              {topAlbums.map((album, index) => (
                <a 
                  key={index} 
                  href={album.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="album-card"
                >
                  <div className="album-rank">{index + 1}</div>
                  <div className="album-image">
                    <img 
                      src={album.image[3]['#text'] || album.image[2]['#text']} 
                      alt={`${album.artist.name} - ${album.name}`}
                    />
                  </div>
                  <div className="album-info">
                    <div className="album-name">{album.name}</div>
                    <div className="album-artist">{album.artist.name}</div>
                    <div className="album-playcount">{album.playcount} plays</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Recent Tracks Section */}
        <section className="music-section">
          <h2>Recently Played</h2>
          <p className="section-subtitle">Latest tracks from Last.fm</p>
          
          {loadingTracks ? (
            <div className="music-loading">
              <div className="spinner"></div>
              <p>Loading tracks...</p>
            </div>
          ) : (
            <div className="tracks-list">
              {recentTracks.map((track, index) => {
                const isNowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
                return (
                  <div key={index} className={`track-item ${isNowPlaying ? 'now-playing' : ''}`}>
                    <div className="track-image">
                      <img 
                        src={track.image[1]['#text']} 
                        alt={`${track.artist['#text']} - ${track.name}`}
                      />
                      {isNowPlaying && <div className="now-playing-indicator"></div>}
                    </div>
                    <div className="track-info">
                      <div className="track-name">{track.name}</div>
                      <div className="track-artist">{track.artist['#text']}</div>
                    </div>
                    {isNowPlaying && <div className="status-badge">Now Playing</div>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default MusicPage;
