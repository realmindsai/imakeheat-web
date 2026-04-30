// ABOUTME: Root application component — hash-based four-route shell.
// ABOUTME: Delegates rendering to screen components based on the active route in SessionStore.

import { useEffect, useState } from 'react'
import { useSessionStore } from './store/session'
import { useHashRoute } from './lib/router'
import { engine } from './audio/engine'
import { Home } from './screens/Home'
import { Preview } from './screens/Preview'
import { Effects } from './screens/Effects'
import { Exports } from './screens/Exports'
import { Gallery } from './dev/components-gallery'

export function App() {
  useHashRoute()
  const [hydrated, setHydrated] = useState(() => useSessionStore.persist.hasHydrated())
  const engineReady = useSessionStore((s) => s.engineReady)

  // Wait for the persisted chain to hydrate from localStorage before
  // letting the engine rewire itself. Until then, the audio graph stays in
  // the no-slot pass-through state set up by ensureStarted().
  useEffect(() => {
    if (hydrated) return
    const unsub = useSessionStore.persist.onFinishHydration(() => setHydrated(true))
    return unsub
  }, [hydrated])

  // Once hydration AND the engine are both ready, apply the (possibly
  // restored) chain exactly once. Subsequent edits go through the
  // EffectsRack callbacks, which already call engine.rebuildChain().
  useEffect(() => {
    if (!hydrated || !engineReady) return
    engine.rebuildChain(useSessionStore.getState().chain)
  }, [hydrated, engineReady])

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
