import React from "react";
import Folder from "./Folder";

export default function DesktopIcons() {
  const iconStyle: React.CSSProperties = {
    width: "60%",
    height: "60%",
    objectFit: "contain",
  };

  return (
    <div
      className="desktop-icons-grid right-desktop-icons"
      aria-label="desktop shortcuts right"
    >
      <div className="github-card">
        <a
          href="/about"
          className="github-link desktop-shortcut"
          title="About Me"
        >
          <Folder
            color="#ff69b4"
            size={1}
            items={[<img src="/stuff/234.png" alt="" style={iconStyle} />]}
          />
          <span className="uncenter">About Me</span>
        </a>
      </div>
      <div className="github-card">
        <a href="/music" className="github-link desktop-shortcut" title="Music">
          <Folder
            color="#ff69b4"
            size={1}
            items={[<img src="/stuff/234.png" alt="" style={iconStyle} />]}
          />
          <span className="uncenter">Music</span>
        </a>
      </div>
      <div className="github-card">
        <a href="/blog" className="github-link desktop-shortcut" title="Blog">
          <Folder
            color="#ff69b4"
            size={1}
            items={[<img src="/stuff/234.png" alt="" style={iconStyle} />]}
          />
          <span className="uncenter">Blog</span>
        </a>
      </div>
      <div className="github-card">
        <a
          href="https://hymnals.bearblog.dev/blog/"
          className="desktop-shortcut"
          target="_blank"
          rel="noopener noreferrer"
          title="Poetry"
        >
          <img src="/stuff/poetry.png" alt="Poetry folder" />
          <span className="uncenter">Poetry</span>
        </a>
      </div>
    </div>
  );
}
