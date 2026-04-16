"use client";

import { useRef, useState, useCallback } from "react";

interface GlowCardProps {
  children: React.ReactNode;
  glowColor?: string;
  className?: string;
  style?: React.CSSProperties;
  glowOpacity?: number;
  borderRadius?: string;
}

export default function GlowCard({
  children,
  glowColor = "#a855f7",
  className = "",
  style = {},
  glowOpacity = 0.35,
  borderRadius = "0.75rem",
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // we keep 'hovered' as state since it only fires once per enter/leave, 
  // but we remove 'pos' state to avoid high-frequency re-renders.
  const [hovered, setHovered] = useState(false);

  const hex2rgb = (hex: string) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r
      ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}`
      : "168, 85, 247";
  };
  const rgb = hex2rgb(glowColor);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // directly update CSS variables on the DOM node
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  }, []);

  return (
    <div
      ref={cardRef}
      className={className}
      style={{
        ...style,
        position: "relative",
        borderRadius,
        overflow: "hidden",
        border: `1.5px solid rgba(${rgb}, ${hovered ? 0.85 : 0.45})`,
        boxShadow: hovered
          ? `0 0 0 1px rgba(${rgb}, 0.3),
             0 0 16px 4px rgba(${rgb}, 0.55),
             0 0 45px 10px rgba(${rgb}, 0.25)`
          : `0 0 0 1px rgba(${rgb}, 0.12),
             0 0 12px 3px rgba(${rgb}, 0.28)`,
        transition: "box-shadow 0.3s ease, border-color 0.3s ease",
      }}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 9,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s ease",
          background: `radial-gradient(
            350px circle at var(--mouse-x, 0px) var(--mouse-y, 0px),
            rgba(${rgb}, ${glowOpacity}),
            transparent 60%
          )`,
        }}
      />
      <div style={{ position: "relative", zIndex: 10 }}>{children}</div>
    </div>
  );
}