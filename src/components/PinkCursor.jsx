import { useEffect } from 'react';

export default function PinkCursor() {
  useEffect(() => {
    const cursor = document.createElement('div');
    cursor.className = 'cursor-dot';
    document.body.appendChild(cursor);

    const trails = [];
    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;

    const moveCursor = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animateCursor = () => {
      // Smooth follow effect
      cursorX += (mouseX - cursorX) * 0.2;
      cursorY += (mouseY - cursorY) * 0.2;
      
      cursor.style.left = `${cursorX - 10}px`;
      cursor.style.top = `${cursorY - 10}px`;
      
      requestAnimationFrame(animateCursor);
    };

    const createTrail = () => {
      const trail = document.createElement('div');
      trail.className = 'cursor-trail';
      trail.style.left = `${cursorX - 4}px`;
      trail.style.top = `${cursorY - 4}px`;
      document.body.appendChild(trail);
      
      trails.push(trail);
      
      setTimeout(() => {
        trail.remove();
        trails.splice(trails.indexOf(trail), 1);
      }, 600);
    };

    let trailInterval;
    
    const startTrails = () => {
      trailInterval = setInterval(createTrail, 50);
    };

    document.addEventListener('mousemove', moveCursor);
    document.addEventListener('mousemove', startTrails, { once: true });
    
    animateCursor();

    return () => {
      document.removeEventListener('mousemove', moveCursor);
      clearInterval(trailInterval);
      cursor.remove();
      trails.forEach(trail => trail.remove());
    };
  }, []);

  return null;
}
