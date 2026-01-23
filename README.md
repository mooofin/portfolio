# Portfolio

This is my personal portfolio website built with React and Vite. The site features a video background with custom UI components and a blog section for writeups and technical posts.

The entire project runs on Bun for package management and development. All build and dev scripts use Bun instead of npm or yarn for faster installation and execution times.

The blog system uses a simple markdown file approach where posts are stored in the src/posts directory. Each post includes frontmatter for metadata like title and date. The posts are loaded dynamically at runtime using Vite's import.meta.glob feature.

The site has a custom pink cursor animation that follows mouse movement with smooth easing. Desktop icons on the homepage link to different sections including an About page, Music page, Blog, and an external Poetry blog hosted on Bear Blog.

Styling is mostly done through vanilla CSS with some performance optimizations applied. The video background component handles the main visual element with proper aspect ratio handling and playback controls.

Deployment happens automatically through Vercel whenever changes are pushed to the main branch. The vercel.json config handles SPA routing by rewriting all non-file paths to index.html.

## Development

Run the dev server with hot reload:
```
bun run dev
```

Build for production:
```
bun run build
```

Preview the production build locally:
```
bun run preview
```

## Tech Stack

Built with React 19, React Router for navigation, and Vite as the build tool. Uses React Three Fiber and postprocessing for any 3D elements. Markdown rendering is handled by react-markdown with remark-gfm for GitHub-flavored markdown support. Code syntax highlighting comes from react-syntax-highlighter with Prism themes.
