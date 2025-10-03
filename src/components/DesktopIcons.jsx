import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function DesktopIcons() {
  const navigate = useNavigate();

  const goTo = (path, hash) => (e) => {
    e.preventDefault();
    if (path) navigate(path);
    if (hash) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="desktop-icons-grid" aria-label="desktop shortcuts">
      <a href="/blog" className="desktop-shortcut" onClick={goTo('/blog')}
         title="Blog">
        <img src="/stuff/234.png" alt="Blog folder" />
        <span>Blog</span>
      </a>
      <a href="#about" className="desktop-shortcut" onClick={goTo(null, 'about')}
         title="About Me">
        <img src="/stuff/234.png" alt="About folder" />
        <span>About Me</span>
      </a>
      <a href="#contact" className="desktop-shortcut" onClick={goTo(null, 'contact')}
         title="Contact">
        <img src="/stuff/Mail.png" alt="Mail icon" />
        <span>Contact</span>
      </a>
    </div>
  );
}


