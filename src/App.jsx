// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Component Imports
import Header from './components/Header';
import Hero from './components/Hero';
import Blog from './components/blog';
import About from './components/About';
import Contact from './components/Contact';
import Dither from './components/Dither';
import BlogPage from './components/BlogPage';
import BlogPost from './components/BlogPost'; 
function App() {
  return (
    // The Router must wrap your entire application
    <Router>
      <div className="app-container">
        <div className="fullscreen-background">
          <Dither
            waveColor={[0.6, 0, 0.3]}
            colorNum={16}
            waveAmplitude={0.37}
            waveSpeed={0.09}
            mouseRadius={0.3}
            disableAnimation={false}
            enableMouseInteraction={true}
          />
        </div>

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
    </Router>
  );
}

export default App;