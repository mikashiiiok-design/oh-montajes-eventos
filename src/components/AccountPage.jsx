import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, LogOut, UserRound } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'
import AccountRoleBadge from './AccountRoleBadge.jsx'
import { apiRequest } from '../utils/api.js'
import './AccountPage.css'

function AccountPage() {
  const initialMode = new URLSearchParams(window.location.search).get('modo') === 'registro'
    ? 'register'
    : 'login'
  const [mode, setMode] = useState(initialMode)
  const [isModeIndicatorReady, setIsModeIndicatorReady] = useState(false)
  const [account, setAccount] = useState(null)
  const [isChecking, setIsChecking] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Acceso de clientes | OH Montajes y Eventos'
    return () => {
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsModeIndicatorReady(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    let isActive = true

    apiRequest('/api/auth/me')
      .then(({ account: activeAccount }) => {
        if (isActive) setAccount(activeAccount)
      })
      .catch(() => {})
      .finally(() => {
        if (isActive) setIsChecking(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const payload = {
      email: formData.get('email'),
      password: formData.get('password'),
    }
    if (mode === 'register') payload.name = formData.get('name')

    try {
      const result = await apiRequest(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setAccount(result.account)
      setNotice(mode === 'register' ? 'Tu cuenta quedó creada.' : 'Sesión iniciada.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLogout() {
    setError('')
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      setAccount(null)
      setMode('login')
      setNotice('Cerraste sesión.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="account-page">
      <div className="account-topbar">
        <a className="account-brand" href="/" aria-label="OH Montajes y Eventos, inicio">
          <img src={companyLogo} alt="OH Montajes y Eventos" />
        </a>
        <a className="account-back" href="/#contacto"><ArrowLeft size={16} /> Volver al sitio</a>
      </div>

      <div className="account-layout">
        <section className="account-intro" aria-labelledby="account-title">
          <p className="eyebrow"><span className="section-index">OH</span> Atención a clientes</p>
          <h1 id="account-title">Tu próximo evento empieza aquí.</h1>
          <p>Accede a tu cuenta para preparar y dar seguimiento a tus pedidos.</p>
          <a href="/#contacto" className="account-contact-link">¿Prefieres hablar con nosotros? <ArrowUpRight size={16} /></a>
        </section>

        <section className="account-form-panel" aria-label="Acceso de clientes">
          {isChecking ? (
            <p className="account-status" role="status">Comprobando tu sesión…</p>
          ) : account ? (
            <div className="account-session">
              <div className="account-avatar"><UserRound size={22} /></div>
              <p className="account-kicker">Cuenta activa</p>
              <h2>Hola, {account.name}</h2>
              <p className="account-email">{account.email}</p>
              <p className="account-reference">ID de cliente <span>OH-{String(account.id).padStart(6, '0')}</span></p>
              <AccountRoleBadge role={account.role} />
              {notice && <p className="account-notice" role="status">{notice}</p>}
              <div className="account-next-step">
                <p className="account-kicker">Siguiente paso</p>
                <h3>Preparar un pedido</h3>
                <p>Tu cuenta está lista. El formulario de pedidos se habilitará en la siguiente etapa.</p>
              </div>
              {error && <p className="account-error" role="alert">{error}</p>}
              <button className="account-logout" type="button" onClick={handleLogout}>
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          ) : (
            <>
              <p className="account-kicker">Área de clientes</p>
              <h2>{mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
              <p className="account-form-intro">Guarda tus datos para organizar tu próximo evento.</p>

              <div className="account-mode" data-mode={mode} data-indicator-ready={isModeIndicatorReady} role="tablist" aria-label="Acceso a cuenta">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  className={mode === 'login' ? 'is-selected' : ''}
                  onClick={() => { setMode('login'); setError(''); setNotice('') }}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  className={mode === 'register' ? 'is-selected' : ''}
                  onClick={() => { setMode('register'); setError(''); setNotice('') }}
                >
                  Registrarme
                </button>
              </div>

              <form className="account-form" key={mode} onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <label>
                    Nombre completo
                    <input autoComplete="name" maxLength={100} minLength={2} name="name" required />
                  </label>
                )}
                <label>
                  Correo electrónico
                  <input autoComplete="email" maxLength={254} name="email" required type="email" />
                </label>
                <label>
                  Contraseña
                  <input
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    maxLength={128}
                    minLength={mode === 'register' ? 12 : 1}
                    name="password"
                    required
                    type="password"
                  />
                  {mode === 'register' && <span className="account-hint">Mínimo 12 caracteres.</span>}
                </label>
                {error && <p className="account-error" role="alert">{error}</p>}
                {notice && <p className="account-notice" role="status">{notice}</p>}
                <button className="account-submit" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Un momento…' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
                  {!isSubmitting && <ArrowUpRight size={17} />}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
      <footer className="account-footer">OH Montajes y Eventos <span>Medellín · Colombia</span></footer>
    </main>
  )
}

export default AccountPage