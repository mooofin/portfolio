import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
  const [decryptedText, setDecryptedText] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);

  const originalText = "Huge soulsborne nerd and mod developer with a deep passion for reverse engineering game engines to understand and manipulate their inner workings. My focus lies in dissecting and enhancing game mechanics, particularly within systems built on the Havok physics engine :)";

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

  const decryptText = useCallback(() => {
    setIsDecrypting(true);
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < originalText.length) {
        // Add random characters for scrambling effect
        const scrambled = originalText.slice(0, currentIndex) +
          characters.charAt(Math.floor(Math.random() * characters.length));
        setDecryptedText(scrambled);
        currentIndex++;
      } else {
        setDecryptedText(originalText);
        setIsDecrypting(false);
        clearInterval(interval);
      }
    }, 50);
  }, [originalText]);

  useEffect(() => {
    // Start decryption when component mounts
    const timer = setTimeout(decryptText, 1000);
    return () => clearTimeout(timer);
  }, [decryptText]);

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
        <p className="decrypted-text">
          <span className="decrypted-content">{decryptedText}</span>
          {isDecrypting && <span className="cursor">|</span>}
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
