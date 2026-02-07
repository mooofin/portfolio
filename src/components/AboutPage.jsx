import React, { useMemo, useState, useCallback, useEffect } from 'react';
import GlassIcons from './GlassIcons';

function AboutPage() {
  const [decryptedText, setDecryptedText] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const originalText = "For the past few years, I've been working on an entirely new Dark Souls DLC featuring new areas (using unused assets from Bloodborne and Dark Souls 2 cut content), original NPC questlines, weapons, spells, and a vision focused on restoring the spark lost during the rushed second half of the original game. I've also implemented a custom lighting documentation system for the PTDE edition.";

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
    }, 20);
  }, [originalText]);

  useEffect(() => {
    const timer = setTimeout(decryptText, 500);
    return () => clearTimeout(timer);
  }, [decryptText]);

  const openImage = (imageSrc) => {
    setSelectedImage(imageSrc);
  };

  const closeImage = () => {
    setSelectedImage(null);
  };

  const repositories = [
    { title: "Honeymoon", desc: "An Emacs-inspired C++20 terminal editor. No Lisp. No bloat.", img: "/images/about-me/github/honeymoon.gif", link: "https://github.com/mooofin/honeymoon", full: true },
    { title: "nix-dotfiles", desc: "NixOS setup with Niri + Hyprland, Quickshell and Home-manager", img: "/images/about-me/github/nix-dotfiles.gif", link: "https://github.com/mooofin/nix-dotfiles" },
    { title: "Portfolio Website", desc: "Personal portfolio & blogs", img: "/images/about-me/github/portfolio.gif", link: "https://github.com/mooofin/portfolio" },
    { title: "AETHERION", desc: "A raycaster engine inspired by DOOM.", img: "/images/about-me/github/aetherion.gif", link: "https://github.com/mooofin/Aetherion" },
    { title: "AFL-exercises", desc: "Coverage-guided fuzzing experiments using AFL++", img: "/images/about-me/github/afl-exercises.gif", link: "https://github.com/mooofin/AFL-exercises" },
    { title: "JuliaScope", desc: "Multithreaded subdomain enumerator written in Julia", img: "/images/about-me/github/juliascope.gif", link: "https://github.com/mooofin/JuliaScope" },
    { title: "Clair-Obscur", desc: "Featuring Lune :3", img: "/images/about-me/github/lune.gif", link: "https://github.com/mooofin/Clair-Obscur" },
    { title: "DS_AnorLondoLightFix", desc: "A mod to restore and enhance the lighting in Anor Londo.", img: "/images/about-me/github/ds-anorlondo.gif", link: "https://github.com/mooofin/DS_AnorLondoLightFix" },
    { title: "Thalix", desc: "A high-performance process management and memory editing toolkit", img: "/images/about-me/github/thalix.gif", link: "https://github.com/mooofin/Thalix" },
    { title: "God-of-War-Ragnarok", desc: "Cheat Engine Scripts & Tools for modifying the single-player experience.", img: "/images/about-me/github/goww.png", link: "https://github.com/mooofin/God-of-War-Ragnarok" },
    { title: "Theia-BC", desc: "A K-Nearest Neighbors (KNN) classifier for breast cancer diagnosis.", img: "/images/about-me/github/theia-bc.gif", link: "https://github.com/mooofin/KNN-DiagnosisModel" },
    { title: "Rustflakes", desc: "Rust project with Nix flakes for multi-target cross-compilation & Docker", img: "/images/about-me/github/rustflakes.gif", link: "https://github.com/mooofin/Rustflakes" },
    { title: "CTFs", desc: "CTF writeups :3", img: "/images/about-me/github/ctfs.gif", link: "https://github.com/mooofin/CTFs" },
  ];

  const tools = [
    { name: "NixOS", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nixos/nixos-original.svg" },
    { name: "Gentoo", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gentoo/gentoo-plain.svg" },
    { name: "Julia", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/julia/julia-original.svg" },
    { name: "Emacs", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/emacs/emacs-original.svg" },
    { name: "Rust", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg" },
    { name: "C++", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-original.svg" },
    { name: "Python", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg" },
    { name: "Blender", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/blender/blender-original.svg" },
  ];

  return (
    <main className="hymnals-blog about-page-v2">
      <div className="hymnals-container">
        <div className="about-page-header">
          <a href="/" className="hymnals-back-link">← Back to Home</a>
          <img src="/images/about-me/pfp.jpg" alt="Profile" className="hymnals-pfp" />
          <h1 className="hymnals-title">About Me</h1>
        </div>

        <div className="about-page-hero">
          <img src="/images/about-me/github/aboutme2.gif" alt="About Me" className="header-gif" />
        </div>

        <section className="blog-style-card modding-section">
          <h2>Dark Souls Restoration Project</h2>
          <div className="about-intro-content">
            <p className="decrypted-text">
              <span className="decrypted-content">{decryptedText}</span>
              {isDecrypting && <span className="cursor">|</span>}
            </p>
          </div>

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

          <div className="comparison-grid">
            <div className="comparison-item" onClick={() => openImage("/images/about-me/github/ds_before.png")}>
              <h3>Before</h3>
              <img src="/images/about-me/github/ds_before.png" alt="Dark Souls Lighting Before" />
            </div>
            <div className="comparison-item" onClick={() => openImage("/images/about-me/github/ds_after.png")}>
              <h3>After</h3>
              <img src="/images/about-me/github/ds_after.png" alt="Dark Souls Lighting After" />
            </div>
          </div>
        </section>

        <section className="blog-style-card tools-section">
          <h2>Tools & Technologies</h2>
          <div className="tech-badges">
            {tools.map(tool => (
              <div key={tool.name} className="tech-badge">
                <img src={tool.icon} alt={tool.name} title={tool.name} />
                <span>{tool.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="blog-style-card skills-section">
          <h2>My Skills</h2>
          <div className="skills-container">
            <GlassIcons skills={['Mod Development', 'Reverse Engineering', 'Havok Engine', 'Cheat Engine', 'Memory Editing']} />
          </div>
        </section>

        <section className="repos-section">
          <div className="repos-header">
            <img src="/images/about-me/github/repos1.gif" alt="Repositories" className="repos-gif" />
          </div>
          <div className="repos-grid">
            {repositories.map(repo => (
              <a
                key={repo.title}
                href={repo.link}
                className={`repo-card blog-style-card ${repo.full ? 'full-width' : ''}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="repo-img-container">
                  <img src={repo.img} alt={repo.title} />
                </div>
                <div className="repo-info">
                  <h3>{repo.title}</h3>
                  <p>{repo.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
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
