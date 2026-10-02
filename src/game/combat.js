import * as THREE from 'three'
import { U, RULES } from './constants'
import { game, emit, eyeHeight } from './state'
import { W } from './weapons'
import { rayAll } from '../world/collision'
import { PENETRATION } from '../world/mapData'
import { spawnImpact } from '../lib/impacts'

/* Hit groups and the damage multipliers CS:GO applies to them. */
export const HITGROUP = {
  head: { mult: 4, armored: 'helmet' },
  chest: { mult: 1, armored: true },
  stomach: { mult: 1.25, armored: true },
  legs: { mult: 0.75, armored: false },
}

/* Hitboxes as fractions of the hull height: stacked vertical cylinders for the
   body and a sphere for the head. The head follows the rendered model when a
   character renderer reports it (agent.headFromModel), so what you see is
   what you hit. */
const BODY = [
  { g: 'legs', y0: 0, y1: 0.47, r: 0.2 },
  { g: 'stomach', y0: 0.47, y1: 0.6, r: 0.19 },
  { g: 'chest', y0: 0.6, y1: 0.83, r: 0.24 },
]
const HEAD_R = 0.125

function headCenter(a, out) {
  if (a.headFromModel) return out.copy(a.headPos)
  const l = (a.lean || 0) * 0.34
  return out.set(a.pos.x + Math.cos(a.yaw) * l, a.pos.y + eyeHeight(a) + 0.07, a.pos.z - Math.sin(a.yaw) * l)
}
// how far each body section shifts with a full lean (the spine tilts from the hips)
const LEAN_SHIFT = { legs: 0, stomach: 0.05, chest: 0.16 }

const _hc = new THREE.Vector3()
/** Ray vs one agent's hitboxes. Returns { t, group } or null. */
export function rayAgent(o, d, a, maxT) {
  const h = 1.83 - 0.46 * a.duck
  let best = null
  // head sphere
  headCenter(a, _hc)
  {
    const ox = o.x - _hc.x, oy = o.y - _hc.y, oz = o.z - _hc.z
    const b = ox * d.x + oy * d.y + oz * d.z
    const c = ox * ox + oy * oy + oz * oz - HEAD_R * HEAD_R
    const disc = b * b - c
    if (disc >= 0) {
      const t = -b - Math.sqrt(disc)
      if (t >= 0 && t <= maxT) best = { t, group: 'head' }
    }
  }
  // body cylinders
  const dxz = d.x * d.x + d.z * d.z
  for (const s of BODY) {
    const y0 = a.pos.y + s.y0 * h, y1 = a.pos.y + s.y1 * h
    // follow the rendered model when there is one, else the analytic lean
    let cx, cz
    const fromModel = a.headFromModel && (s.g === 'chest' ? a.hitChest : a.hitPelvis)
    if (fromModel) { cx = fromModel[0]; cz = fromModel[1] }
    else {
      const sh = (a.lean || 0) * LEAN_SHIFT[s.g]
      cx = a.pos.x + Math.cos(a.yaw) * sh; cz = a.pos.z - Math.sin(a.yaw) * sh
    }
    const ox = o.x - cx, oz = o.z - cz
    let tIn, tOut
    if (dxz < 1e-9) {
      if (ox * ox + oz * oz > s.r * s.r) continue
      tIn = -Infinity; tOut = Infinity
    } else {
      const b = ox * d.x + oz * d.z
      const c = ox * ox + oz * oz - s.r * s.r
      const disc = b * b - dxz * c
      if (disc < 0) continue
      const sq = Math.sqrt(disc)
      tIn = (-b - sq) / dxz; tOut = (-b + sq) / dxz
    }
    // clip against the slab in y
    if (Math.abs(d.y) < 1e-9) {
      if (o.y < y0 || o.y > y1) continue
    } else {
      let a0 = (y0 - o.y) / d.y, a1 = (y1 - o.y) / d.y
      if (a0 > a1) { const t = a0; a0 = a1; a1 = t }
      tIn = Math.max(tIn, a0); tOut = Math.min(tOut, a1)
    }
    if (tIn > tOut || tOut < 0) continue
    const t = Math.max(0, tIn)
    if (t <= maxT && (!best || t < best.t)) best = { t, group: s.g }
  }
  return best
}

/* ------------------------------------------------------------ damage ---- */

