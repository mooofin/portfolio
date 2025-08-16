// src/components/Projects.jsx
import React from 'react';

// Data fetched from your GitHub pinned repositories
const projectsData = [
  {
    title: 'God-of-War-Ragnarok',
    description: 'Cheat Engine (CE) scripts, memory manipulation tools, and debugging utilities for modifying the single-player experience.',
    repoLink: 'https://github.com/mooofin/God-of-War-Ragnarok',
  },
  {
    title: 'DS_AnorLondoLightFix',
    description: 'Anor Londo Lighting Fix v1.1 – Enhances Anor Londo\'s lighting by restoring missing light sources and improving shadows.',
    repoLink: 'https://github.com/mooofin/DS_AnorLondoLightFix',
  },
  {
    title: 'EldenRingStutterFix',
    description: 'A Python-based fix for Elden Ring stuttering issues by optimizing CPU affinity. Simple to use and enhances performance.',
    repoLink: 'https://github.com/mooofin/EldenRingStutterFix',
  },
  {
    title: 'Theia-BC',
    description: 'A K-Nearest Neighbors (KNN) classifier to predict breast cancer malignancy based on medical features.',
    repoLink: 'https://github.com/mooofin/Theia-BC',
  },
  {
    title: 'JuliaScope',
    description: 'A high-performance, multithreaded subdomain enumerator written in Julia, leveraging crt.sh for rapid reconnaissance.',
    repoLink: 'https://github.com/mooofin/JuliaScope',
  },
  {
    title: 'Lune-de-Clair-Obscur',
    description: 'This mod represents a comprehensive custom outfit and body overhaul for the character Lune. The project is currently in active development..',
    repoLink: 'https://github.com/mooofin/-Lune-de-Clair-Obscur',
  },
];

function Projects() {
  return (
    <section id="projects" className="projects-section">
      <h2>My Works</h2>
      <div className="projects-grid">
        {projectsData.map((project, index) => (
          <div className="project-card" key={index}>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <div className="project-links">
              <a href={project.repoLink} target="_blank" rel="noopener noreferrer">View on GitHub</a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Projects;
