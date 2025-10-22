import React from 'react';
import NowPlaying from './NowPlaying';

function Hero() {
  return (
    <section id="home" className="hero hero-left-sticky">
      <div className="pink-sticky hero-sticky">
        <div className="hero-pfp-row">
          <img 
            src="/images/icons/icon.jpg" 
            alt="Profile" 
            className="hero-pfp"
          />
        </div>
        <div className="hero-sticky-text">
          <div>NixOS witch<br/>LLVM enthusiast</div>
        </div>
      </div>
      <div className="pink-sticky github-sticky">
        <a href="https://github.com/mooofin" target="_blank" rel="noopener noreferrer" className="github-link">My GitHub</a>
      </div>
      <div className="pink-sticky spotify-sticky">
        <NowPlaying />
      </div>
    </section>
  );
}

export default Hero;
