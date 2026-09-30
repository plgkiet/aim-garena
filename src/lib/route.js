import { useEffect, useState } from 'react'

/* The menu screens live at their own paths — / for the menu, /spin for the
   case, /inventory for the inventory, /tradeup for the trade up and
   /item/<drop> for inspecting one drop — so a screen can be linked, reloaded
   and left with the browser's back button. Plain History API; no router. */

const PATHS = { menu: '/', case: '/spin', inventory: '/inventory', tradeup: '/tradeup' }
const SCREEN_OF = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [v, k]))
const ITEM = '/item/'

const clean = path => path.replace(/\/+$/, '') || '/'

/** { screen, param } for a path, or null when nothing lives there. */
function parse(path) {
  const p = clean(path)
  if (p.startsWith(ITEM) && p.length > ITEM.length) return { screen: 'item', param: decodeURIComponent(p.slice(ITEM.length)) }
  return SCREEN_OF[p] ? { screen: SCREEN_OF[p], param: null } : null
}
const pathOf = (screen, param) => (screen === 'item' ? ITEM + encodeURIComponent(param) : PATHS[screen])

export function useScreen() {
  const [at, setAt] = useState(() => parse(window.location.pathname) || { screen: 'menu', param: null })
  useEffect(() => {
    const onPop = () => setAt(parse(window.location.pathname) || { screen: 'menu', param: null })
    window.addEventListener('popstate', onPop)
    // an unknown path falls back to the menu, and the address bar says so
    if (!parse(window.location.pathname)) window.history.replaceState(null, '', PATHS.menu)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = (next, param = null) => {
    if (next === at.screen && param === at.param) return
    window.history.pushState(null, '', pathOf(next, param))
    setAt({ screen: next, param })
  }
  return [at.screen, go, at.param]
}

/** Put the address bar back on / (entering a match from a menu screen). */
export function resetPath() {
  if (window.location.pathname !== '/') window.history.replaceState(null, '', '/')
}
