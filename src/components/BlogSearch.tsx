import { useState, useEffect, useRef } from "react";

type Post = {
  title: string;
  url: string;
};

type SearchResult = {
  url: string;
  title: string;
};

type PagefindResult = {
  data: () => Promise<{
    url: string;
    meta?: { title?: string };
  }>;
};

type Pagefind = {
  init: () => Promise<void>;
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
};

export default function BlogSearch({ posts }: { posts: Post[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const pagefindRef = useRef<Pagefind | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }

    const search = async () => {
      if (!pagefindRef.current) {
        try {
          const pagefindUrl = "/pagefind/pagefind.js";
          pagefindRef.current = (await import(
            /* @vite-ignore */ pagefindUrl
          )) as Pagefind;
          await pagefindRef.current.init();
        } catch {
          pagefindRef.current = null;
        }
      }

      if (pagefindRef.current) {
        const res = await pagefindRef.current.search(query);
        const data = await Promise.all(res.results.map((r) => r.data()));
        setResults(
          data.map((d) => ({ url: d.url, title: d.meta?.title ?? d.url })),
        );
      } else {
        const q = query.toLowerCase();
        setResults(
          posts
            .filter((p) => p.title.toLowerCase().includes(q))
            .map((p) => ({ url: p.url, title: p.title })),
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
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search blog posts"
      />
      {results !== null && (
        <ul className="blog-search-results">
          {results.length === 0 ? (
            <li className="blog-search-empty">no results found :(</li>
          ) : (
            results.map((r) => (
              <li key={r.url}>
                <a href={r.url} className="hymnals-post-link">
                  {r.title}
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
