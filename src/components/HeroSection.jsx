import { ArrowDown, ArrowUpRight } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'

function HeroSection() {
  return (
    <section className="hero" id="inicio" aria-labelledby="hero-title">
      <div className="hero-content page-shell">
        <div className="hero-copy" data-reveal-stagger>
          <p className="eyebrow hero-eyebrow"><span className="eyebrow-dot" /> Diseño · Producción · Montaje</p>
          <h1 id="hero-title">Ideas que<br />se sienten<span className="accent-dot">.</span></h1>
          <div className="hero-bottom">
            <p className="hero-intro">Creamos y producimos eventos con intención, energía y todos los detalles en su sitio.</p>
            <div className="hero-links">
              <a className="button button-light" href="#trabajos">Ver proyectos <ArrowUpRight size={17} /></a>
              <a className="text-link hero-contact-link" href="#contacto">Cuéntanos tu idea</a>
            </div>
          </div>
        </div>
        <figure className="hero-visual">
          <img
            src={companyLogo}
            alt="Logo de OH Montajes y Eventos"
          />
          <figcaption data-reveal data-reveal-delay="180"><span>OH Montajes y Eventos</span><span>Ideas en escena</span></figcaption>
        </figure>
      </div>
      <a className="hero-scroll" href="#trabajos" aria-label="Desplazarse a proyectos" data-reveal data-reveal-delay="240">
        <span>Desliza para explorar</span><ArrowDown size={15} />
      </a>
      <div className="hero-index" aria-hidden="true" data-reveal data-reveal-delay="320">01 / 05</div>
    </section>
  )
}

export default HeroSection