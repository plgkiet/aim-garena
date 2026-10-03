import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, advance } from '@react-three/fiber'
import * as THREE from 'three'
import { Map } from './world/Map'
import { GameLoop } from './game/GameLoop'
import { Characters } from './view/Characters'
import { Effects } from './view/Effects'
import { Impacts } from './view/Impacts'
import { Viewmodel } from './view/Viewmodel'
import { Hud } from './ui/Hud'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { game } from './game/state'
import { canBuy, startMatch } from './game/rules'
import { W } from './game/weapons'
import { switchTo } from './game/weaponLogic'
import * as collision from './world/collision'
import { level, loadLevel } from './world/level'
import * as nav from './game/nav'
import * as movement from './game/movement'
import { hfovToVfov, BASE_FOV } from './game/constants'
import { KNIVES } from './lib/knives'
import { MOVES } from './lib/moves'
import { setMuted, isMuted, unlockAudio } from './lib/audio'
import './skins/earn'
import './styles.css'

export default function App() {
  const [locked, setLocked] = useState(false)
  const [glLost, setGlLost] = useState(false)
  const canvasWrap = useRef(null)

  const requestLock = useCallback(() => {
    unlockAudio()
    game.buyOpen = false
    const el = canvasWrap.current?.querySelector('canvas')
    try { el?.requestPointerLock?.()?.catch?.(() => {}) } catch { /* needs a gesture */ }
  }, [])

  const onLockChange = useCallback(v => {
    setLocked(v)
    const playing = game.phase !== 'menu' && game.phase !== 'matchEnd'
    game.paused = !v && !game.buyOpen && playing
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) {
      window.KNIVES = KNIVES; window.MOVES = MOVES; window.__game = game
      // step the render loop by hand (a hidden tab gets no animation frames)
      let t = performance.now()
      window.__step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) { t += dt * 1000; advance(t) } }
      // test harness: start a match with a faked pointer lock, frozen, holding `weapon`
      window.__dev = {
        start(opts = {}) {
          startMatch({ team: 'CT', difficulty: 'normal', maxRounds: 16, teamSize: 5, sensitivity: 2, ...opts })
          const cv = document.querySelector('canvas')
          Object.defineProperty(document, 'pointerLockElement', { get: () => (window.__fakeLock ? cv : null), configurable: true })
          window.__fakeLock = true
          document.dispatchEvent(new Event('pointerlockchange'))
        },
        gun(id, frames = 90) {
          const me = game.local
          const slot = W[id].slot
          if (slot === 4) me.inv[4] = [{ id }]
          else if (slot === 5) me.inv[5] = { id }
          else if (slot !== 3) me.inv[slot] = { id, clip: W[id].clip, reserve: W[id].reserve }
          me.active = -1
          switchTo(me, slot)
          window.__step(frames)
        },
        freeze(v = true) { game.devFreeze = v },
        collision, level, nav, movement, loadLevel,
      }
    }
  }, [])

  useEffect(() => {
    const onKey = e => {
      if (e.repeat) return
      if (e.code === 'KeyM') setMuted(!isMuted())
      if (e.code === 'KeyB' && game.local && game.locked && !game.buyOpen && canBuy(game.local)) {
        game.buyOpen = true
        document.exitPointerLock?.()
      }
      if (e.code === 'Tab' && game.locked) e.preventDefault()
    }
    const noMenu = e => e.preventDefault()
    window.addEventListener('keydown', onKey)
    window.addEventListener('contextmenu', noMenu)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('contextmenu', noMenu)
    }
  }, [])

  return (
    <div className="app" ref={canvasWrap}>
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ fov: hfovToVfov(BASE_FOV), near: 0.05, far: 260, position: [0, 20, 30] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          // the GPU dropped the context (driver reset, too many WebGL pages
          // open): let the browser restore it, and say so instead of a frozen
          // white canvas; if it does not come back, offer a reload
          const cv = gl.domElement
          cv.addEventListener('webglcontextlost', e => { e.preventDefault(); console.error('WebGL context lost'); setGlLost(true) })
          // a restored context comes back with the map's textures gone (a white
          // world), so the overlay stays up and the way out is a reload
          cv.addEventListener('webglcontextrestored', () => console.info('WebGL context restored'))
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          scene.fog = new THREE.Fog('#d9c7a2', 60, 190)
          scene.background = new THREE.Color('#cbb489')
        }}
        onPointerDown={() => { if (game.phase !== 'menu' && game.phase !== 'matchEnd' && !game.buyOpen) requestLock() }}
      >
        <GameLoop onLockChange={onLockChange} />
        {/* each part loads and fails on its own: a model that is slow or
            fails to load must not blank the map, nor take the gun with it */}
        <ErrorBoundary name="map" fallback={null}><Suspense fallback={null}><Map /></Suspense></ErrorBoundary>
        <ErrorBoundary name="characters" fallback={null}><Suspense fallback={null}><Characters /></Suspense></ErrorBoundary>
        <ErrorBoundary name="effects" fallback={null}><Suspense fallback={null}><Effects /><Impacts /></Suspense></ErrorBoundary>
        <ErrorBoundary name="viewmodel" fallback={null}><Suspense fallback={null}><Viewmodel /></Suspense></ErrorBoundary>
      </Canvas>
      <ErrorBoundary name="hud"><Hud locked={locked} onRequestLock={requestLock} /></ErrorBoundary>
      {glLost && (
        <div className="crash">
          <div className="crash__box">
            <h2>Mất đồ hoạ</h2>
            <p>Trình duyệt vừa ngắt WebGL của game (thường do mở quá nhiều trang/tab 3D cùng lúc, hoặc card đồ hoạ bị reset), nên màn hình sẽ trắng. Tải lại trang để chơi tiếp — kho đồ vẫn được giữ nguyên.</p>
            <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
          </div>
        </div>
      )}
    </div>
  )
}
