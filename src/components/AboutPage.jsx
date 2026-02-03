import React, { useMemo, useState, useCallback, useEffect } from 'react';
import GlassIcons from './GlassIcons';

function AboutPage() {
  const baseSkills = useMemo(() => ([
    'Mod Development',
    'Reverse Engineering',
    'Havok Engine',
    'Cheat Engine',
    'Memory Editing',
  ]), []);

  const [skills, setSkills] = useState(baseSkills);
  const [decryptedText, setDecryptedText] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const originalText = "For the past few years, I've been working on a Dark Souls project by making an entirely new DLC with new areas (The models being the un-used assets from Bloodborne and Dark Souls 2 cut content), NPC's questlines, weapons, spells and overall a vision to bring back the rushed development lifecycle that FromSoftware followed, in order to make up for the 2nd half of Dark Souls. Some of my other modding projects include a lighting system for PTDE edition Dark Souls and more.";

  // Cool ideas for different sections you can add:
  const additionalSections = {
    philosophy: "I believe in the beauty of declarative systems and the elegance of functional programming. NixOS and Gentoo aren't just distros—they're philosophies of control, reproducibility, and understanding your system from the ground up.",

    interests: "When I'm not reverse engineering game engines or crafting Nix configurations, you'll find me exploring the intersection of gothic aesthetics and modern technology, or diving deep into memory editing and low-level systems.",

    currentProjects: [
      "🎮 Dark Souls DLC expansion with cut content restoration",
      "💡 Custom lighting system for PTDE Dark Souls",
      "🔧 NixOS configuration experiments",
      "🎯 Reverse engineering Havok Engine implementations"
    ],

    techStack: [
      "Languages: Nix, C/C++, Assembly, Python, JavaScript/TypeScript",
      "Tools: Cheat Engine, IDA Pro, Ghidra, Visual Studio",
      "Systems: NixOS, Gentoo, Linux kernel customization",
      "Game Engines: Havok Physics, FromSoftware's engine (Dark Souls)"
    ],

    aesthetic: "Southern Gothic meets Cyberpunk - where tradition meets rebellion, where declarative code meets chaos theory.",
  };

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

  const decryptText = useCallback(() => {
    setIsDecrypting(true);
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < originalText.length) {
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
  }, [originalText, characters]);

  useEffect(() => {
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

  const openImage = (imageSrc) => {
    setSelectedImage(imageSrc);
  };

  const closeImage = () => {
    setSelectedImage(null);
  };

  return (
    <main className="about-page">
      <div className="about-page-header">
        <a href="/" className="back-link">← Back to Home</a>
        <h1>About Me</h1>
      </div>

      <div className="about-page-content">
        <div className="about-intro-card">
          <p className="decrypted-text">
            <span className="decrypted-content">{decryptedText}</span>
            {isDecrypting && <span className="cursor">|</span>}
          </p>
        </div>

        <div className="project-section">
          <h2>Project Gallery</h2>

          <div className="project-gallery">
            <img
              src="/images/about-me/G5Z0Io6boAIC3uo.jpg"
              alt="Dark Souls mod screenshot 1"
              onClick={() => openImage("/images/about-me/G5Z0Io6boAIC3uo.jpg")}
            />
            <img
              src="/images/about-me/G5ZxtlcbsAADX1Z.jpg"
              alt="Dark Souls mod screenshot 2"
              onClick={() => openImage("/images/about-me/G5ZxtlcbsAADX1Z.jpg")}
            />
            <img
              src="/images/about-me/G5Zz4PGawAAh_cf.jpg"
              alt="Dark Souls mod screenshot 3"
              onClick={() => openImage("/images/about-me/G5Zz4PGawAAh_cf.jpg")}
            />
            <img
              src="/images/about-me/G5ZzZ9ya4AAkoGd.jpg"
              alt="Dark Souls mod screenshot 4"
              onClick={() => openImage("/images/about-me/G5ZzZ9ya4AAkoGd.jpg")}
            />
          </div>
        </div>

        <div className="skills-section">
          <h2>My Skills</h2>
          <p className="skills-hint">Click to shuffle!</p>
          <div className="skills-container" onClick={shuffleSkills} title="Click to shuffle">
            <GlassIcons skills={skills} />
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="image-modal" onClick={closeImage}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={closeImage}>×</button>
            <img src={selectedImage} alt="Full size screenshot" />
          </div>
        </div>
      )}
    </main>
  );
}

export default AboutPage;
