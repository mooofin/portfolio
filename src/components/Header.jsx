import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Header() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    document.body.classList.add('theme-image');
    try { localStorage.setItem('theme-image', '1'); } catch {}
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const nearTop = e.clientY <= 50;
      setIsVisible(nearTop);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const scrollToId = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className={`header ${isVisible ? 'header-visible' : 'header-hidden'}`}>
      <nav className="navbar">
        <Link to="/" className="logo">mooofin</Link>
        <ul className="nav-links">
          <li><Link to="/">Home</Link></li>
          <li><a href="#about" onClick={(e) => scrollToId(e, 'about')}>About</a></li>
          <li><a href="#contact" onClick={(e) => scrollToId(e, 'contact')}>Contact</a></li>
          <li><Link to="/blog">Blog</Link></li>
          <li>
            <a href="https://open.spotify.com/user/314ikabu7m4lwg6rljojtmhf74uq" target="_blank" rel="noopener noreferrer" className="theme-toggle" aria-label="Spotify">
              ♫
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
