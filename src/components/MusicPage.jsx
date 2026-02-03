import { useState, useEffect, useMemo, useCallback, memo } from 'react';

// Memoized album card component
const AlbumCard = memo(({ album, index, hoveredAlbum, setHoveredAlbum }) => (
  <a
    href={album.url}
    target="_blank"
    rel="noopener noreferrer"
    className="album-card"
    onMouseEnter={() => setHoveredAlbum(index)}
    onMouseLeave={() => setHoveredAlbum(null)}
    style={{
      animationDelay: `${index * 0.1}s`
    }}
  >
    <div className="album-rank">{index + 1}</div>
    <div className="album-glow" style={{
      opacity: hoveredAlbum === index ? 1 : 0
    }}></div>
    <div className="album-image">
      <img
        src={album.image[3]['#text'] || album.image[2]['#text']}
        alt={`${album.artist.name} - ${album.name}`}
        loading="lazy"
      />
      <div className="album-overlay">
        <span className="play-icon">▶</span>
      </div>
    </div>
    <div className="album-info">
      <div className="album-name">{album.name}</div>
      <div className="album-artist">{album.artist.name}</div>
      <div className="album-playcount">
        {album.playcount} plays
      </div>
    </div>
  </a>
));
AlbumCard.displayName = 'AlbumCard';

// Memoized track item component
const TrackItem = memo(({ track, index }) => {
  const isNowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';

  return (
    <div
      className={`track-item ${isNowPlaying ? 'now-playing' : ''}`}
      style={{
        animationDelay: `${index * 0.05}s`
      }}
    >
      <div className="track-image">
        <img
          src={track.image[1]['#text']}
          alt={`${track.artist['#text']} - ${track.name}`}
          loading="lazy"
        />
        {isNowPlaying && (
          <div className="now-playing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
      <div className="track-info">
        <div className="track-name">{track.name}</div>
        <div className="track-artist">{track.artist['#text']}</div>
      </div>
      {isNowPlaying && (
        <div className="status-badge">
          <span className="pulse-dot"></span>
          Now Playing
        </div>
      )}
    </div>
  );
});
TrackItem.displayName = 'TrackItem';

function MusicPage() {
  const [topAlbums, setTopAlbums] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [hoveredAlbum, setHoveredAlbum] = useState(null);
  const [timePeriod, setTimePeriod] = useState('overall');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchTopAlbums = async () => {
      setLoadingAlbums(true);
      try {
        const response = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=kxllswxch&api_key=f267c25a5476436b36dbfcb7dc93a540&format=json&limit=12&period=${timePeriod}`
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

    const fetchUserStats = async () => {
      try {
        const response = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=kxllswxch&api_key=f267c25a5476436b36dbfcb7dc93a540&format=json`
        );
        const data = await response.json();
        if (data.user) {
          setStats(data.user);
        }
      } catch (err) {
        console.error('Error fetching user stats:', err);
      }
    };

    fetchTopAlbums();
    fetchRecentTracks();
    fetchUserStats();
  }, [timePeriod]);

  // Memoize filtered albums to prevent recalculation on every render
  const filteredAlbums = useMemo(() =>
    topAlbums.filter(album =>
      album.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.artist.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [topAlbums, searchQuery]
  );

  // Memoize total plays calculation
  const totalPlays = useMemo(() =>
    topAlbums.reduce((sum, album) => sum + parseInt(album.playcount), 0),
    [topAlbums]
  );

  // Memoize callbacks
  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleTimePeriodChange = useCallback((period) => {
    setTimePeriod(period);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  return (
    <main className="music-page">
      <div className="music-hero-image">
        <img
          src="/music_page_banner.jpg"
          alt="Music vibes"
          loading="eager"
        />
        <div className="hero-overlay"></div>
      </div>

      <div className="music-page-header">
        <a href="/" className="back-link">Back to Home</a>
        <h1 className="glitch-title" data-text="Music Space">Music Space</h1>
        <div className="music-visualizer">
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </div>
      </div>

      <div className="music-page-content">
        {stats && (
          <section className="stats-section">
            <div className="stat-card">
              <div className="stat-value">{parseInt(stats.playcount).toLocaleString()}</div>
              <div className="stat-label">Total Scrobbles</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalPlays.toLocaleString()}</div>
              <div className="stat-label">Top 12 Plays</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{parseInt(stats.artist_count).toLocaleString()}</div>
              <div className="stat-label">Artists</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{parseInt(stats.album_count).toLocaleString()}</div>
              <div className="stat-label">Albums</div>
            </div>
          </section>
        )}

        <section className="music-section">
          <div className="section-header">
            <div>
              <h2>Most Played Albums</h2>
              <p className="section-subtitle">My favorite albums of all time</p>
            </div>
            <div className="section-controls">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search albums..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="search-input"
                />
              </div>
              <div className="time-period-selector">
                <button
                  className={timePeriod === '7day' ? 'active' : ''}
                  onClick={() => handleTimePeriodChange('7day')}
                >
                  Week
                </button>
                <button
                  className={timePeriod === '1month' ? 'active' : ''}
                  onClick={() => handleTimePeriodChange('1month')}
                >
                  Month
                </button>
                <button
                  className={timePeriod === '3month' ? 'active' : ''}
                  onClick={() => handleTimePeriodChange('3month')}
                >
                  3 Months
                </button>
                <button
                  className={timePeriod === 'overall' ? 'active' : ''}
                  onClick={() => handleTimePeriodChange('overall')}
                >
                  All Time
                </button>
              </div>
              <div className="view-toggle">
                <button
                  className={viewMode === 'grid' ? 'active' : ''}
                  onClick={() => handleViewModeChange('grid')}
                  title="Grid View"
                >
                  ⊞
                </button>
                <button
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => handleViewModeChange('list')}
                  title="List View"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {loadingAlbums ? (
            <div className="music-loading">
              <div className="spinner"></div>
              <p>Loading albums...</p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'albums-grid' : 'albums-list'}>
              {filteredAlbums.map((album, index) => (
                <AlbumCard
                  key={`${album.name}-${index}`}
                  album={album}
                  index={index}
                  hoveredAlbum={hoveredAlbum}
                  setHoveredAlbum={setHoveredAlbum}
                />
              ))}
            </div>
          )}
        </section>

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
              {recentTracks.map((track, index) => (
                <TrackItem
                  key={`${track.name}-${index}`}
                  track={track}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default MusicPage;
