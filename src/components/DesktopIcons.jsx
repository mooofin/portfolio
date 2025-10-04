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
    <div className="desktop-icons-grid right-desktop-icons" aria-label="desktop shortcuts right">
      <a href="/blog" className="desktop-shortcut" onClick={goTo('/blog')}
         title="Blog">
        <img src="/stuff/234.png" alt="Blog folder" />
        <span>Blog</span>
      </a>
      <a href="#gucci" className="desktop-shortcut" title="Gucci">
        <img src="/images/gucci.png" alt="Gucci icon" />
        <span>Gucci</span>
      </a>
      <a href="#vivienne" className="desktop-shortcut" title="Vivienne Westwood">
        <img src="/images/vivi.png" alt="Vivienne Westwood icon" />
        <span>Vivienne Westwood</span>
      </a>
    </div>
  );
}


