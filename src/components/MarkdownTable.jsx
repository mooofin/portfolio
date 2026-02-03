import React from 'react';

export default function MarkdownTable({ children }) {
  return (
    <div className="markdown-table-wrapper">
      <table>
        {children}
      </table>
    </div>
  );
}

