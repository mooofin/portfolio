import React from 'react';

export default function ProfileCard() {
  return (
    <div className="profile-card glass-card electric-border">
      <div className="electric-border-bg"></div>
      <div className="profile-card-body">
        <div className="profile-card-header">
          <img className="profile-card-avatar" src="/images/icons/icon.jpg" alt="avatar" loading="lazy" />
          <div className="profile-card-meta">
            <h3 className="profile-card-name">siddharth</h3>
            <div className="profile-card-title">A Mod Developer & Reverse Engineer</div>
          </div>
        </div>
        <div className="profile-card-bio">
          <p>
            Specializing in game mechanics and physics.<br/>
            NixOS witch :3<br/>
            Lighting engines with Havok. LLVM enthusiast:p
          </p>
        </div>
        <div className="profile-card-actions">
          <a href="mailto:siddharthqln@gmail.com" className="cta-button electric-border-small"><div className="electric-border-bg-small"></div><span>Contact</span></a>
          <a href="https://github.com/mooofin" target="_blank" rel="noopener noreferrer" className="cta-button electric-border-small"><div className="electric-border-bg-small"></div><span>GitHub</span></a>
        </div>
      </div>
    </div>
  );
}
