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
          src="/my-melody-kuromi-lolita-ipad-wallpaper-kawaii-hoshi.jpg"
          alt="muffin's profile"
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