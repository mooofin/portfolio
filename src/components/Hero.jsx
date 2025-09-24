import React from 'react';

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-content electric-border">
        <div className="electric-border-bg"></div>
        <img 
          src="/images/icons/blogicon.gif" 
          alt="Profile" 
          className="hero-pfp"
        />
        <h1 className="electric-text">Hi, I'm siddharth</h1>
        <p>
          A Mod Developer & Reverse Engineer specializing in game mechanics and physics.<br/>
          NixOS witch.<br/>
          Lighting engines with Havok. LLVM enthusiast.
        </p>
        <a 
          href="https://github.com/mooofin" 
          className="cta-button electric-border-small" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <div className="electric-border-bg-small"></div>
          <span>View My GitHub</span>
        </a>
      </div>
    </section>
  );
}

export default Hero;
