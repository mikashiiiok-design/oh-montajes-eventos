import { useLayoutEffect } from 'react'

const REVEAL_SELECTOR = [
  'main > section:not(.hero)',
  '.site-footer',
  '[data-reveal]',
].join(', ')

export function useScrollReveal() {
  useLayoutEffect(() => {
    const elements = new Set(document.querySelectorAll(REVEAL_SELECTOR))
    document.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
      const baseDelay = Number(group.dataset.revealDelay) || 0
      const step = Number(group.dataset.revealStep) || 90

      Array.from(group.children).forEach((element, index) => {
        const delay = element.dataset.revealDelay ?? baseDelay + index * step
        element.style.setProperty('--reveal-delay', `${Number(delay)}ms`)
        elements.add(element)
      })
    })

    const revealElements = [...elements]
    revealElements.forEach((element) => {
      element.classList.add('scroll-reveal')

      const delay = Number(element.dataset.revealDelay)
      if (Number.isFinite(delay) && delay > 0) {
        element.style.setProperty('--reveal-delay', `${delay}ms`)
      }
    })

    const imageCleanups = [...document.querySelectorAll('[data-image-reveal]')].map((image) => {
      const revealImage = () => image.classList.add('is-loaded')
      if (image.complete) {
        revealImage()
        return () => {}
      }

      image.addEventListener('load', revealImage, { once: true })
      image.addEventListener('error', revealImage, { once: true })
      return () => {
        image.removeEventListener('load', revealImage)
        image.removeEventListener('error', revealImage)
      }
    })

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'))
      return () => imageCleanups.forEach((cleanup) => cleanup())
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' })

    revealElements.forEach((element) => observer.observe(element))
    return () => {
      observer.disconnect()
      imageCleanups.forEach((cleanup) => cleanup())
    }
  }, [])
}