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
              src="/images/about-me/PFP400x400.jpg" 
              alt="Profile" 
              className="hero-pfp"
            />
          </div>
          <div className="hero-sticky-text">
            <div>Southern Gothic Salvation<br/>NixOS Witch<br/><br/>Loves NixOS and Gentoo, and I enjoy declarative, functional programming using Nix</div>
          </div>
        </div>
        
        <div className="github-card">
          <a href="https://github.com/mooofin" target="_blank" rel="noopener noreferrer" className="github-link">
            <img src="/stuff/234.png" alt="GitHub" />
            <span>GitHub</span>
          </a>
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
