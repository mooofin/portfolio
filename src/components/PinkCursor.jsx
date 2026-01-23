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

    document.addEventListener('mousemove', moveCursor, { passive: true });
    
    animateCursor();

    return () => {
      document.removeEventListener('mousemove', moveCursor);
      cancelAnimationFrame(animationId);
      cursor.remove();
    };
  }, []);

  return null;
}
