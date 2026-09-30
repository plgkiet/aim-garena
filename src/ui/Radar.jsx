import { useEffect, useRef } from 'react'
import { game } from '../game/state'
import { map } from '../world/mapData'
import { NAV, NAV_CELL } from '../game/nav'

/* The radar: the map baked once to a canvas, players drawn on top every frame.
   Teammates always show; enemies only while someone on your team can see them
   (CS:GO's "spotted"); the bomb shows to Ts, and to everyone once planted. */

const SIZE = 210
let PX = 1, OX = 0, OZ = 0

/* Baked from the bot nav grid: every walkable floor, shaded by height, so the
   radar is the map's real overview and never disagrees with where you can go. */
function bakeMap() {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const g = c.getContext('2d')
  const { NX, NZ, x0, z0, H, walk, NN, LAYERS } = NAV
  const w = NX * NAV_CELL, h = NZ * NAV_CELL
  PX = SIZE / Math.max(w, h)
  OX = x0 + w / 2 - SIZE / PX / 2
  OZ = z0 + h / 2 - SIZE / PX / 2
  let lo = Infinity, hi = -Infinity
  for (let k = 0; k < H.length; k++) if (walk[k]) { lo = Math.min(lo, H[k]); hi = Math.max(hi, H[k]) }
  const cs = NAV_CELL * PX + 0.6
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    let top = -Infinity
    for (let l = 0; l < LAYERS; l++) { const k = l * NN + j * NX + i; if (walk[k] && H[k] > top) top = H[k] }
    if (top === -Infinity) continue
    const t = (top - lo) / Math.max(1, hi - lo)
    g.fillStyle = `rgb(${120 + t * 95 | 0},${112 + t * 85 | 0},${92 + t * 60 | 0})`
    g.fillRect((x0 + i * NAV_CELL - OX) * PX, (z0 + j * NAV_CELL - OZ) * PX, cs, cs)
  }
  for (const s of Object.values(map.SITES)) {
    g.fillStyle = 'rgba(255,90,70,0.18)'
    g.fillRect((s.min[0] - OX) * PX, (s.min[1] - OZ) * PX, (s.max[0] - s.min[0]) * PX, (s.max[1] - s.min[1]) * PX)
    g.fillStyle = 'rgba(255,120,90,0.95)'
    g.font = 'bold 20px "Barlow Condensed", sans-serif'
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(s.name, (s.center[0] - OX) * PX, (s.center[1] - OZ) * PX)
  }
  return c
}

const toX = x => (x - OX) * PX
const toY = z => (z - OZ) * PX


export function Radar() {
  const ref = useRef()
  useEffect(() => {
    let bg = null, bgVersion = -1
    let raf
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = ref.current
      if (!c || !NAV.ready) return
      if (!bg || bgVersion !== NAV.version) { bg = bakeMap(); bgVersion = NAV.version }
      const g = c.getContext('2d')
      g.clearRect(0, 0, SIZE, SIZE)
      g.drawImage(bg, 0, 0)
      const me = game.local
      if (!me) return
      const view = me.alive ? me : (game.spectate || me)
      // bomb
      const b = game.bomb
      if (b && (me.team === 'T' || b.state === 'planted') && b.state !== 'exploded') {
        const blink = b.state === 'planted' ? (Math.sin(performance.now() / 120) > 0) : true
        if (blink) {
          g.fillStyle = b.state === 'planted' ? '#ff4030' : '#ffb13b'
          g.fillRect(toX(b.pos.x) - 4, toY(b.pos.z) - 3, 8, 6)
        }
      }
      for (const a of game.agents) {
        const x = toX(a.pos.x), y = toY(a.pos.z)
        if (!a.alive) {
          if (a.team === me.team && game.time - a.deathTime < 8) {
            g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5
            g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3); g.stroke()
          }
          continue
        }
        const friend = a.team === me.team
        if (!friend && a.spottedUntil < game.time) continue
        const color = a === view ? '#ffffff' : friend ? (a.team === 'CT' ? '#5aa9ff' : '#ffc23d') : '#ff4b3e'
        g.save()
        g.translate(x, y)
        g.rotate(-a.yaw)
        g.fillStyle = color
        g.strokeStyle = 'rgba(0,0,0,0.8)'
        g.lineWidth = 1
        if (a === view) {
          g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath()
          g.fill(); g.stroke()
        } else {
          g.beginPath(); g.arc(0, 0, 3.8, 0, Math.PI * 2); g.fill(); g.stroke()
          g.beginPath(); g.moveTo(0, -7); g.lineTo(2.2, -3.4); g.lineTo(-2.2, -3.4); g.closePath(); g.fill()
        }
        g.restore()
        if (a.inv[5]?.id === 'c4' && me.team === 'T') {
          g.fillStyle = '#ffb13b'; g.fillRect(x + 4, y - 7, 4, 3)
        }
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} width={SIZE} height={SIZE} className="radar" />
}
