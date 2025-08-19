// src/components/Blog.jsx
import ReactMarkdown from 'react-markdown';

// --- PASTE YOUR ENTIRE MARKDOWN POST INSIDE THESE BACKTICKS ---
const markdownContent = `
# My First Post
This is where your blog post content goes.

You can have **bold text**, *italic text*, and even code blocks.

\`\`\`
const example = "Hello, World!";
\`\`\`
`;
// ----------------------------------------------------------------

function Blog() {
  return (
    <section id="blog" className="blog-section">
      <div className="blog-content">
        <h2>From the Archives</h2>
        <div className="markdown-container">
          <ReactMarkdown>{markdownContent}</ReactMarkdown>
        </div>
      </div>
    </section>
  );
}

export default Blog;