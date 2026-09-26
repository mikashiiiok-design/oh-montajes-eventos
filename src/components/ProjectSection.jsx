import { ArrowUpRight } from 'lucide-react'
import { projects } from '../data/portfolio.js'

function ProjectSection() {
  return (
    <section className="section projects-section" id="trabajos" aria-labelledby="projects-title">
      <div className="page-shell">
        <div className="section-heading projects-heading" data-reveal-stagger>
          <div data-reveal-stagger>
            <p className="eyebrow"><span className="section-index">01</span> Selección de proyectos</p>
            <h2 id="projects-title">Momentos que<br />se quedan<span className="accent-dot">.</span></h2>
          </div>
          <p className="section-aside">Cada proyecto empieza con una idea. Lo demás es escuchar, imaginar y hacerlo realidad.</p>
        </div>
        <div className="project-grid">
          {projects.map((project, index) => (
            <a className="project-card" href="#contacto" key={project.number} aria-label={`${project.title}, ${project.category}`} data-reveal data-reveal-delay={index * 90}>
              <div className="project-image-wrap">
                <img className="project-image image-reveal" src={project.image} srcSet={project.srcSet} sizes={project.srcSet ? '(max-width: 680px) calc(100vw - 40px), (max-width: 900px) calc(100vw - 64px), 1320px' : undefined} alt={project.alt} loading="lazy" decoding="async" data-image-reveal />
                <span className="project-number">{project.number} <ArrowUpRight size={16} /></span>
              </div>
              <div className="project-caption">
                <div>
                  <p className="project-category">{project.category}</p>
                  <h3>{project.title}</h3>
                </div>
                <span className="project-location">{project.location}</span>
              </div>
            </a>
          ))}
        </div>
        <div className="projects-endnote" data-reveal data-reveal-delay="180"><span>01 — 05</span><span>Una muestra de lo que podemos crear juntos.</span></div>
      </div>
    </section>
  )
}

export default ProjectSection