/** CS:GO's armor maths. Returns [healthDamage, armorDamage]. */
export function armorDamage(dmg, victim, group, armorRatio) {
  const hg = HITGROUP[group]
  const protectedHit = victim.armor > 0 &&
    (hg.armored === true || (hg.armored === 'helmet' && victim.helmet))
  if (!protectedHit) return [dmg, 0]
  let hp = dmg * armorRatio * 0.5
  let ap = (dmg - hp) * 0.5
  if (ap > victim.armor) { ap = victim.armor; hp = dmg - ap * 2 }
  return [hp, ap]
}

/**
 * Apply damage and handle the kill.
 * @param {object} info { weapon, group, headshot, penetrated, dir:Vector3, noKnockback }
 */
export function applyDamage(victim, attacker, hp, ap, info) {
  if (!victim.alive) return
  if (attacker && attacker !== victim && attacker.team === victim.team && !RULES.friendlyFire) return
  const dealt = Math.min(victim.hp, Math.round(hp))
  victim.hp -= Math.round(hp)
  victim.armor = Math.max(0, victim.armor - Math.round(ap))
  // tagging: getting shot slows you down
  victim.velMod = Math.min(victim.velMod, info.group === 'legs' ? 0.55 : 0.4)
  if (attacker) {
    attacker.dmgDone += dealt
    victim.damageBy.set(attacker.id, (victim.damageBy.get(attacker.id) || 0) + dealt)
  }
  emit('damage', { victim, attacker, amount: dealt, info })
  if (victim.hp <= 0) killAgent(victim, attacker, info)
}

export function killAgent(victim, attacker, info = {}) {
  victim.hp = 0
  victim.alive = false
  victim.deathTime = game.time
  victim.killedBy = attacker?.id ?? null
  victim.deaths++
  if (info.dir) victim.deathDir.copy(info.dir)
  victim.planting = 0
  victim.defusing = 0

  const weapon = info.weapon || 'world'
  if (attacker && attacker !== victim) {
    if (attacker.team !== victim.team) {
      attacker.kills++
      attacker.score += 2
      if (info.headshot) attacker.hs++
      attacker.money = Math.min(RULES.mp_maxmoney, attacker.money + (W[weapon]?.killAward ?? 300))
    } else {
      attacker.kills--
      attacker.score -= 2
      attacker.money = Math.max(0, attacker.money - 300)
    }
  }
  // assist: anyone else who did 41+ damage this round
  let assister = null
  for (const [id, dmg] of victim.damageBy) {
    if (dmg >= 41 && id !== attacker?.id) {
      const a = game.agents.find(x => x.id === id)
      if (a && a.team !== victim.team) { a.assists++; a.score += 1; assister = a }
    }
  }
  game.killfeed.push({
    t: game.time, killer: attacker && attacker !== victim ? attacker : null, victim, weapon,
    headshot: !!info.headshot, penetrated: !!info.penetrated, assister,
  })
  if (game.killfeed.length > 6) game.killfeed.shift()
  emit('kill', { victim, attacker, info })
}

/* ------------------------------------------------------------ bullets --- */

const _o = new THREE.Vector3()
const _p = new THREE.Vector3()

/**
 * Fire one bullet. Walks the ray through the world and every agent, spending
 * penetration on wood and metal like CS:GO does, and stops at the first player
 * it hits. Returns the end point for the tracer.
 */
