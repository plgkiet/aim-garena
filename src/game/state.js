import * as THREE from 'three'
import { MOVE } from './constants'

/* Shared, mutable simulation state. Written by the game loop every tick and read
   by the renderers and the HUD — nothing here goes through React state, so the
   canvas never re-renders because a number changed. */

export const game = {
  phase: 'menu',          // menu | warmup | freeze | live | roundEnd | halftime | matchEnd
  time: 0,                // sim seconds since match start
  phaseEnd: 0,            // sim time the current phase runs out
  roundStart: 0,          // sim time the live phase started
  round: 0,
  maxRounds: 30,
  score: { T: 0, CT: 0 },
  lossStreak: { T: 0, CT: 0 },
  roundWinner: null,
  roundReason: '',
  history: [],            // per round: { winner, reason }
  agents: [],
  local: null,
  bomb: null,
  drops: [],              // weapons lying on the ground
  grenades: [],           // in flight
  smokes: [],             // active smoke volumes
  fires: [],              // burning molotov / incendiary patches
  fires: [],
  killfeed: [],
  center: null,           // { text, until } — big centre-screen message
  settings: { team: 'CT', difficulty: 'normal', maxRounds: 30, sensitivity: 2, crosshair: '#4ee36e' },
  paused: false,
  buyOpen: false,
  camera: null,           // the world camera, for projections in the HUD
  spectate: null,         // agent being watched while dead
  flash: 0,               // local blindness 0..1
  flashUntil: 0,
  damageDirs: [],         // recent hits on the local player: { angle, until }
  hitConfirm: -10,
}

/* ------------------------------------------------------------- agents --- */

let nextId = 1
export function makeAgent({ name, team, isBot }) {
  return {
    id: nextId++,
    name, team, isBot,
    alive: false,
    hp: 100, armor: 0, helmet: false, defuser: false,
    money: 800,
    kills: 0, deaths: 0, assists: 0, mvps: 0, score: 0, hs: 0, dmgDone: 0,
    damageBy: new Map(),         // attacker id -> damage this round (for assists)
    hitsBy: new Map(),           // attacker id -> hits this round (for the death recap)

    pos: new THREE.Vector3(),    // feet
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    onGround: true,
    duck: 0,                     // 0 standing .. 1 fully ducked
    ducking: false,
    walking: false,
    lean: 0,                     // -1 full left .. +1 full right
    velMod: 1,                   // CS:GO tagging: slowed after being shot
    stepPhase: 0,
    lastStep: 0,

    // inventory: slots 1..5; slot 4 holds a list of grenades
    inv: { 1: null, 2: null, 3: { id: 'knife' }, 4: [], 5: null },
    active: 3,
    lastActive: 2,

    // weapon state
    w: {
      nextAttack: 0,
      reloadEnd: 0,
      deployEnd: 0,
      shots: 0,               // recoil index
      lastShot: -10,
      punch: { x: 0, y: 0 },  // aim punch, degrees (x yaw right, y pitch up)
      penalty: 0,             // accumulated fire inaccuracy
      zoom: 0,
      ads: false,             // aiming down the sights (non-scoped guns)
      triggerHeld: false,
      throwing: 0,            // grenade pin pulled at
      fireSeq: 0,             // bumps per shot, for the viewmodel
      reloadSeq: 0,
      deploySeq: 0,
      inspectSeq: 0,
      knifeSeq: 0,
      knifeHeavy: false,
      silencer: true,
    },

    // action state
    planting: 0,              // seconds spent planting
    defusing: 0,
    spottedUntil: 0,
    flashUntil: 0,
    flashAmount: 0,
    headPos: new THREE.Vector3(),
    headFromModel: false,
    deathTime: 0,
    deathDir: new THREE.Vector3(),
    killedBy: null,

    bot: null,                // bot brain, see bots.js
  }
}

export function eyeHeight(a) {
  return MOVE.eye + (MOVE.eyeDuck - MOVE.eye) * a.duck
}
export function hullHeight(a) {
  return a.ducking ? MOVE.heightDuck : MOVE.height
}
/** Sideways eye offset of a full lean, PUBG-style (metres). */
export const LEAN_DIST = 0.34
export function eyePos(a, out = new THREE.Vector3()) {
  const l = a.lean || 0
  return out.set(
    a.pos.x + Math.cos(a.yaw) * l * LEAN_DIST,
    a.pos.y + eyeHeight(a) - Math.abs(l) * 0.07,
    a.pos.z - Math.sin(a.yaw) * l * LEAN_DIST,
  )
}
export function viewDir(yaw, pitch, out = new THREE.Vector3()) {
  const cp = Math.cos(pitch)
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
}
export function activeWeapon(a) {
  if (a.active === 4) return a.inv[4][0] || null
  return a.inv[a.active]
}

export const enemiesOf = a => game.agents.filter(b => b.team !== a.team)
export const alive = team => game.agents.filter(a => a.alive && (!team || a.team === team))

/* ------------------------------------------------------------- events --- */

const listeners = new Map()
export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set())
  listeners.get(type).add(fn)
  return () => listeners.get(type).delete(fn)
}
export function emit(type, payload) {
  const set = listeners.get(type)
  if (set) for (const fn of set) fn(payload)
}

export function centerMessage(text, secs = 3, tone = '') {
  game.center = { text, until: game.time + secs, tone }
}

if (import.meta.env.DEV) window.game = game
