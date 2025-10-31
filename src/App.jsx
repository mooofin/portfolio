// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// Component Imports
import Header from './components/Header';
import Hero from './components/Hero';
// import DesktopOverlay from './components/DesktopOverlay.jsx';
import Blog from './components/blog';
import About from './components/About';
import Contact from './components/Contact';
import VideoBackground from './components/VideoBackground.jsx';
import DesktopIcons from './components/DesktopIcons.jsx';
import BlogPage from './components/BlogPage';
import BlogPost from './components/BlogPost';

function AppContent() {
  const location = useLocation();
  const isBlogRoute = location.pathname.startsWith('/blog');

  return (
    <div className="app-container">
      {!isBlogRoute && <VideoBackground src="/images/video/blg.mp4" />}
      <div className="content-container">
        <Header />
          <main>
            {/* The Routes component acts as a switch for your pages */}
            <Routes>
              {/* Route for your homepage */}
              <Route
                path="/"
                element={
                  <>
                    <Hero />
                    <div style={{ minHeight: '60vh' }}></div>
                    <DesktopIcons />
                    <About />
                    <Contact />
                  </>
                }
              />
              {/* Route for the blog list page */}
              <Route path="/blog" element={<BlogPage />} />
              {/* Route for a single, dynamic blog post. This is crucial. */}
              <Route path="/blog/:slug" element={<BlogPost />} />
            </Routes>
          </main>
        </div>
      </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;