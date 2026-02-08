// src/components/Blog.jsx
import ReactMarkdown from 'react-markdown';


function Blog() {
  return (
    <section id="blog" className="blog-section">
      <div className="blog-content">
        <h2>From the Archives</h2>
        <div className="markdown-container">
          <ReactMarkdown>{""}</ReactMarkdown>
        </div>
      </div>
    </section>
  );
}

export default Blog;