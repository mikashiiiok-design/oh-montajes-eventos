import { ArrowUpRight } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'
import { scrollToTop } from '../utils/scrollToTop.js'

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell footer-main">
        <a className="brand footer-brand" href="#inicio" onClick={scrollToTop} aria-label="OH Montajes y Eventos, volver al inicio">
          <img className="brand-logo footer-logo" src={companyLogo} alt="Logo de OH Montajes y Eventos" />
        </a>
        <p>© {new Date().getFullYear()} - OH Montajes y Eventos SAS</p>
        <a className="back-top" href="#inicio" onClick={scrollToTop}>Volver arriba <ArrowUpRight size={16} /></a>
      </div>
      <div className="page-shell footer-bottom">
        <span>Made with ❤ by Carlos Hidalgo</span>
        <div className="footer-legal-links">
          <a href="/terminos-y-condiciones">Términos y condiciones</a>
          <a href="/terminos-de-servicio">Términos de uso</a>
        </div>
        <span>Medellín, Colombia</span>
        <a className="footer-contact" href="#contacto">Contacto <ArrowUpRight size={14} /></a>
      </div>
    </footer>
  )
}

export default SiteFooter