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
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)
![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-000000?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vanilla CSS](https://img.shields.io/badge/Vanilla%20CSS-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Markdown](https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white)
![MDX](https://img.shields.io/badge/MDX-1B1F24?style=for-the-badge&logo=mdx&logoColor=white)
![Remark GFM](https://img.shields.io/badge/Remark--GFM-333333?style=for-the-badge)
