// src/App.jsx
import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Contact from './components/Contact';
// import Footer from './components/Footer'; // Removed
import Dither from './components/Dither';

function App() {
  return (
    <div className="app-container">
      <div className="fullscreen-background">
        <Dither
          waveColor={[0.6, 0, 0.3]}
          colorNum={16}
          waveAmplitude={0.37}
          waveFrequency={3}
          waveSpeed={0.09}
          mouseRadius={0.3}
          disableAnimation={false}
          enableMouseInteraction={true}
        />
      </div>

      <div className="content-container">
        <Header />
        <main>
          <Hero />
          <About />
          <Contact />
        </main>
        {/* <Footer /> */} {/* Removed */}
      </div>
    </div>
  );
}

export default App;
