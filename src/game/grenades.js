import * as THREE from 'three'
import { U, MOVE, D2R } from './constants'
import { game, emit, eyePos, viewDir } from './state'
import { armorDamage, applyDamage } from './combat'
import { sphereHits, lineClear } from '../world/collision'

/* Grenades after CS:GO: thrown at 750 u/s scaled by how hard you throw, 40%
   gravity, bouncy, with the game's fuse times and radii. */

const R = 0.06
const GRAVITY = MOVE.sv_gravity * 0.4
const HE_DAMAGE = 98, HE_RADIUS = 350 * U
const SMOKE_RADIUS = 144 * U, SMOKE_TIME = 18

export function throwGrenade(a, type, eye, dir, strength = 1) {
  // the game lifts the throw by up to 10 degrees, less the more you look up
  const pitchDeg = a.pitch / D2R
  const lift = (10 * (90 - Math.abs(pitchDeg))) / 90
  const d = viewDir(a.yaw, (pitchDeg + lift) * D2R)
  const speed = 750 * U * THREE.MathUtils.clamp(strength * 0.7 + 0.3, 0.3, 1)
  const vel = d.multiplyScalar(speed).addScaledVector(a.vel, 1.25)
  const pos = eye.clone().addScaledVector(dir, 0.25)
  pos.y -= 0.1
  game.grenades.push({
    id: Math.random(), type, pos, vel, thrower: a, team: a.team,
    t0: game.time, still: 0, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
    rot: new THREE.Euler(),
  })
  emit('throw', { agent: a, type })
}

function inside(x, y, z) {
  return sphereHits(x, y, z, R)
}

export function updateGrenades(dt) {
  const list = game.grenades
  for (let i = list.length - 1; i >= 0; i--) {
    const g = list[i]
    const steps = 3
    const h = dt / steps
    for (let s = 0; s < steps; s++) {
      g.vel.y -= GRAVITY * h
      let bounced = false
      for (const axis of ['x', 'y', 'z']) {
        const prev = g.pos[axis]
        g.pos[axis] += g.vel[axis] * h
        if (inside(g.pos.x, g.pos.y, g.pos.z)) {
          g.pos[axis] = prev
          const speed = Math.abs(g.vel[axis])
          g.vel[axis] *= -0.45
          // skid along the surface it hit
          for (const o of ['x', 'y', 'z']) if (o !== axis) g.vel[o] *= 0.75
          if (speed > 1.2) bounced = true
        }
      }
      if (bounced) emit('grenadeBounce', { pos: g.pos.clone(), type: g.type })
    }
    g.rot.x += g.spin.x * dt * 10 * Math.min(1, g.vel.length())
    g.rot.z += g.spin.z * dt * 10 * Math.min(1, g.vel.length())

    const age = game.time - g.t0
    const speed = g.vel.length()
    g.still = speed < 0.25 ? g.still + dt : 0
    let boom = false
    if (g.type === 'he' || g.type === 'flash') boom = age >= 1.6
    else if (g.type === 'smoke') boom = (age >= 1.5 && g.still > 0.3) || age > 8
    if (!boom) continue
    list.splice(i, 1)
    detonate(g)
  }

  // smokes fade out
  for (let i = game.smokes.length - 1; i >= 0; i--) {
    if (game.time > game.smokes[i].end + 2) game.smokes.splice(i, 1)
  }
}

const _eye = new THREE.Vector3()
const _dir = new THREE.Vector3()
function detonate(g) {
  const p = g.pos
  if (g.type === 'he') {
    emit('explode', { pos: p.clone(), type: 'he' })
    for (const a of game.agents) {
      if (!a.alive) continue
      const cx = a.pos.x, cy = a.pos.y + 1.0, cz = a.pos.z
      const d = Math.hypot(cx - p.x, cy - p.y, cz - p.z)
      if (d > HE_RADIUS) continue
      if (!lineClear(p.x, p.y + 0.1, p.z, cx, cy, cz)) continue
      const falloff = Math.pow(1 - d / HE_RADIUS, 1.4)
      const [hp, ap] = armorDamage(HE_DAMAGE * falloff, a, 'chest', 1.15)
      if (hp < 1) continue
      applyDamage(a, g.thrower, hp, ap, { weapon: 'he', group: 'chest', dir: new THREE.Vector3(cx - p.x, 0, cz - p.z).normalize() })
    }
  } else if (g.type === 'flash') {
    emit('explode', { pos: p.clone(), type: 'flash' })
    for (const a of game.agents) {
      if (!a.alive) continue
      eyePos(a, _eye)
      if (!lineClear(p.x, p.y + 0.05, p.z, _eye.x, _eye.y, _eye.z)) continue
      const dist = _eye.distanceTo(p)
      viewDir(a.yaw, a.pitch, _dir)
      const to = p.clone().sub(_eye).normalize()
      const dot = _dir.dot(to)
      // looking at it: full; side-on: partial; facing away: a short flash
      let strength = dot > 0.6 ? 1 : dot > 0 ? 0.35 + dot : 0.2
      strength *= THREE.MathUtils.clamp(1 - (dist - 8) / 30, 0.15, 1)
      const dur = 4.9 * strength
      if (dur < 0.3) continue
      a.flashUntil = Math.max(a.flashUntil, game.time + dur)
      a.flashAmount = Math.max(a.flashAmount, strength)
      a.flashStart = game.time
      if (a === game.local) emit('flashed', { amount: strength, dur })
    }
  } else if (g.type === 'smoke') {
    game.smokes.push({ id: Math.random(), pos: p.clone(), start: game.time, end: game.time + SMOKE_TIME })
    emit('explode', { pos: p.clone(), type: 'smoke' })
  }
}

/** Radius of a smoke at the current time (it blooms, holds, then thins). */
export function smokeRadius(s) {
  const t = game.time - s.start
  const grow = THREE.MathUtils.clamp(t / 1.2, 0, 1)
  const fade = THREE.MathUtils.clamp((s.end - game.time) / 2, 0, 1)
  return SMOKE_RADIUS * grow * (0.4 + 0.6 * fade)
}

/** Does the segment a->b pass through a live smoke? */
export function smokeBlocks(a, b) {
  for (const s of game.smokes) {
    const r = smokeRadius(s) * 0.92
    if (r < 0.5) continue
    // distance from s.pos to segment
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z
    const apx = s.pos.x - a.x, apy = s.pos.y + 1 - a.y, apz = s.pos.z - a.z
    const len2 = abx * abx + aby * aby + abz * abz
    const t = len2 > 0 ? THREE.MathUtils.clamp((apx * abx + apy * aby + apz * abz) / len2, 0, 1) : 0
    const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t
    if (dx * dx + dy * dy * 0.6 + dz * dz < r * r) return true
  }
  return false
}
