import React from 'react';
import NowPlaying from './NowPlaying';

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-left-side">
        <div className="pink-sticky hero-sticky">
          <div className="hero-pfp-row">
            <img 
              src="/images/icons/icon.jpg" 
              alt="Profile" 
              className="hero-pfp"
            />
          </div>
          <div className="hero-sticky-text">
            <div>Sid<br/>NixOS</div>
          </div>
        </div>
      </div>
      
      <div className="hero-right-side">
        <div className="pink-sticky spotify-sticky">
          <NowPlaying />
        </div>
      </div>
    </section>
  );
}

export default Hero;
