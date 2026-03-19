import { useEffect } from "react";

export default function PinkCursor() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const cursor = document.createElement("div");
    cursor.className = "cursor-dot";
    document.body.appendChild(cursor);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let lastTrailX = 0;
    let lastTrailY = 0;
    let animationId: number;

    const createTrail = (x: number, y: number) => {
      const trail = document.createElement("div");
      trail.className = "cursor-trail";
      trail.style.left = `${x - 4}px`;
      trail.style.top = `${y - 4}px`;
      document.body.appendChild(trail);

      trail.addEventListener("animationend", () => {
        trail.remove();
      });
      setTimeout(() => {
        if (trail.parentNode) trail.remove();
      }, 750);
    };

    const moveCursor = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      const dist = Math.hypot(mouseX - lastTrailX, mouseY - lastTrailY);
      if (dist > 10) {
        createTrail(mouseX, mouseY);
        lastTrailX = mouseX;
        lastTrailY = mouseY;
      }
    };

    const animateCursor = () => {
      const dx = mouseX - cursorX;
      const dy = mouseY - cursorY;

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        cursorX += dx * 0.2;
        cursorY += dy * 0.2;
        cursor.style.transform = `translate(${cursorX - 10}px, ${cursorY - 10}px)`;
      }

      animationId = requestAnimationFrame(animateCursor);
    };

    document.addEventListener("mousemove", moveCursor, { passive: true });
    animateCursor();

    return () => {
      document.removeEventListener("mousemove", moveCursor);
      cancelAnimationFrame(animationId);
      cursor.remove();
      document.querySelectorAll(".cursor-trail").forEach((el) => el.remove());
    };
  }, []);

  return null;
}
