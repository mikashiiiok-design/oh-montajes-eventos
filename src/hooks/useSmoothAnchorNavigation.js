import { useEffect } from 'react'
import { handleInternalAnchorClick } from '../utils/scrollToTop.js'

export function useSmoothAnchorNavigation() {
  useEffect(() => {
    document.addEventListener('click', handleInternalAnchorClick)
    return () => document.removeEventListener('click', handleInternalAnchorClick)
  }, [])
}