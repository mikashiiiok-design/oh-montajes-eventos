export function smoothScrollTo(target) {
  const startPosition = window.scrollY
  const root = document.documentElement
  const scrollPadding = Number.parseFloat(window.getComputedStyle(root).scrollPaddingTop) || 0
  const targetPosition = typeof target === 'number'
    ? target
    : Math.max(0, target.getBoundingClientRect().top + startPosition - scrollPadding)
  const distance = targetPosition - startPosition
  if (Math.abs(distance) < 1) return

  const duration = Math.min(1600, Math.max(750, Math.abs(distance) * 0.24))
  const startedAt = performance.now()
  const previousScrollBehavior = root.style.scrollBehavior
  root.style.scrollBehavior = 'auto'

  function animateScroll(currentTime) {
    const progress = Math.min((currentTime - startedAt) / duration, 1)
    const easedProgress = progress < 0.5
      ? 4 * progress ** 3
      : 1 - ((-2 * progress + 2) ** 3) / 2

    window.scrollTo(0, startPosition + distance * easedProgress)

    if (progress < 1) {
      window.requestAnimationFrame(animateScroll)
    } else {
      root.style.scrollBehavior = previousScrollBehavior
    }
  }

  window.requestAnimationFrame(animateScroll)
}

export function scrollToTop(event) {
  event.preventDefault()
  smoothScrollTo(0)
}

export function handleInternalAnchorClick(event) {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) return

  const source = event.target instanceof Element ? event.target : null
  const link = source?.closest('a[href^="#"]')
  if (!link || link.hasAttribute('download') || link.target === '_blank') return

  let targetId
  try {
    targetId = decodeURIComponent(link.hash.slice(1))
  } catch {
    return
  }

  const target = document.getElementById(targetId)
  if (!target) return

  event.preventDefault()
  if (window.location.hash !== link.hash) {
    window.history.pushState(null, '', link.hash)
  }
  smoothScrollTo(target)
}