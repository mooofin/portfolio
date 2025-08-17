// src/components/BlogPost.jsx
import React from "react";
import { useParams, Link } from "react-router-dom";
// This path needs to be correct. '../' goes up one directory.
import { posts } from "../posts";

function BlogPost() {
  const { slug } = useParams();
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div>
        <h1>Post not found</h1>
        <Link to="/blog">← Back to all posts</Link>
      </div>
    );
  }

  return (
    <main className="blog-page">
      <article className="blog-post">
        <h1>{post.title}</h1>
        <p className="date">{post.date}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{post.content.trim()}</p>
        <br />
        <Link to="/blog">← Back to all posts</Link>
      </article>
    </main>
  );
}

export default BlogPost;