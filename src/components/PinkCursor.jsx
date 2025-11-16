import { useEffect } from 'react';

export default function PinkCursor() {
  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const cursor = document.createElement('div');
    cursor.className = 'cursor-dot';
    document.body.appendChild(cursor);

    const trails = [];
    const maxTrails = 10; // Limit trail count
    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    let animationId;

    const moveCursor = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animateCursor = () => {
      // Smooth follow effect
      const dx = mouseX - cursorX;
      const dy = mouseY - cursorY;
      
      // Only update if movement is significant (optimization)
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        cursorX += dx * 0.2;
        cursorY += dy * 0.2;
        
        cursor.style.transform = `translate(${cursorX - 10}px, ${cursorY - 10}px)`;
      }
      
      animationId = requestAnimationFrame(animateCursor);
    };

    const createTrail = () => {
      // Limit trail creation
      if (trails.length >= maxTrails) {
        const oldTrail = trails.shift();
        oldTrail?.remove();
      }

      const trail = document.createElement('div');
      trail.className = 'cursor-trail';
      trail.style.transform = `translate(${cursorX - 4}px, ${cursorY - 4}px)`;
      document.body.appendChild(trail);
      
      trails.push(trail);
      
      setTimeout(() => {
        trail.remove();
        const index = trails.indexOf(trail);
        if (index > -1) trails.splice(index, 1);
      }, 600);
    };

    let trailInterval;
    
    const startTrails = () => {
      trailInterval = setInterval(createTrail, 80); // Reduced frequency
    };

    document.addEventListener('mousemove', moveCursor, { passive: true });
    document.addEventListener('mousemove', startTrails, { once: true });
    
    animateCursor();

    return () => {
      document.removeEventListener('mousemove', moveCursor);
      clearInterval(trailInterval);
      cancelAnimationFrame(animationId);
      cursor.remove();
      trails.forEach(trail => trail.remove());
    };
  }, []);

  return null;
}
