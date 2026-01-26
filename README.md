# Portfolio

This is my portfolio website. It uses React and Vite, with a video background and a custom blog system.

I use Bun for package management and development scripts.

## System Overview

The blog uses markdown files stored in `src/posts`. Vite imports them at runtime using `import.meta.glob`, parsing frontmatter for metadata. This avoids the need for a separate CMS.

The site includes a custom cursor animation and links to my other pages (Music, external Poetry blog). Styling is primarily vanilla CSS for performance.

Deployments are handled by Vercel on git push, with a `vercel.json` config to handle SPA routing.

## Development

Run the dev server:
```bash
bun run dev
```

Build for production:
```bash
bun run build
```

Preview locally:
```bash
bun run preview
```

## Stack

- **Core**: React 19, Vite, React Router
- **Graphics**: React Three Fiber
- **Content**: react-markdown, remark-gfm, react-syntax-highlighter
