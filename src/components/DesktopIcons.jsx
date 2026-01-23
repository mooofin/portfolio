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
        <a href="/music" className="desktop-shortcut" onClick={goTo('/music')}
          title="Music">
          <img src="/stuff/234.png" alt="Music folder" />
          <span className='uncenter'>Music</span>
        </a>
        <a href="/blog" className="desktop-shortcut" onClick={goTo('/blog')}
          title="Blog">
          <img src="/stuff/234.png" alt="Blog folder" />
          <span className='uncenter'>Blog</span>
        </a>
        <a href="https://hymnals.bearblog.dev/blog/" className="desktop-shortcut" target="_blank" rel="noopener noreferrer"
          title="Poetry">
          <img src="/stuff/poetry.png" alt="Poetry folder" />
          <span className='uncenter'>Poetry</span>
        </a>
      </div>


    </>
  );
}


