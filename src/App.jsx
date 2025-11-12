// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// Component Imports
import Header from './components/Header';
import Hero from './components/Hero';
// import DesktopOverlay from './components/DesktopOverlay.jsx';
import Blog from './components/blog';
import Contact from './components/Contact';
import VideoBackground from './components/VideoBackground.jsx';
import BlogPage from './components/BlogPage';
import BlogPost from './components/BlogPost';
import AboutPage from './components/AboutPage';
import MusicPage from './components/MusicPage';
import PinkCursor from './components/PinkCursor';

function AppContent() {
  const location = useLocation();

  return (
    <div className="app-container">
      <PinkCursor />
      <VideoBackground src="/images/video/blg.mp4" />
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
                    <div className="single-screen-layout">
                      <Hero />
                    </div>
                    <Contact />
                  </>
                }
              />
              {/* Route for the about page */}
              <Route path="/about" element={<AboutPage />} />
              {/* Route for the music page */}
              <Route path="/music" element={<MusicPage />} />
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