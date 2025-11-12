import React from 'react';
import NowPlaying from './NowPlaying';
import DesktopIcons from './DesktopIcons';

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-left-side">
        <div className="pink-sticky hero-sticky">
          <div className="hero-pfp-row">
            <img 
              src="/images/screenshot-1755421557.png" 
              alt="Profile" 
              className="hero-pfp"
            />
          </div>
          <div className="hero-sticky-text">
            <div>Southern Gothic Salvation<br/>NixOS Witch</div>
          </div>
        </div>
      </div>
      
      <div className="hero-right-side">
        <div className="pink-sticky spotify-sticky">
          <NowPlaying />
        </div>
        <DesktopIcons />
      </div>
    </section>
  );
}

export default Hero;
