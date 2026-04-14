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

## Tech Stack

![Astro 5](https://img.shields.io/badge/Astro%205-0C0E14?style=for-the-badge&logo=astro&logoColor=white)
![React 19](https://img.shields.io/badge/React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix%20UI-161618?style=for-the-badge&logo=radix-ui&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide-F87171?style=for-the-badge&logo=lucide&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)
![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-000000?style=for-the-badge&logo=react&logoColor=61DAFB)
![MDX](https://img.shields.io/badge/MDX-1B1F24?style=for-the-badge&logo=mdx&logoColor=white)
![Markdown](https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white)
![KaTeX](https://img.shields.io/badge/KaTeX-31B7B7?style=for-the-badge)
![Pagefind](https://img.shields.io/badge/Pagefind-3949AB?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)
