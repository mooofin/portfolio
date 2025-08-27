import React, { useMemo, useState, useCallback } from 'react';
import GlassIcons from './GlassIcons';

function About() {
  const baseSkills = useMemo(() => ([
    'Mod Development',
    'Reverse Engineering',
    'Havok Engine',
    'Assembly',
    'Cheat Engine',
    'Memory Editing',
  ]), []);

  const [skills, setSkills] = useState(baseSkills);

  const shuffleSkills = useCallback(() => {
    setSkills(prev => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  }, []);

  return (
    <section id="about" className="about-section">
      <div className="about-content">
        <h2>About Me</h2>
        <p>
          Huge soulsborne nerd and  mod developer with a deep passion for reverse engineering game engines to understand and manipulate their inner workings. My focus lies in dissecting and enhancing game mechanics, particularly within systems built on the Havok physics engine :)
        </p>
        <h3>My Skills</h3>
        <div className="skills-container" onClick={shuffleSkills} title="Click to shuffle">
          <GlassIcons skills={skills} />
        </div>
      </div>
    </section>
  );
}

export default About;
