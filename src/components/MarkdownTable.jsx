import React from 'react';

export default function MarkdownTable({ children }) {
  return (
    <div style={{
      overflowX: 'auto',
      margin: '2rem 0',
      borderRadius: '12px',
      background: 'rgba(0, 0, 0, 0.4)',
      padding: '1.5rem',
      border: '1px solid rgba(199, 199, 255, 0.15)',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left',
      }}>
        {children}
      </table>
    </div>
  );
}

