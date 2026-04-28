// ABOUTME: Hash-based router — syncs window.location.hash to SessionStore route.
// ABOUTME: Use navigate() to push a route; useHashRoute() installs the hash listener.

import { useEffect } from 'react'
import { useSessionStore, type Route } from '../store/session'

export function navigate(route: Route): void {
  useSessionStore.getState().navigate(route)
  if (typeof window !== 'undefined') window.location.hash = `#/${route}`
}

export function useHashRoute(): void {
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.replace(/^#\//, '')
      if (['home', 'preview', 'effects', 'exports'].includes(hash)) {
        useSessionStore.getState().navigate(hash as Route)
      }
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
}
