import React from 'react';

function Contact() {
  return (
    <section id="contact" className="contact-section">
      <h2>contact me :3</h2>
      <div className="contact-links">
        <a href="mailto:siddharthqln@gmail.com" className="contact-link shape-blur">
          <div className="shape-blur-bg"></div>
          <span>siddharthqln@gmail.com</span>
        </a>
        <a href="https://www.linkedin.com/in/siddharthu5799/" target="_blank" rel="noopener noreferrer" className="contact-link shape-blur">
          <div className="shape-blur-bg"></div>
          <span>LinkedIn</span>
        </a>
      </div>
    </section>
  );
}

export default Contact;
