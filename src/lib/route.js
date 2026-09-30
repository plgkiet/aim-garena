import { useEffect, useState } from 'react'

/* The menu screens live at their own paths — / for the menu, /spin for the
   case, /inventory for the inventory — so a screen can be linked, reloaded
   and left with the browser's back button. Plain History API; no router. */

const PATHS = { menu: '/', case: '/spin', inventory: '/inventory' }
const SCREEN_OF = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [v, k]))

const screenOf = path => SCREEN_OF[path.replace(/\/+$/, '') || '/'] || 'menu'

export function useScreen() {
  const [screen, setScreen] = useState(() => screenOf(window.location.pathname))
  useEffect(() => {
    const onPop = () => setScreen(screenOf(window.location.pathname))
    window.addEventListener('popstate', onPop)
    // an unknown path falls back to the menu, and the address bar says so
    if (!SCREEN_OF[window.location.pathname.replace(/\/+$/, '') || '/']) window.history.replaceState(null, '', PATHS.menu)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = next => {
    if (next === screen) return
    window.history.pushState(null, '', PATHS[next])
    setScreen(next)
  }
  return [screen, go]
}

/** Put the address bar back on / (entering a match from a menu screen). */
export function resetPath() {
  if (window.location.pathname !== '/') window.history.replaceState(null, '', '/')
}
