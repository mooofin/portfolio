import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

function Header() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    document.body.classList.add('theme-image');
    try { localStorage.setItem('theme-image', '1'); } catch {}
  }, []);

  const lastScrollYRef = useRef(0);
  const mouseNearTopRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.pageYOffset || document.documentElement.scrollTop;
      lastScrollYRef.current = currentY;

      // Visible only when at top or when cursor is near the top edge
      const atTop = currentY <= 0;
      const mouseNearTop = mouseNearTopRef.current;
      setIsVisible(atTop || mouseNearTop);
    };

    const handleMouseMove = (e) => {
      // Consider "near top" as within 80px from top
      const nearTop = e.clientY <= 80;
      mouseNearTopRef.current = nearTop;

      // Update visibility immediately on mouse move
      const currentY = window.pageYOffset || document.documentElement.scrollTop;
      const atTop = currentY <= 0;
      setIsVisible(atTop || nearTop);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const scrollToContact = (e) => {
    e.preventDefault();
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <header className={`header ${isVisible ? 'header-visible' : 'header-hidden'}`}>
      <nav className="navbar">
        <Link to="/" className="logo">mooofin</Link>
        <ul className="nav-links">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/#about">About</Link></li>
          <li><a href="#contact" onClick={scrollToContact}>Contact</a></li>
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
