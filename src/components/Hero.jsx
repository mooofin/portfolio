import React from 'react';

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-content">
        <h1>Hi, I'm mooofin</h1>
        <p>A Mod Developer & Reverse Engineer specializing in game mechanics and physics.</p>
        <a 
          href="https://github.com/mooofin" 
          className="cta-button" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          View My GitHub
        </a>
      </div>
    </section>
  );
}

export default Hero;
