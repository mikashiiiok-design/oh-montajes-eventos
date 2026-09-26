import { useLayoutEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import SiteHeader from './components/SiteHeader.jsx'
import HeroSection from './components/HeroSection.jsx'
import ProjectSection from './components/ProjectSection.jsx'
import ServicesSection from './components/ServicesSection.jsx'
import AboutSection from './components/AboutSection.jsx'
import ContactSection from './components/ContactSection.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import PageLoader from './components/PageLoader.jsx'
import ErrorPage from './components/ErrorPage.jsx'
import AccountPage from './components/AccountPage.jsx'
import AccountAdminPage from './components/AccountAdminPage.jsx'
import GalleryPage from './components/GalleryPage.jsx'
import LegalPage from './components/LegalPage.jsx'
import { useScrollReveal } from './hooks/useScrollReveal.js'
import { useSmoothAnchorNavigation } from './hooks/useSmoothAnchorNavigation.js'
import './portfolio.css'

const THEME_STORAGE_KEY = 'oh-theme'

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function PortfolioApp({ pageContent }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useScrollReveal()
  useSmoothAnchorNavigation()

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  function handleToggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    const updateTheme = () => flushSync(() => setTheme(nextTheme))

    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(updateTheme)
      return
    }

    setTheme(nextTheme)
  }

  return (
    <>
      <SiteHeader theme={theme} onToggleTheme={handleToggleTheme} />
      <main>
        {pageContent ?? (
          <>
            <HeroSection />
            <ProjectSection />
            <ServicesSection />
            <AboutSection />
            <ContactSection />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'

  if (pathname === '/404') return <><PageLoader /><ErrorPage statusCode={404} /></>
  if (pathname === '/500') return <><PageLoader /><ErrorPage statusCode={500} /></>
  if (pathname === '/cuenta/administracion') return <><PageLoader /><AccountAdminPage /></>
  if (pathname === '/cuenta') return <><PageLoader /><AccountPage /></>
  if (pathname === '/terminos-y-condiciones') return <><PageLoader /><LegalPage variant="terms" /></>
  if (pathname === '/terminos-de-servicio') return <><PageLoader /><LegalPage variant="service" /></>
  if (pathname === '/galeria') return <><PageLoader /><PortfolioApp pageContent={<GalleryPage />} /></>
  if (pathname !== '/' && pathname !== '/index.html') return <><PageLoader /><ErrorPage statusCode={404} /></>

  return <><PageLoader /><PortfolioApp /></>
}

export default App