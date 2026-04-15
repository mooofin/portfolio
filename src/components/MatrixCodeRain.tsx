"use client";

import { useEffect, useRef } from "react";

interface MatrixCodeRainProps {
  color?: string;
  charset?: string;
  fontSize?: number;
  fps?: number;
  opacity?: number;
  fullScreen?: boolean;
  width?: string;
  height?: string;
  className?: string;
}

export function MatrixCodeRain({
  color = "#00ff00",
  charset = "0123#!$^&456789ABC",
  fontSize = 16,
  fps = 20,
  opacity = 0.8,
  fullScreen = false,
  width = "100%",
  height = "400px",
  className = "",
}: MatrixCodeRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drops = Array(Math.floor(canvas.width / fontSize)).fill(1);
    };

    let drops: number[] = [];
    resize();

    const chars = charset.split("");

    const draw = () => {
      ctx.fillStyle = `rgba(0,0,0,${opacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = color;
      ctx.font = `${fontSize}px monospace`;

      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(char, x, y * fontSize);

        ctx.fillStyle = color;
        if (y > 1) {
          const prevChar = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(prevChar, x, (y - 1) * fontSize);
        }

        if (y * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      });
    };

    const interval = setInterval(draw, 1000 / fps);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [color, charset, fontSize, fps, opacity]);

  const style = fullScreen
    ? {
        position: "fixed" as const,
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
      }
    : { width, height };

  return (
    <canvas
      ref={canvasRef}
      style={{ ...style, display: "block"}}
      className={className}
    />
  );
}