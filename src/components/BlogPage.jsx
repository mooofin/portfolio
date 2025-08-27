// src/components/BlogPage.jsx
import React from "react";
import ReactMarkdown from 'react-markdown'
import { Link } from "react-router-dom";
import { useEffect, useState } from 'react';
import { loadAllPosts } from "../posts";

function BlogPage() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    (async () => {
      const all = await loadAllPosts();
      setPosts(all);
    })();
  }, []);

  return (
    <main className="blog-page">
      <h1 className="blog-title">Blog</h1>
      <div className="blog-list">
        {posts.map((post) => (
          <article className="blog-post-summary" key={post.slug}>
            <h2>
              <Link to={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="date">{post.date}</p>
            <p>{`${post.content.substring(0, 150)}...`}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

export default BlogPage;