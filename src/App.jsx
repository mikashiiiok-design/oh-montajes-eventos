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
import { useScrollReveal } from './hooks/useScrollReveal.js'
import { useSmoothAnchorNavigation } from './hooks/useSmoothAnchorNavigation.js'
import './portfolio.css'

const THEME_STORAGE_KEY = 'oh-theme'

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function PortfolioApp() {
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
      <PageLoader />
      <SiteHeader theme={theme} onToggleTheme={handleToggleTheme} />
      <main>
        <HeroSection />
        <ProjectSection />
        <ServicesSection />
        <AboutSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  )
}

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  const isReservedErrorPath = pathname === '/404' || pathname === '/500'

  useLayoutEffect(() => {
    if (isReservedErrorPath) window.history.replaceState(null, '', '/')
  }, [isReservedErrorPath])

  if (isReservedErrorPath) return <PortfolioApp />
  if (pathname === '/cuenta') return <AccountPage />
  if (pathname === '/galeria') return <ErrorPage statusCode={503} />
  if (pathname !== '/' && pathname !== '/index.html') return <ErrorPage statusCode={404} />

  return <PortfolioApp />
}

export default App