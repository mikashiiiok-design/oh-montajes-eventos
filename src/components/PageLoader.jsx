import { useLayoutEffect, useState } from 'react'
import companyLogo from '../assets/LOGO-OH.webp'

function PageLoader() {
  const [isHidden, setIsHidden] = useState(false)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('has-page-loader')
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setIsHidden(true), prefersReducedMotion ? 80 : 950)

    return () => {
      window.clearTimeout(timer)
      root.classList.remove('has-page-loader')
    }
  }, [])

  function handleTransitionEnd(event) {
    if (isHidden && event.propertyName === 'opacity') {
      document.documentElement.classList.remove('has-page-loader')
    }
  }

  return (
    <div className={`page-loader${isHidden ? ' is-hidden' : ''}`} onTransitionEnd={handleTransitionEnd} role="status" aria-label="Cargando OH Montajes y Eventos" aria-hidden={isHidden}>
      <div className="loader-content">
        <img className="loader-logo" src={companyLogo} alt="" />
        <span className="loader-label">OH <span>/</span> MONTAJES Y EVENTOS</span>
        <span className="loader-track" aria-hidden="true"><span /></span>
      </div>
    </div>
  )
}

export default PageLoader