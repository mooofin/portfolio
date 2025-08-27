// src/posts.js

function parseFrontmatterAndBody(raw) {
  if (!raw.startsWith('---')) return { frontmatter: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: raw };
  const header = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\s*\n/, '');
  const frontmatter = {};
  header.split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      frontmatter[key] = value;
    }
  });
  return { frontmatter, body };
}

export async function loadAllPosts() {
  const modules = import.meta.glob('./posts/*.md', { query: '?raw', import: 'default', eager: true });
  return Object.entries(modules).map(([path, raw]) => {
    const slug = path.split('/').pop().replace(/\.md$/, '');
    const { frontmatter, body } = parseFrontmatterAndBody(raw);
    return {
      slug,
      title: frontmatter.title || slug,
      date: frontmatter.date || '',
      content: body,
    };
  }).sort((a, b) => (new Date(b.date) - new Date(a.date)));
}

export async function loadPostBySlug(slug) {
  const modules = import.meta.glob('./posts/*.md', { query: '?raw', import: 'default', eager: true });
  for (const [path, raw] of Object.entries(modules)) {
    const candidate = path.split('/').pop().replace(/\.md$/, '');
    if (candidate.toLowerCase() === slug.toLowerCase()) {
      const { frontmatter, body } = parseFrontmatterAndBody(raw);
      return {
        slug: candidate,
        title: frontmatter.title || candidate,
        date: frontmatter.date || '',
        content: body,
      };
    }
  }
  return null;
}