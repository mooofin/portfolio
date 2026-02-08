import React, { useEffect, useState } from 'react';

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const formatted = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return <div className="desktop-clock">{formatted}</div>;
}

export default function DesktopOverlay() {
  return null;
}



