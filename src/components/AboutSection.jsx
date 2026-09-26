import { ArrowUpRight } from 'lucide-react'
import aboutImage from '../assets/imagen_2026-03-01_163106110.webp'

function AboutSection() {
  return (
    <section className="about-section" id="estudio" aria-labelledby="about-title">
      <div className="about-grid">
        <div className="about-image-wrap" data-reveal>
          <img className="image-reveal" src={aboutImage} alt="Equipo preparando el espacio de un evento antes de la apertura" loading="lazy" decoding="async" data-image-reveal />
          <span className="about-image-caption">En el montaje, todo cuenta.</span>
          <span className="about-image-index">OH / 2025</span>
        </div>
        <div className="about-copy" data-reveal-stagger>
          <p className="eyebrow"><span className="section-index">03</span> Detrás de cada momento</p>
          <h2 id="about-title">Somos de los que hacen que <span>pase.</span></h2>
          <p className="about-lede">Un estudio de producción independiente para marcas, cultura y personas con algo que celebrar.</p>
          <p className="about-body">Pensamos con los pies en el suelo y la cabeza llena de posibilidades. Unimos diseño, oficio y producción para crear experiencias cuidadas de principio a fin, sin perder de vista lo que importa: cómo se vive.</p>
          <a className="text-link about-link" href="#contacto">Conoce al equipo <ArrowUpRight size={17} /></a>
          <div className="about-stats" data-reveal-stagger>
            <div><strong>100<span>%</span></strong><span>Implicados en cada fase</span></div>
            <div><strong>360<span>°</span></strong><span>Producción integral</span></div>
            <div><strong><span>+</span>200</strong><span>Proyectos realizados</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AboutSection