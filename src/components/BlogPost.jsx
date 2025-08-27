import React from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState } from 'react';
import { loadPostBySlug } from '../posts.js';

function transformObsidianEmbeds(markdown) {
  if (!markdown) return markdown;
  // Convert Obsidian image embeds ![[file.png]] -> ![file](/images/file.png)
  return markdown.replace(/!\[\[([^\]]+)\]\]/g, (m, file) => {
    const alt = file.replace(/\.[^/.]+$/, '');
    return `![${alt}](\/images\/${file})`;
  });
}

function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadPostBySlug(slug);
      setPost(loaded);
    })();
  }, [slug]);
  
  const postContent = post ? post.content : `# Loading...`;
  const processed = transformObsidianEmbeds(postContent);

  return (
    <>
      <div className="blog-page-container">
        <Link to="/" className="back-link">&larr; Back to Portfolio</Link>
        <div className="markdown-container blog-article">
          <ReactMarkdown>{processed}</ReactMarkdown>
        </div>
      </div>
    </>
  );
}

export default BlogPost;
