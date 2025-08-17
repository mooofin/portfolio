// src/components/BlogPage.jsx
import React from "react";
// Make sure you import 'Link'
import { Link } from "react-router-dom";
import { posts } from "../posts";

function BlogPage() {
  return (
    <main className="blog-page">
      <h1>Blog</h1>
      <div className="blog-list">
        {posts.map((post) => (
          // Use the slug for the key, it's a better unique identifier
          <article className="blog-post-summary" key={post.slug}>
            <h2>
              {/* This is the crucial change. */}
              {/* We wrap the title in a Link that points to a unique URL. */}
              <Link to={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="date">{post.date}</p>
            {/* You can keep showing a snippet of the content if you like */}
            <p>{`${post.content.substring(0, 150)}...`}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

export default BlogPage;