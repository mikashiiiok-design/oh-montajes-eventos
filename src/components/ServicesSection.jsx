import { ArrowUpRight } from 'lucide-react'
import { services } from '../data/portfolio.js'

function ServicesSection() {
  return (
    <section className="section services-section" id="servicios" aria-labelledby="services-title">
      <div className="page-shell">
        <div className="section-heading services-heading" data-reveal-stagger>
          <div data-reveal-stagger>
            <p className="eyebrow"><span className="section-index">02</span> Lo que hacemos</p>
            <h2 id="services-title">Del plano<br />al <span className="outlined-word">aplauso.</span></h2>
          </div>
          <p className="section-aside">Un equipo, todas las piezas. Nos implicamos desde la primera conversación hasta que se apagan las luces.</p>
        </div>
        <div className="services-list">
          {services.map((service, index) => (
            <article className="service-row" key={service.number} data-reveal data-reveal-delay={index * 90}>
              <span className="service-number">{service.number}</span>
              <div className="service-main">
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <ul className="service-tags" aria-label={`Especialidades: ${service.tags.join(', ')}`}>
                  {service.tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              </div>
              <a className="service-arrow" href="#contacto" aria-label={`Consultar sobre ${service.title}`}><ArrowUpRight size={21} /></a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ServicesSection