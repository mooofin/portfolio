# Repository Guide

## Repository shape

This repository contains two intentionally different site representations on unrelated Git histories:

- `main` is the current Astro application. Its source is in `src/`, its static assets are in `public/`, and the legacy/static site is kept in `retro/`.
- `gh-pages` is a hand-authored static snapshot. Its pages, styles, scripts, assets, and writeups live at the repository root (`index.html`, `blog/`, `images/`, `style.css`, and `site.js`). It is served directly; there is no Node build step on this branch.

Do not assume that `main` and `gh-pages` can be merged normally: they have no common ancestor. Before editing, confirm the target branch and follow that branch's layout and toolchain.

The remote is `https://github.com/mooofin/portfolio`.

## Branch workflows

### `gh-pages`

Use this branch for direct static-site edits:

```powershell
python run_site.py
```

`run_site.py` serves the repository root and tries ports `8000`, `8001`, `8080`, `3000`, and `5000`. It also opens the site in a browser and serves `404.html` for missing routes.

The main site pages are `index.html`, `about.html`, `projects.html`, `blog.html`, `contact.html`, and `newsletter.html`. Individual articles are under `blog/`. Shared behavior is in `site.js`; shared styling is in `style.css`, with `latex-mode.css` providing the optional LaTeX presentation mode. Keep asset paths relative because the site is also hosted below a GitHub Pages path.

There is no automated test suite for this branch. Validate changes by running the local server, opening the affected route(s), checking browser-console errors, and verifying that all linked images, media, scripts, and styles load. For content changes, check both the article and its listing/link in `blog.html`.

### `main`

Use Bun and Astro for the application branch:

```powershell
bun install
bun run dev
bun run build
bun run preview
bun run lint
```

The scripts are defined in `package.json`. Blog content is primarily Markdown in `src/content/blog/`, with collection/configuration code in `src/content.config.ts`; routes are in `src/pages/`. React/TSX interactive components live in `src/components/`. `astro.config.ts` configures React, MDX, sitemap, icons, Tailwind/Vite, KaTeX, Shiki, and expressive code rendering.

The GitHub Pages workflow on `main` uploads `./retro` directly on pushes to `main`; it does not build Astro first. Vercel configuration is in `vercel.json`. Preserve this distinction when changing deployment behavior.

## Content and style conventions

- Preserve the site's deliberate Windows 95/98 and GeoCities-inspired visual language: pixel-art assets, dense UI chrome, animated decorations, and intentionally playful copy are part of the design.
- Prefer small, localized edits to the existing HTML/CSS/JS patterns. Do not introduce a framework or bundler into `gh-pages`.
- Keep article slugs and asset directory names stable. When adding a static-branch post, update the article file, its media, and the relevant listing/navigation links.
- Preserve accessibility basics already present in the site: meaningful `alt` text for content images, usable links/buttons, and readable contrast.
- External CDN dependencies are used by the site (Win98 icons, KaTeX/LaTeX CSS, and related assets). Avoid replacing them casually; test behavior with and without network access where practical.

## CTF and analysis material

`ctf-writeups/` contains published challenge writeups and selected solver/source files. The root also commonly contains local reverse-engineering scripts, packet captures, binaries, logs, ZIP archives, decoded outputs, and `__pycache__/` files that are not part of the published site.

The current worktree has many such untracked files. Treat them as user-owned: do not delete, reset, clean, or bulk-stage them. Before committing, inspect `git status`, stage only intentional changes, and do not publish flags, secrets, private captures, logs, generated outputs, or challenge artifacts unless explicitly requested.

## Git and change safety

1. Run `git status --short --branch` before editing.
2. Confirm whether the change belongs on `main` or `gh-pages`.
3. Inspect the target branch's existing file and history before copying patterns from the other branch.
4. Make the smallest change that satisfies the request.
5. Run the appropriate local validation above and inspect the final diff.

Do not rewrite history or use destructive cleanup commands to resolve the unrelated branch layout. If a change must be synchronized between branches, port it deliberately and validate each branch independently.
