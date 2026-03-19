import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Critical components - load immediately
import Header from "./components/Header";
import Hero from "./components/Hero";
import Contact from "./components/Contact";
import VideoBackground from "./components/VideoBackground";
import PinkCursor from "./components/PinkCursor";

// Lazy load non-critical components
const MusicPage = lazy(() => import("./components/MusicPage"));

// Loading fallback component
const PageLoader = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "50vh",
      color: "#ff69b4",
    }}
  >
    <div className="spinner"></div>
  </div>
);

function AppContent() {
  return (
    <div className="app-container">
      <PinkCursor />
      <VideoBackground />
      <div className="content-container">
        <Header />
        <main>
          <Suspense fallback={<PageLoader />}>
            <Routes>
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
              <Route path="/music" element={<MusicPage />} />
            </Routes>
          </Suspense>
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
