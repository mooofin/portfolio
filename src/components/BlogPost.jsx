import React from 'react';
import rehypeRaw from 'rehype-raw';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState, useMemo } from 'react';
import { loadPostBySlug } from '../posts.js';
import MarkdownTable from './MarkdownTable';

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

  const finalContent = processed;

  const components = useMemo(() => ({
    code: ({ node, inline, className, children, ...props }) => {
      return <code className={className} {...props}>{children}</code>;
    },
    table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
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
      <div className="hymnals-blog">
        <div className="hymnals-blog-post-container">
          <img
            src="/my-melody-kuromi-lolita-ipad-wallpaper-kawaii-hoshi.jpg"
            alt="muffin's profile"
            className="hymnals-pfp"
          />
          <h1 className="hymnals-title">
            {post ? post.title : 'Loading...'}
          </h1>
          <Link to="/blog" className="hymnals-back-link">&larr; back to blog</Link>
          <div className="markdown-container blog-article">
            {slug === 'havok-engine-reverse-engineering' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>{finalContent}</ReactMarkdown>
            ) : (
              <ReactMarkdown rehypePlugins={[rehypeRaw]} components={components}>{finalContent}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default BlogPost;
