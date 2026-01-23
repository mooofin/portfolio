// src/components/BlogPage.jsx
import React from "react";
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
    <main className="hymnals-blog">
      <div className="hymnals-container">
        <img 
          src="/stuff/6de1c27b5814e2f876565ede5be506ac.jpg" 
          alt="Profile" 
          className="hymnals-pfp"
        />
        <h1 className="hymnals-title">
          muffin's blog page :3
        </h1>

        <ul className="hymnals-post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <span className="hymnals-date">{post.date}</span>{' '}
              <Link to={`/blog/${post.slug}`} className="hymnals-post-link">
                {post.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export default BlogPage;