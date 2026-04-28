// ABOUTME: Root application component — hash-based four-route shell.
// ABOUTME: Delegates rendering to screen components based on the active route in SessionStore.

import { useSessionStore } from './store/session'
import { useHashRoute } from './lib/router'
import { Home } from './screens/Home'
import { Preview } from './screens/Preview'
import { Effects } from './screens/Effects'
import { Exports } from './screens/Exports'
import { Gallery } from './dev/components-gallery'

export function App() {
  useHashRoute()
  if (typeof window !== 'undefined' && window.location.search.includes('gallery=1')) {
    return <Gallery />
  }
  const route = useSessionStore((s) => s.route)
  switch (route) {
    case 'home':    return <Home />
    case 'preview': return <Preview />
    case 'effects': return <Effects />
    case 'exports': return <Exports />
  }
}
