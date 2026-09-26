import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ClipboardList, LogIn, LogOut, Menu, MessageCircle, Moon, Sun, UserRound, X } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'
import { apiRequest } from '../utils/api.js'
import { scrollToTop } from '../utils/scrollToTop.js'

const navItems = [
  { href: '#trabajos', label: 'Proyectos' },
  { href: '/galeria', label: 'Galería' },
  { href: '#servicios', label: 'Servicios' },
  { href: '#estudio', label: 'Estudio' },
]

function SiteHeader({ theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [account, setAccount] = useState(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountMenuError, setAccountMenuError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const accountMenuRef = useRef(null)
  const accountButtonRef = useRef(null)

  useEffect(() => {
    let isActive = true

    apiRequest('/api/auth/me')
      .then(({ account: activeAccount }) => {
        if (isActive) setAccount(activeAccount)
      })
      .catch(() => {})

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!accountMenuOpen) return undefined

    function handlePointerDown(event) {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setAccountMenuOpen(false)
      accountButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [accountMenuOpen])

  async function handleLogout() {
    setAccountMenuError('')
    setIsLoggingOut(true)

    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      setAccount(null)
      setAccountMenuOpen(false)
    } catch (requestError) {
      setAccountMenuError(requestError.message)
    } finally {
      setIsLoggingOut(false)
    }
  }

  function toggleAccountMenu() {
    setMenuOpen(false)
    setAccountMenuError('')
    setAccountMenuOpen((isOpen) => !isOpen)
  }

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
          <div className="account-menu" ref={accountMenuRef}>
            <button
              ref={accountButtonRef}
              className={`account-trigger${account ? ' is-authenticated' : ''}`}
              type="button"
              aria-expanded={accountMenuOpen}
              aria-controls="account-dropdown"
              aria-label={account ? `Menú de cuenta de ${account.name}` : 'Abrir menú de cuenta'}
              title={account ? account.name : 'Cuenta'}
              onClick={toggleAccountMenu}
            >
              <UserRound size={17} aria-hidden="true" />
              {!account && <span>Cuenta</span>}
            </button>
            {accountMenuOpen && (
              <div className="account-dropdown" id="account-dropdown" aria-label="Opciones de cuenta">
                {account ? (
                  <>
                    <div className="account-dropdown-identity">
                      <span className="account-dropdown-avatar"><UserRound size={18} /></span>
                      <span className="account-dropdown-user">
                        <strong>{account.name}</strong>
                        <span>{account.email}</span>
                      </span>
                    </div>
                    <a href="/cuenta" onClick={() => setAccountMenuOpen(false)}>
                      <UserRound size={16} /> Administrar cuenta
                    </a>
                    <button className="account-dropdown-unavailable" type="button" disabled>
                      <ClipboardList size={16} /> Registro de pedidos <small>Próximamente</small>
                    </button>
                    <button className="account-dropdown-unavailable" type="button" disabled>
                      <MessageCircle size={16} /> Chats <small>Próximamente</small>
                    </button>
                    <div className="account-dropdown-divider" />
                    <button className="account-dropdown-logout" type="button" onClick={handleLogout} disabled={isLoggingOut}>
                      <LogOut size={16} /> {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="account-dropdown-heading">Acceso de clientes</p>
                    <a href="/cuenta?modo=login" onClick={() => setAccountMenuOpen(false)}>
                      <LogIn size={16} /> Iniciar sesión
                    </a>
                    <a href="/cuenta?modo=registro" onClick={() => setAccountMenuOpen(false)}>
                      <UserRound size={16} /> Registrarme
                    </a>
                  </>
                )}
                {accountMenuError && <p className="account-dropdown-error" role="alert">{accountMenuError}</p>}
              </div>
            )}
          </div>
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
            onClick={() => {
              setAccountMenuOpen(false)
              setMenuOpen(!menuOpen)
            }}
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