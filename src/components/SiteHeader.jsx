import { useState } from 'react'
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'
import { scrollToTop } from '../utils/scrollToTop.js'

const navItems = [
  { href: '#trabajos', label: 'Proyectos' },
  { href: '/galeria', label: 'Galería' },
  { href: '#servicios', label: 'Servicios' },
  { href: '#estudio', label: 'Estudio' },
]

function SiteHeader({ theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#inicio" onClick={scrollToTop} aria-label="OH Montajes y Eventos, inicio">
          <img className="brand-logo" src={companyLogo} alt="" />
        </a>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Navegación principal">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
          ))}
          <a className="nav-contact" href="#contacto" onClick={() => setMenuOpen(false)}>
            Hablemos <ArrowUpRight size={15} strokeWidth={1.8} />
          </a>
        </nav>
        <div className="header-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={`Activar modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            title={`Activar modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
    </header>
  )
}

export default SiteHeader