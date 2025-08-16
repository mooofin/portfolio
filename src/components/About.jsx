import React from 'react';

function About() {
  return (
    <section id="about" className="about-section">
      <div className="about-content">
        <h2>About Me</h2>
        <p>
          I'm a technical-minded mod developer with a deep passion for reverse engineering game engines to understand and manipulate their inner workings. My focus lies in dissecting and enhancing game mechanics, particularly within systems built on the Havok physics engine.
        </p>
        <h3>My Skills</h3>
        <div className="skills-grid">
          <div className="skill-item">Mod Development</div>
          <div className="skill-item">Reverse Engineering</div>
          <div className="skill-item">Havok Engine</div>
          <div className="skill-item">C++ / Assembly</div>
          <div className="skill-item">Cheat Engine</div>
          <div className="skill-item">Memory Editing</div>
        </div>
      </div>
    </section>
  );
}