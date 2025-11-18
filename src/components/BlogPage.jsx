// src/components/BlogPage.jsx
import React from "react";
import ReactMarkdown from 'react-markdown'
import { Link } from "react-router-dom";
import { useEffect, useState, useCallback } from 'react';
import { loadAllPosts } from "../posts";

function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [decryptedIntro, setDecryptedIntro] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);

  const introText = "my silly rants :(";

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

  const decryptIntro = useCallback(() => {
    setIsDecrypting(true);
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < introText.length) {
        const scrambled = introText.slice(0, currentIndex) + 
          characters.charAt(Math.floor(Math.random() * characters.length));
        setDecryptedIntro(scrambled);
        currentIndex++;
      } else {
        setDecryptedIntro(introText);
        setIsDecrypting(false);
        clearInterval(interval);
      }
    }, 30);
  }, [introText]);

  useEffect(() => {
    (async () => {
      const all = await loadAllPosts();
      setPosts(all);
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(decryptIntro, 500);
    return () => clearTimeout(timer);
  }, [decryptIntro]);

  return (
    <main className="blog-page">
      <div className="blog-header">
        <h1 className="blog-title">Blog</h1>
        <div className="blog-icon-wrapper">
          <img src="/images/icons/blogicon.gif" alt="blog fun icon" className="blog-icon" />
        </div>
        
        <div className="blog-intro">
          <div className="decrypted-text blog-decrypted">
            <span className="decrypted-content">{decryptedIntro}</span>
            {isDecrypting && <span className="cursor">|</span>}
          </div>
        </div>
      </div>

      <div className="blog-list">
        {posts.map((post) => (
          <article className="blog-post-item" key={post.slug}>
            <Link to={`/blog/${post.slug}`} className="blog-post-link">
              <h2 className="blog-post-title">{post.title}</h2>
            </Link>
            <p className="blog-post-date">{post.date}</p>
            <p className="blog-post-excerpt">{post.content.substring(0, 200)}...</p>
          </article>
        ))}
      </div>
    </main>
  );
}

export default BlogPage;