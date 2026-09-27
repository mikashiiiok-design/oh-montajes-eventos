import { useEffect } from 'react'
import { ArrowUpRight, Mail, Wrench } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'
import './MaintenancePage.css'

function MaintenancePage() {
  useEffect(() => {
    document.title = 'En mantenimiento | OH Montajes y Eventos'
    const robotsMeta = document.createElement('meta')
    robotsMeta.name = 'robots'
    robotsMeta.content = 'noindex, nofollow'
    document.head.append(robotsMeta)

    return () => robotsMeta.remove()
  }, [])

  return (
    <main className="maintenance-page">
      <header className="maintenance-header">
        <a className="maintenance-brand" href="/" aria-label="OH Montajes y Eventos">
          <img src={companyLogo} alt="OH Montajes y Eventos" />
        </a>
        <span className="maintenance-reference">OH MONTAJES / EN PROCESO</span>
      </header>

      <section className="maintenance-content" aria-labelledby="maintenance-title">
        <div className="maintenance-art" aria-hidden="true">
          <span className="maintenance-art-index">OH&nbsp; / &nbsp;01</span>
          <div className="maintenance-art-mark"><Wrench size={58} strokeWidth={1.2} /></div>
          <span className="maintenance-art-caption">DISEÑANDO LO QUE SIGUE</span>
        </div>

        <div className="maintenance-copy">
          <p className="maintenance-eyebrow"><span />VOLVEMOS EN UN MOMENTO</p>
          <h1 id="maintenance-title">Estamos<br />preparando<br /><span>la siguiente escena.</span></h1>
          <p className="maintenance-description">
            Estamos realizando algunos ajustes para ofrecerte una mejor experiencia.
            Nuestro sitio volverá a estar disponible pronto.
          </p>
          <a className="maintenance-contact" href="mailto:ayuda@ohmontajesyeventos.com">
            <Mail size={17} />
            <span>Contactar al equipo</span>
            <ArrowUpRight size={16} />
          </a>
        </div>
      </section>

      <footer className="maintenance-footer">
        <span>OH MONTAJES Y EVENTOS</span>
        <span>Ideas en escena <span className="maintenance-footer-dot">●</span> Colombia</span>
      </footer>
    </main>
  )
}

export default MaintenancePage