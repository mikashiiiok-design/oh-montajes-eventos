import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'

function ContactSection() {
  return (
    <section className="contact-section" id="contacto" aria-labelledby="contact-title">
      <div className="page-shell contact-inner">
        <div className="contact-copy" data-reveal-stagger>
          <p className="eyebrow"><span className="section-index">04</span> Siguiente paso</p>
          <h2 id="contact-title">¿Qué tienes<br />en mente?</h2>
          <p className="contact-intro">Cuéntanos qué quieres hacer. Nos encantan las ideas en cualquier fase.</p>
          <a className="contact-email" href="mailto:ayuda@ohmontajesyeventos.com">ayuda@ohmontajesyeventos.com <ArrowUpRight size={19} /></a>
        </div>
        <div className="contact-details" data-reveal-stagger>
          <a href="mailto:ayuda@ohmontajesyeventos.com"><Mail size={18} /> ayuda@ohmontajesyeventos.com</a>
          <a href="tel:+3135975526"><Phone size={18} /> +313 597 5526</a>
          <span><MapPin size={18} /> Medellín · En toda Colombia</span>
          <a className="contact-cta" href="mailto:ayuda@ohmontajesyeventos.com?subject=Hablemos%20de%20un%20evento">Empezar una conversación <ArrowUpRight size={17} /></a>
        </div>
        <img className="contact-watermark" src={companyLogo} alt="" aria-hidden="true" />
      </div>
    </section>
  )
}

export default ContactSection