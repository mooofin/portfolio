import React from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState, useMemo } from 'react';
import { loadPostBySlug } from '../posts.js';

function transformObsidianEmbeds(markdown) {
  if (!markdown) return markdown;
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';
  return markdown.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, file, meta) => {
    let cleanFile = file.trim().replace(/^\.\/+/, '');
    cleanFile = cleanFile.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    let alt = cleanFile.replace(/\.[^/.]+$/, '');
    if (meta) {
      const trimmed = meta.trim();
      if (!/^\d+(x\d+)?$/i.test(trimmed)) {
        alt = trimmed;
      }
    }
    const url = `${base}images/${cleanFile}`.replace(/\/+images\//, '/images/');
    return `![${alt}](${url})`;
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

  const components = useMemo(() => ({
    img: ({ src, alt }) => {
      const [currentSrc, setCurrentSrc] = React.useState(src);
      return (
        <img
          src={currentSrc}
          alt={alt || ''}
          loading="lazy"
          onError={() => {
            if (currentSrc.startsWith('/')) {
              setCurrentSrc(currentSrc.replace(/^\//, ''));
              return;
            }
            if (!currentSrc.startsWith('public/')) {
              setCurrentSrc(`public/${currentSrc}`);
            }
          }}
        />
      );
    }
  }), []);

  return (
    <>
      <div className="blog-page-container">
        <Link to="/" className="back-link">&larr; Back to Portfolio</Link>
        <div className="markdown-container blog-article">
          <ReactMarkdown components={components}>{processed}</ReactMarkdown>
        </div>
      </div>
    </>
  );
}

export default BlogPost;