export function fireBullet(shooter, origin, dir, weaponId) {
  const w = W[weaponId]
  const maxDist = (w.range ?? 8192) * U
  const world = rayAll(origin, dir, maxDist)

  let dmg = w.damage
  let pen = w.pen ?? 1
  let penetrated = false
  let travelled = 0
  let end = null
  let from = 0                                // distance the bullet is currently at

  // candidate agent hits, sorted
  const bodies = []
  for (const a of game.agents) {
    if (!a.alive || a === shooter) continue
    const h = rayAgent(origin, dir, a, maxDist)
    if (h) bodies.push({ ...h, agent: a })
  }
  bodies.sort((a, b) => a.t - b.t)

  let wi = 0, bi = 0
  while (true) {
    const wh = world[wi], bh = bodies[bi]
    const nextWorld = wh ? wh.t : Infinity
    const nextBody = bh ? bh.t : Infinity
    if (nextWorld === Infinity && nextBody === Infinity) {
      end = _p.copy(origin).addScaledVector(dir, Math.min(maxDist, 120)).clone()
      break
    }
    if (nextBody < nextWorld) {
      bi++
      const a = bh.agent
      travelled = bh.t
      const range = Math.pow(w.rangeMod, travelled / U / 500)
      const base = dmg * range * HITGROUP[bh.group].mult
      const [hp, ap] = armorDamage(base, a, bh.group, w.armorRatio)
      const point = _o.copy(origin).addScaledVector(dir, bh.t).clone()
      spawnImpact({ point, normal: dir.clone().negate(), mat: 'flesh', heavy: bh.group === 'head' })
      if (bh.group === 'head' && a.helmet && a.armor > 0) emit('helmetHit', { agent: a, point })
      applyDamage(a, shooter, hp, ap, {
        weapon: weaponId, group: bh.group, headshot: bh.group === 'head', penetrated, dir: dir.clone(),
      })
      emit('bulletHit', { shooter, victim: a, group: bh.group, point })
      end = point
      break
    }
    // world surface
    wi++
    if (wh.t < from - 1e-4) continue           // already inside it
    const point = _o.copy(origin).addScaledVector(dir, wh.t).clone()
    const normal = new THREE.Vector3(...wh.normal)
    spawnImpact({ point, normal, mat: wh.mat === 'roof' || wh.mat === 'stone' ? 'wall' : wh.mat, bullet: true })
    // the ground stops everything; otherwise it is what the solid is made of
    const resist = wh.mat === 'sand' && wh.surface !== 'wood' ? Infinity : PENETRATION[wh.surface ?? 'wall'] ?? Infinity
    const thick = Math.max(0, Math.min(wh.tOut, maxDist) - wh.t)
    const cost = resist * thick
    if (!Number.isFinite(cost) || cost > pen) { end = point; break }
    pen -= cost
    // what is left after the wall: most of it through thin wood, little
    // through anything near the gun's limit
    dmg *= Math.max(0.2, 0.85 - cost * 0.3)
    penetrated = true
    from = wh.tOut
    // exit hole
    const exit = _o.copy(origin).addScaledVector(dir, wh.tOut).clone()
    spawnImpact({ point: exit, normal: dir.clone(), mat: wh.mat, bullet: true })
  }
  emit('shot', { shooter, weapon: weaponId, origin: origin.clone(), end })
  return end
}

/* ------------------------------------------------------------ knife ----- */

/** CS:GO knife: LMB 40 (then 25 in a combo), RMB 65; from behind 90 / 180. */
export function knifeAttack(attacker, origin, dir, heavy) {
  const range = (heavy ? 32 : 48) * U
  let best = null
  for (const a of game.agents) {
    if (!a.alive || a === attacker) continue
    // knife traces are fat: test a few rays around the centre
    for (const [ox, oy] of [[0, 0], [0.12, 0], [-0.12, 0], [0, -0.15], [0, -0.35]]) {
      _o.copy(origin)
      const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize()
      _o.addScaledVector(right, ox).y += oy
      const h = rayAgent(_o, dir, a, range + 0.3)
      if (h && (!best || h.t < best.t)) best = { ...h, agent: a }
    }
  }
  const wall = rayAll(origin, dir, range)[0]
  if (best && (!wall || best.t < wall.t)) {
    const v = best.agent
    // behind: attacker is within the victim's back half-plane
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw)
    const tx = attacker.pos.x - v.pos.x, tz = attacker.pos.z - v.pos.z
    const back = fx * tx + fz * tz < -0.2 * Math.hypot(tx, tz)
    let dmg
    if (heavy) dmg = back ? 180 : 65
    else dmg = back ? 90 : (attacker.w.lastKnifeHit > game.time - 1 ? 25 : 40)
    attacker.w.lastKnifeHit = game.time
    const [hp, ap] = armorDamage(dmg, v, best.group === 'head' ? 'chest' : best.group, 1.7)
    const point = origin.clone().addScaledVector(dir, best.t)
    spawnImpact({ point, normal: dir.clone().negate(), mat: 'flesh', heavy })
    applyDamage(v, attacker, hp, ap, { weapon: 'knife', group: best.group, dir: dir.clone() })
    emit('knifeHit', { attacker, victim: v, point })
    return { point, agent: v }
  }
  if (wall && wall.t <= range) {
    const point = origin.clone().addScaledVector(dir, wall.t)
    spawnImpact({ point, normal: new THREE.Vector3(...wall.normal), mat: wall.mat === 'roof' || wall.mat === 'stone' ? 'wall' : wall.mat, heavy })
    emit('knifeWall', { attacker, point })
    return { point, agent: null }
  }
  return null
}
