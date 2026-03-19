import React from "react";

interface MarkdownTableProps {
  children?: React.ReactNode;
}

export default function MarkdownTable({ children }: MarkdownTableProps) {
  return (
    <div className="table-wrapper">
      <table>{children}</table>
    </div>
  );
}
