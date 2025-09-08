import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Set theme class before mount for no-flash
try {
  const stored = localStorage.getItem('theme-image');
  const shouldEnable = stored === null ? true : stored === '1';
  if (shouldEnable) {
    document.body.classList.add('theme-image');
    if (stored === null) localStorage.setItem('theme-image', '1');
  }
} catch {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
