import React from 'react';

function Header() {
  return (
    <header className="header">
      <nav className="navbar">
        <a href="#home" className="logo">mooofin</a>
        <ul className="nav-links">
          <li><a href="#about">About</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
