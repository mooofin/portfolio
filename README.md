# Portfolio

This is my portfolio website. I recently moved it over to **Astro 5** but kept **React** for all the interactive bits. It's got a custom blog and a Music Space where I track what I'm listening to.

I use **Bun** for everything management-wise because it's fast.

## How it works

The site is pretty simple under the hood. I keep my blog posts as markdown files in `src/content/blog` and let Astro's content collections handle all the heavy lifting so I don't have to deal with a CMS. There's also a Music Space that pulls in my top albums and recent scrobbles from Last.fm. For the visuals, I'm using vanilla CSS for most of the styling, with some React Three Fiber and a custom cursor to keep things feeling snappy. Everything is hosted on Vercel and deploys automatically whenever I push to git.

## Development

Spin up the dev server:
```bash
bun run dev
```

Build it:
```bash
bun run build
```

Check the build locally:
```bash
bun run preview
```

## The Stack

- **Framework**: Astro 5
- **UI**: React 19
- **Graphics**: Three.js / React Three Fiber
- **Styling**: Vanilla CSS
- **Content**: Markdown/MDX with Remark-GFM
