import { useState, useEffect, useRef } from 'react';

export default function BlogSearch({ posts }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const pagefindRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }

    const search = async () => {
      if (!pagefindRef.current) {
        try {
          pagefindRef.current = await import('/pagefind/pagefind.js');
          await pagefindRef.current.init();
        } catch {
          // pagefind not available in dev mode — fall back to title filter
          pagefindRef.current = null;
        }
      }

      if (pagefindRef.current) {
        const res = await pagefindRef.current.search(query);
        const data = await Promise.all(res.results.map(r => r.data()));
        setResults(data.map(d => ({ url: d.url, title: d.meta?.title ?? d.url })));
      } else {
        // Dev fallback: filter by title
        const q = query.toLowerCase();
        setResults(
          posts
            .filter(p => p.title.toLowerCase().includes(q))
            .map(p => ({ url: p.url, title: p.title }))
        );
      }
    };

    search();
  }, [query]);

  return (
    <div className="blog-search-wrapper">
      <input
        type="search"
        className="blog-search-input"
        placeholder="search posts..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Search blog posts"
      />
      {results !== null && (
        <ul className="blog-search-results">
          {results.length === 0 ? (
            <li className="blog-search-empty">no results found :(</li>
          ) : (
            results.map(r => (
              <li key={r.url}>
                <a href={r.url} className="hymnals-post-link">{r.title}</a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
