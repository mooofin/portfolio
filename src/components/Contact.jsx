import React from 'react';

function Contact() {
  return (
    <section id="contact" className="contact-section">
      <div className="contact-links">
        <a href="mailto:siddharthqln@gmail.com" className="contact-link">
          <img src="/stuff/Mail.png" alt="Email" style={{ width: '24px', height: '24px' }} />
        </a>
        <a href="https://www.linkedin.com/in/siddharthu5799/" target="_blank" rel="noopener noreferrer" className="contact-link">
          <img src="/images/gucci.png" alt="LinkedIn" style={{ width: '24px', height: '24px' }} />
        </a>
        <a href="https://open.spotify.com/user/314ikabu7m4lwg6rljojtmhf74uq" target="_blank" rel="noopener noreferrer" className="contact-link">
          <span style={{ fontSize: '24px' }}>♫</span>
        </a>
      </div>
    </section>
  );
}

export default Contact;
