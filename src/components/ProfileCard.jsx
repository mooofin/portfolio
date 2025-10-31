import React from 'react';

export default function ProfileCard() {
  return (
    <div className="profile-card glass-card electric-border">
      <div className="electric-border-bg"></div>
      <div className="profile-card-body">
        <div className="profile-card-header">
          <img className="profile-card-avatar" src="/images/icons/icon.jpg" alt="avatar" loading="lazy" />
          <div className="profile-card-meta">
            <h3 className="profile-card-name">sid</h3>
            <div className="profile-card-title">A Mod Developer & Reverse Engineer</div>
          </div>
        </div>
        <div className="profile-card-bio">
          <p className="bio-text-red">
            Huge soulsborne nerd and mod developer with a deep passion for reverse engineering game engines to understand and manipulate their inner workings. My focus lies in dissecting and enhancing game mechanics, particularly within systems built on the Havok physics engine :)
          </p>
        </div>
        <div className="profile-card-actions">
          <a href="mailto:siddharthqln@gmail.com" className="cta-button electric-border-small"><div className="electric-border-bg-small"></div><span>Contact</span></a>
        </div>
      </div>
    </div>
  );
}
