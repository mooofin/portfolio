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
    <>
      <div className="desktop-icons-grid right-desktop-icons" aria-label="desktop shortcuts right">
        <a href="/about" className="desktop-shortcut" onClick={goTo('/about')}
          title="About Me">
          <img src="/stuff/234.png" alt="About Me folder" />
          <span className='uncenter'>About Me</span>
        </a>
        <a href="/blog" className="desktop-shortcut" onClick={goTo('/blog')}
          title="Blog">
          <img src="/stuff/234.png" alt="Blog folder" />
          <span className='uncenter'>Blog</span>
        </a>
        <a href="https://github.com/mooofin" className="desktop-shortcut" target="_blank" rel="noopener noreferrer"
          title="GitHub">
          <img src="/stuff/234.png" alt="GitHub folder" />
          <span className='uncenter'>GitHub</span>
        </a>
      </div>


    </>
  );
}


