import { useEffect } from 'react'
import { ArrowLeft, ArrowUpRight, RotateCcw } from 'lucide-react'
import companyLogo from '../assets/LOGO-OH.webp'

const errorContent = {
  400: {
    code: '400',
    label: 'SOLICITUD INVÁLIDA',
    title: <>No pudimos<br />procesar esto.</>,
    description: 'Revisa la información enviada e inténtalo de nuevo.',
    action: 'Volver al inicio',
  },
  401: {
    code: '401',
    label: 'ACCESO REQUERIDO',
    title: <>Necesitas<br />identificarte.</>,
    description: 'Este contenido requiere una sesión válida.',
    action: 'Volver al inicio',
  },
  403: {
    code: '403',
    label: 'ACCESO RESTRINGIDO',
    title: <>No tienes permiso<br />para pasar.</>,
    description: 'No tienes autorización para acceder a este contenido.',
    action: 'Volver al inicio',
  },
  404: {
    code: '404',
    label: 'PÁGINA NO ENCONTRADA',
    title: <>Esta página<br />no está en escena.</>,
    description: 'La dirección que buscas no existe o ha cambiado.',
    action: 'Volver al inicio',
  },
  408: {
    code: '408',
    label: 'TIEMPO AGOTADO',
    title: <>La espera se alargó<br />demasiado.</>,
    description: 'La solicitud tardó más de lo esperado. Prueba de nuevo.',
    action: 'Reintentar',
  },
  410: {
    code: '410',
    label: 'CONTENIDO RETIRADO',
    title: <>Esta página ya<br />no está disponible.</>,
    description: 'El contenido se ha retirado y ya no se puede consultar.',
    action: 'Volver al inicio',
  },
  429: {
    code: '429',
    label: 'DEMASIADAS SOLICITUDES',
    title: <>Vamos demasiado<br />deprisa.</>,
    description: 'Se han realizado demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
    action: 'Reintentar',
  },
  500: {
    code: '500',
    label: 'ERROR DEL SERVIDOR',
    title: <>Algo salió<br />de guion.</>,
    description: 'Ha ocurrido un problema inesperado. Inténtalo de nuevo o vuelve al inicio.',
    action: 'Reintentar',
  },
  502: {
    code: '502',
    label: 'RESPUESTA NO VÁLIDA',
    title: <>La conexión no<br />ha respondido.</>,
    description: 'El servidor recibió una respuesta inesperada. Prueba de nuevo en unos instantes.',
    action: 'Reintentar',
  },
  503: {
    code: '503',
    label: 'SERVICIO NO DISPONIBLE',
    title: <>Estamos fuera<br />de escena.</>,
    description: 'El servicio no está disponible temporalmente. Vuelve a intentarlo más tarde.',
    action: 'Reintentar',
  },
  504: {
    code: '504',
    label: 'TIEMPO DE RESPUESTA AGOTADO',
    title: <>No llegó respuesta<br />a tiempo.</>,
    description: 'El servidor tardó demasiado en responder. Prueba de nuevo.',
    action: 'Reintentar',
  },
}

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504])

function ErrorPage({ statusCode = 500 }) {
  const content = errorContent[statusCode] ?? errorContent[500]
  const canRetry = retryableStatuses.has(statusCode)

  useEffect(() => {
    document.title = `${content.code} | OH Montajes y Eventos`
    const robotsMeta = document.createElement('meta')
    robotsMeta.name = 'robots'
    robotsMeta.content = 'noindex, nofollow'
    document.head.append(robotsMeta)

    return () => {
      document.title = 'OH Montajes y Eventos — Producción con intención'
      robotsMeta.remove()
    }
  }, [content.code])

  return (
    <main className={`error-page error-page-${content.code}`}>
      <header className="error-header">
        <a className="error-brand" href="/" aria-label="OH Montajes y Eventos, inicio">
          <img className="error-logo" src={companyLogo} alt="OH Montajes y Eventos" />
        </a>
        <span className="error-reference">OH MONTAJES / ERROR {content.code}</span>
      </header>

      <div className="error-layout">
        <p className="error-code" aria-hidden="true">{content.code}<span>.</span></p>
        <div className="error-copy">
          <p className="eyebrow error-eyebrow"><span className="eyebrow-dot" />{content.label}</p>
          <h1>{content.title}</h1>
          <p className="error-description">{content.description}</p>
          <div className="error-actions">
            {canRetry ? (
              <button className="button error-primary" type="button" onClick={() => window.location.reload()}>
                {content.action}<RotateCcw size={17} />
              </button>
            ) : (
              <a className="button error-primary" href="/">
                <ArrowLeft size={17} />{content.action}
              </a>
            )}
            <a className="text-link error-secondary-link" href={canRetry ? '/' : '/#contacto'}>
              {canRetry ? 'Volver al inicio' : 'Hablar con el equipo'}<ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </div>

      <footer className="error-footer">
        <span>OH MONTAJES Y EVENTOS</span>
        <span>Ideas en escena</span>
      </footer>
    </main>
  )
}

export default ErrorPage