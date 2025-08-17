import React from 'react';

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-content">
        <img 
          src="https://github.com/mooofin.png" 
          alt="GitHub Profile" 
          className="hero-pfp"
        />
        <h1>Hi, I'm siddharth</h1>
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
