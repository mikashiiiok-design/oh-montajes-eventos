import { useEffect } from 'react'
import { ArrowUpRight, MessageCircle, Wrench } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'
import './MaintenancePage.css'

const whatsappUrl = 'https://wa.me/573135975526?text=Hola%2C%20necesito%20ayuda%20mientras%20el%20sitio%20est%C3%A1%20en%20mantenimiento.'

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
          <span className="maintenance-art-ring maintenance-art-ring-one" />
          <span className="maintenance-art-ring maintenance-art-ring-two" />
          <span className="maintenance-art-ring maintenance-art-ring-three" />
          <div className="maintenance-art-mark"><Wrench size={58} strokeWidth={1.2} /></div>
          <span className="maintenance-art-caption">DISEÑANDO LO QUE SIGUE</span>
        </div>

        <div className="maintenance-copy">
          <p className="maintenance-eyebrow"><span />VOLVEMOS EN UN MOMENTO</p>
          <h1 id="maintenance-title">Estamos<br />preparando<br /><span>la siguiente escena.</span></h1>
          <p className="maintenance-description">
            Estamos realizando algunos ajustes para ofrecerte una mejor experiencia. Volveremos pronto.
            Si necesitas ayuda durante este mantenimiento, contacta temporalmente al equipo por WhatsApp.
          </p>
          <a className="maintenance-contact" href={whatsappUrl} target="_blank" rel="noreferrer">
            <MessageCircle size={17} />
            <span>Escribir por WhatsApp</span>
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