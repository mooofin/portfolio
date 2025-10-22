import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DesktopIcons() {
  const navigate = useNavigate();
  const [modalImage, setModalImage] = useState(null);

  const goTo = (path, hash) => (e) => {
    e.preventDefault();
    if (path) navigate(path);
    if (hash) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openModal = (images) => (e) => {
    e.preventDefault();
    setModalImage(images);
  };

  const closeModal = () => {
    setModalImage(null);
  };

  // Brand image collections
  const brandImages = {
    gucci: [
      '/images/icons/hi1.jpg',
      '/images/icons/hi2.jpg',
      '/images/icons/hi3.jpg',
      '/images/icons/hi4.jpg',
    ],
    vivienne: [
      '/images/icons/hi8.jpg',
      '/images/icons/hi9.jpg',
      '/images/icons/hi10.jpg',
      '/images/icons/hi11.jpg',
      '/images/icons/hi12.jpg',
      '/images/icons/hi13.jpg',
      '/images/icons/hi14.jpg',
    ]
  };

  return (
    <>
      <div className="desktop-icons-grid right-desktop-icons" aria-label="desktop shortcuts right">
        <a href="/blog" className="desktop-shortcut" onClick={goTo('/blog')}
          title="Blog">
          <img src="/stuff/234.png" alt="Blog folder" />
          <span className='uncenter'>Blog</span>
        </a>
        <a href="#gucci" className="desktop-shortcut" title="Gucci" onClick={openModal(brandImages.gucci)}>
          <img src="/images/gucci.png" alt="Gucci icon" />
          <span className='uncenter'>Gucci</span>
        </a>
        <a href="#vivienne" className="desktop-shortcut" title="Vivienne Westwood" onClick={openModal(brandImages.vivienne)}>
          <img src="/images/vivi.png" alt="Vivienne Westwood icon" />
          <span className='first-name'>Vivienne</span>
          <span className="last-name">Westwood</span>
        </a>
      </div>

      {/* Modal for displaying brand images */}
      {modalImage && (
        <div className="brand-modal-overlay" onClick={closeModal}>
          <div className="brand-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="brand-modal-close" onClick={closeModal}>×</button>
            <div className="brand-modal-gallery">
              {modalImage.map((img, index) => (
                <img key={index} src={img} alt={`Brand image ${index + 1}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


