import React from 'react';

function Contact() {
  return (
    <section id="contact" className="contact-section">
      <h2>contact me :3</h2>
      <p>
        <a href="mailto:siddharthqln@gmail.com" className="back-link">siddharthqln@gmail.com</a>
      </p>
      <div style={{ marginTop: '1.5rem' }}>
        <iframe
          style={{ borderRadius: '12px' }}
          src="https://open.spotify.com/embed/user/314ikabu7m4lwg6rljojtmhf74uq?utm_source=generator"
          width="100%"
          height="352"
          frameBorder="0"
          allowFullScreen=""
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Spotify Profile"
        ></iframe>
      </div>
    </section>
  );
}

export default Contact;
