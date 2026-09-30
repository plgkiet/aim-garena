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
import { game } from './game/state'
import { canBuy, startMatch } from './game/rules'
import { W } from './game/weapons'
import { switchTo } from './game/weaponLogic'
import * as collision from './world/collision'
import { level } from './world/level'
import * as nav from './game/nav'
import { hfovToVfov, BASE_FOV } from './game/constants'
import { KNIVES } from './lib/knives'
import { MOVES } from './lib/moves'
import { setMuted, isMuted, unlockAudio } from './lib/audio'
import './skins/earn'
import './styles.css'

export default function App() {
  const [locked, setLocked] = useState(false)
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
      window.KNIVES = KNIVES; window.MOVES = MOVES
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
        collision, level, nav,
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
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          scene.fog = new THREE.Fog('#d9c7a2', 60, 190)
          scene.background = new THREE.Color('#cbb489')
        }}
        onPointerDown={() => { if (game.phase !== 'menu' && game.phase !== 'matchEnd' && !game.buyOpen) requestLock() }}
      >
        <GameLoop onLockChange={onLockChange} />
        <Suspense fallback={null}>
          <Map />
          <Characters />
          <Effects />
          <Impacts />
          <Viewmodel />
        </Suspense>
      </Canvas>
      <Hud locked={locked} onRequestLock={requestLock} />
    </div>
  )
}
