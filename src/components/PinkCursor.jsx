import { useEffect } from 'react';

export default function PinkCursor() {
  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const cursor = document.createElement('div');
    cursor.className = 'cursor-dot';
    document.body.appendChild(cursor);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    // Trail state
    let lastTrailX = 0;
    let lastTrailY = 0;
    let animationId;

    const createTrail = (x, y) => {
      const trail = document.createElement('div');
      trail.className = 'cursor-trail';
      // Center the trail (8px width means 4px offset)
      trail.style.left = `${x - 4}px`;
      trail.style.top = `${y - 4}px`;
      document.body.appendChild(trail);

      // Cleanup after animation
      trail.addEventListener('animationend', () => {
        trail.remove();
      });
      // Fallback cleanup
      setTimeout(() => {
        if (trail.parentNode) trail.remove();
      }, 750);
    };

    const moveCursor = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Create trail if moved enough distance
      const dist = Math.hypot(mouseX - lastTrailX, mouseY - lastTrailY);
      if (dist > 10) { // minimum distance between dots
        createTrail(mouseX, mouseY);
        lastTrailX = mouseX;
        lastTrailY = mouseY;
      }
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

    document.addEventListener('mousemove', moveCursor, { passive: true });

    animateCursor();

    return () => {
      document.removeEventListener('mousemove', moveCursor);
      cancelAnimationFrame(animationId);
      cursor.remove();
      // Clean up any remaining trails
      document.querySelectorAll('.cursor-trail').forEach(el => el.remove());
    };
  }, []);

  return null;
}
