import React from "react";
import { Link } from "react-router-dom";

function Header() {
  return (
    <header className="header">
      <nav className="navbar">
        <Link to="/" className="logo">mooofin</Link>
        <ul className="nav-links">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/#about">About</Link></li>
          <li><Link to="/#contact">Contact</Link></li>
          <li><Link to="/blog">Blog</Link></li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
