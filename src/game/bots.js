import * as THREE from 'three'
import { D2R, R2D, MOVE, U } from './constants'
import { game, on, eyePos, eyeHeight, activeWeapon } from './state'
import { W } from './weapons'
import { findPath, randomNear } from './nav'
import { lineClear, raycast } from '../world/collision'
import { smokeBlocks } from './grenades'
import { switchTo, hasSlot, bestSlot } from './weaponLogic'
import { buy, canPlant } from './rules'
import { SITES, SPOTS, siteAt } from '../world/mapData'
import { maxSpeed } from './movement'

/* CS:GO-flavoured bots. Each one perceives at 10 Hz (field of view, line of
   sight, smoke, flashes, hearing), reacts after a human-ish delay, turns at a
   limited rate with an aim error that settles the longer it tracks you, and
   fights the way the weapon wants: taps and bursts at range, sprays close,
   stops to shoot, scopes the AWP. Out of a fight they play the objective. */

/* The four levels step up evenly in every respect: how fast a bot reacts and
   turns, how far its first shot is off and how fast that settles, how often
   it goes for the head, how well it pulls a spray, how wide it sees, how
   cleanly it stops to shoot and strafes, and how well it plays as a team
   (grenades before an entry, groups waiting for each other, CT rotations). */
const DIFF = {
  easy: { reaction: 0.7, turn: 220, err: 4.5, settle: 1.2, head: 0.03, spray: 0.2, fov: 100, stop: 0.3, strafe: 0.1, nades: 0.2, sync: false, rotate: false },
  normal: { reaction: 0.48, turn: 340, err: 3.0, settle: 1.7, head: 0.1, spray: 0.4, fov: 115, stop: 0.55, strafe: 0.3, nades: 0.5, sync: true, rotate: true },
  hard: { reaction: 0.32, turn: 520, err: 1.8, settle: 2.6, head: 0.3, spray: 0.65, fov: 125, stop: 0.8, strafe: 0.5, nades: 0.7, sync: true, rotate: true },
  expert: { reaction: 0.2, turn: 780, err: 0.9, settle: 3.8, head: 0.55, spray: 0.9, fov: 135, stop: 0.95, strafe: 0.65, nades: 0.9, sync: true, rotate: true },
}

export function initBot(a, difficulty = 'normal') {
  a.bot = {
    d: DIFF[difficulty] || DIFF.normal,
    think: Math.random() * 0.1,
    path: null, pathI: 0, goal: null, goalKey: '',
    target: null, visible: false, reactAt: 0, lastSeen: -10, lastKnown: null,
    errX: 0, errY: 0,
    heard: null, lookAt: null, lookUntil: 0,
    burst: 0, burstPause: 0, click: false,
    strafeDir: 1, strafeUntil: 0,
    stuckT: 0, stuckPos: new THREE.Vector3(), stuckN: 0,
    role: null, plan: null, holdIdx: 0,
    buyAt: 0, bought: false,
    throwPlan: null,
    crouchUntil: 0,
    zoomAt: 0,
    wander: 0,
  }
  a.cmd = emptyCmd()
}

function emptyCmd() {
  return { fwd: 0, side: 0, jump: false, duck: false, walk: false, attack: false, attack2: false, attack2Pressed: false, reload: false, attackPressed: false }
}

/* ------------------------------------------------------------ round plan --- */


/* T tactics, after the Dust II playbook (dust2_bot_tactics.txt): each splits
   the team into groups that take their own route, gather at the end of it,
   wait for each other and hit the site together. The bomb goes with the main
   group, a step behind its entry. `fake` groups make noise on the other site
   first, then rotate in. Rush B and Split A come up most. */
const TACTICS = [
  { id: 'rushB', w: 3, site: 'B', rush: true, groups: [{ n: 5, bomb: true, route: ['tunnelsOut', 'tunnelsIn'] }] },
  { id: 'splitA', w: 3, site: 'A', groups: [
    { n: 3, bomb: true, route: ['longDoors', 'longCorner'] },
    { n: 2, route: ['midTop', 'catBottom', 'shortTop'] }] },
  { id: 'splitB', w: 2, site: 'B', groups: [
    { n: 3, bomb: true, route: ['tunnelsOut', 'tunnelsIn'] },
    { n: 2, route: ['midTop', 'midMid', 'ctMid', 'bDoors'] }] },
  { id: 'longA', w: 2, site: 'A', groups: [
    { n: 3, route: ['longDoors', 'longCorner'] },
    { n: 1, route: ['midTop', 'catBottom', 'shortTop'] },
    { n: 1, bomb: true, route: ['longDoors'] }] },
  { id: 'midShortA', w: 2, site: 'A', groups: [
    { n: 3, bomb: true, route: ['midTop', 'catBottom', 'shortTop'] },
    { n: 2, route: ['longDoors', 'longCorner'] }] },
  { id: 'fakeAB', w: 2, site: 'B', fake: 'A', groups: [
    { n: 3, bomb: true, route: ['tunnelsOut', 'tunnelsIn'] },
    { n: 2, fake: true, route: ['longDoors', 'longCorner'] }] },
]
function pickTactic() {
  let r = Math.random() * TACTICS.reduce((s, t) => s + t.w, 0)
  for (const t of TACTICS) if ((r -= t.w) < 0) return t
  return TACTICS[0]
}

const team = { T: null, CT: null }

/** A line in the team radio feed (shown to the human on that side). */
function radio(side, text) {
  if (game.mode === 'aim') return
  game.radio = (game.radio || []).filter(r => game.time - r.t < 8)
  game.radio.push({ side, text, t: game.time })
}

function newTPlan() {
  const tac = pickTactic()
  return {
    tac, site: tac.site, rush: !!tac.rush,
    execAt: tac.rush ? 4 : 14 + Math.random() * 18,
    assigned: false, groups: [],
  }
}

export function botsRoundStart() {
  team.T = newTPlan()
  team.CT = { rotateTo: null, rotateUntil: 0, checkAt: 0 }

  // CT roles: two on each site, one mid, shuffled
  const cts = game.agents.filter(a => a.team === 'CT' && a.isBot).sort(() => Math.random() - 0.5)
  const roles = ['A', 'B', 'A', 'B', 'mid', 'A', 'B']
  cts.forEach((a, i) => { a.bot.role = roles[i] })
  if (cts.length && game.mode !== 'aim') {
    const n = r => cts.filter(a => a.bot.role === r).length
    radio('CT', 'Đội hình: ' + ['A', 'mid', 'B'].filter(r => n(r)).map(r => `${n(r)} ${r === 'mid' ? 'Mid' : r}`).join(' · '))
  }
  const counts = { A: 0, B: 0, mid: 0 }
  for (const a of cts) a.bot.holdIdx = counts[a.bot.role]++

  let ti = 0
  for (const a of game.agents) {
    if (!a.isBot) continue
    const b = a.bot
    b.path = null; b.goal = null; b.goalKey = ''
    b.target = null; b.visible = false; b.lastKnown = null; b.heard = null
    b.lookAt = null; b.throwPlan = null
    b.bought = false
    b.buyAt = game.time + 0.4 + Math.random() * 2.5
    b.stuckN = 0
    b.postIdx = a.team === 'T' ? ti++ : 0
    b.threwExec = false
    b.group = null; b.route = null; b.routeI = 0; b.holdShuffleAt = game.time + 20 + Math.random() * 15
    a.cmd = emptyCmd()
  }
}

/* ----------------------------------------------------------------- buy --- */

function botBuy(a) {
  const m = () => a.money
  const T = a.team === 'T'
  const pistolRound = game.round === 1 || game.round === game.maxRounds / 2 + 1
  if (pistolRound) {
    if (Math.random() < 0.55) buy(a, 'vest')
    else if (Math.random() < 0.5) buy(a, 'p250')
    if (m() >= 300 && Math.random() < 0.4) buy(a, T ? 'flash' : 'smoke')
    return
  }
  if (!a.inv[1]) {
    const awpers = game.agents.filter(x => x.team === a.team && x.inv[1]?.id === 'awp').length
    if (m() >= 4750 + 1000 && awpers === 0 && Math.random() < 0.3) buy(a, 'awp')
    else if (m() >= 5000 + 1500 && awpers === 0 && Math.random() < 0.12) buy(a, T ? 'g3sg1' : 'scar20')
    else if (m() >= (T ? 2700 : 3100) + 650) buy(a, T ? 'ak47' : (Math.random() < 0.5 ? 'm4a4' : 'm4a1s'))
    else if (m() >= (T ? 1800 : 2050) + 650 && (game.lossStreak[a.team] >= 3 || Math.random() < 0.35)) buy(a, T ? 'galil' : 'famas')
    else if (m() >= 1700 + 650 && Math.random() < 0.15) buy(a, 'ssg08')
    else if (m() >= 2350 + 650 && Math.random() < 0.2) buy(a, 'p90')
    else if (m() >= (T ? 1050 : 1250) + 650 && Math.random() < 0.3) buy(a, T ? 'mac10' : 'mp9')
    else if (m() >= 1500 && Math.random() < 0.3) buy(a, 'deagle')
  }
  if (a.armor < 100 || !a.helmet) {
    if (m() >= 1000) buy(a, 'vesthelm')
    else if (m() >= 650 && a.armor < 50) buy(a, 'vest')
  }
  if (!T && !a.defuser && m() >= 400 && Math.random() < 0.65) buy(a, 'defuser')
  const nades = ['smoke', 'flash', 'he', 'flash']
  for (const n of nades) if (m() >= 900 && Math.random() < 0.55) buy(a, n)
  switchTo(a, bestSlot(a), { quiet: true })
}

/* ----------------------------------------------------------- perception --- */

const _eye = new THREE.Vector3()
const _tgt = new THREE.Vector3()
const _dir = new THREE.Vector3()

function headOf(t, out) {
  if (t.headFromModel) return out.copy(t.headPos)
  return out.set(t.pos.x, t.pos.y + eyeHeight(t) + 0.07, t.pos.z)
}
function chestOf(t, out) {
  return out.set(t.pos.x, t.pos.y + (1.83 - 0.46 * t.duck) * 0.68, t.pos.z)
}

/** Can a see t right now? Returns the visible aim point kind or null. */
export function canSee(a, t, fovDeg) {
  if (!t.alive) return null
  eyePos(a, _eye)
  const dist = _eye.distanceTo(t.pos)
  if (dist > 75) return null
  if (fovDeg < 360) {
    const fx = -Math.sin(a.yaw) * Math.cos(a.pitch), fy = Math.sin(a.pitch), fz = -Math.cos(a.yaw) * Math.cos(a.pitch)
    chestOf(t, _tgt).sub(_eye).normalize()
    const dot = fx * _tgt.x + fy * _tgt.y + fz * _tgt.z
    if (dot < Math.cos((fovDeg / 2) * D2R) && dist > 2.5) return null
  }
  for (const kind of ['head', 'chest']) {
    if (kind === 'head') headOf(t, _tgt); else chestOf(t, _tgt)
    if (!lineClear(_eye.x, _eye.y, _eye.z, _tgt.x, _tgt.y, _tgt.z)) continue
    if (smokeBlocks(_eye, _tgt)) continue
    return kind
  }
  return null
}

// hearing
on('shot', ({ shooter, weapon, origin }) => {
  const loud = W[weapon]?.silenced ? 10 : 38
  for (const a of game.agents) {
    if (!a.isBot || !a.alive || a.team === shooter.team) continue
    if (a.pos.distanceTo(origin) < loud) hear(a, origin)
  }
})
on('footstep', ({ agent }) => {
  for (const a of game.agents) {
    if (!a.isBot || !a.alive || a.team === agent.team) continue
    if (a.pos.distanceTo(agent.pos) < 15) hear(a, agent.pos)
  }
})
on('damage', ({ victim, attacker }) => {
  // getting shot tells you roughly where from
  if (victim.isBot && attacker && victim.alive && attacker.team !== victim.team) {
    hear(victim, attacker.pos, true)
  }
})
on('kill', ({ victim }) => {
  // a CT falls: someone rotates toward that site
  if (victim.team !== 'CT') return
  const s = siteAt(victim.pos.x, victim.pos.z)
  if (!s || game.bomb?.state === 'planted') return
  const helpers = game.agents.filter(a => a.isBot && a.alive && a.team === 'CT' && a.bot.role !== s)
  if (helpers.length) {
    const h = helpers[Math.floor(Math.random() * helpers.length)]
    h.bot.role = s
  }
})

function hear(a, pos, urgent = false) {
  const b = a.bot
  b.heard = { pos: pos.clone(), t: game.time, urgent }
  if (!b.visible) {
    b.lookAt = pos.clone()
    b.lookUntil = game.time + (urgent ? 2.5 : 1.6)
  }
}

/* ----------------------------------------------------------------- tick --- */

export function updateBots(dt) {
  for (const a of game.agents) {
    if (!a.isBot) continue
    if (!a.alive) { a.cmd = emptyCmd(); continue }
    tickBot(a, dt)
  }
}

function perceive(a) {
  const b = a.bot
  const blind = a.flashUntil > game.time && (a.flashUntil - game.time) > 0.6
  let best = null, bestD = Infinity, bestKind = null
  if (!blind) {
    for (const t of game.agents) {
      if (!t.alive || t.team === a.team) continue
      const fov = t === b.target && game.time - b.lastSeen < 1.5 ? 200 : b.d.fov
      const kind = canSee(a, t, fov)
      if (!kind) continue
      t.spottedUntil = game.time + 1.2
      const d = a.pos.distanceTo(t.pos) * (t === b.target ? 0.7 : 1)
      if (d < bestD) { bestD = d; best = t; bestKind = kind }
    }
  }
  if (best) {
    if (best !== b.target || !b.visible) {
      // new contact: react after a delay, with a fresh aim error
      const tracking = best === b.target && game.time - b.lastSeen < 0.6
      if (!tracking) {
        b.reactAt = game.time + b.d.reaction * (0.75 + Math.random() * 0.6)
        const e = b.d.err * (1 + Math.random())
        const ang = Math.random() * Math.PI * 2
        b.errX = Math.cos(ang) * e; b.errY = Math.sin(ang) * e * 0.6
        b.aimHead = Math.random() < b.d.head
        b.burst = 0
      }
    }
    b.target = best
    b.visible = true
    b.visKind = bestKind
    b.lastSeen = game.time
    b.lastKnown = best.pos.clone()
  } else {
    b.visible = false
    if (b.target && (!b.target.alive || game.time - b.lastSeen > 4)) b.target = null
  }
}

function tickBot(a, dt) {
  const b = a.bot
  const cmd = a.cmd
  cmd.attack = false; cmd.attack2 = false; cmd.attack2Pressed = false; cmd.reload = false
  cmd.jump = false; cmd.duck = false; cmd.walk = false; cmd.lean = 0
  a.wantPlant = false; a.wantUse = false

  b.think -= dt
  if (b.think <= 0) { b.think = 0.1; perceive(a) }

  if (game.phase === 'freeze') {
    cmd.fwd = 0; cmd.side = 0
    if (!b.bought && game.time >= b.buyAt) { b.bought = true; botBuy(a) }
    idleLook(a, dt)
    return
  }
  if (game.phase === 'matchEnd') { cmd.fwd = 0; cmd.side = 0; return }

  keepGunOut(a)

  if (b.target && b.target.alive && b.visible) {
    fight(a, dt)
    return
  }

  // grenade plan in progress
  if (b.throwPlan) { doThrow(a, dt); return }

  // lost sight recently: push the last known spot for a moment
  if (b.target && b.lastKnown && game.time - b.lastSeen < 2.5 && !isObjectiveCritical(a)) {
    moveTo(a, b.lastKnown.x, b.lastKnown.z, dt, 'chase', false, b.lastKnown.y)
    aimAt(a, b.lastKnown.x, b.lastKnown.y + 1.5, b.lastKnown.z, dt, 0.8)
    maybeReload(a, 0.5)
    return
  }
  maybeReload(a, 0.4)
  objective(a, dt)
}

function isObjectiveCritical(a) {
  const bomb = game.bomb
  if (!bomb) return false
  if (a.team === 'CT' && bomb.state === 'planted') return true
  if (a.inv[5] && siteAt(a.pos.x, a.pos.z)) return true
  return false
}

function keepGunOut(a) {
  if (a.planting > 0 || a.bot.throwPlan) return
  const inst = activeWeapon(a)
  const want = hasSlot(a, 1) && (a.inv[1].clip > 0 || a.inv[1].reserve > 0) ? 1 : hasSlot(a, 2) ? 2 : 3
  if (a.active !== want && (a.active !== 5 || !a.wantPlant)) {
    if (!inst || a.active === 4 || a.active === 5 || a.active === 3 || (a.active === 2 && want === 1)) switchTo(a, want)
  }
  // empty gun with nothing in reserve: pull the pistol
  if (a.active === 1 && a.inv[1] && a.inv[1].clip === 0 && a.inv[1].reserve === 0 && hasSlot(a, 2)) switchTo(a, 2)
}

function maybeReload(a, frac) {
  const inst = activeWeapon(a)
  const w = inst && W[inst.id]
  if (!w?.clip) return
  if (inst.clip < w.clip * frac && inst.reserve > 0 && !a.w.reloadEnd) a.cmd.reload = true
}

/* --------------------------------------------------------------- combat --- */

function fight(a, dt) {
  const b = a.bot, t = b.target, cmd = a.cmd
  const inst = activeWeapon(a)
  const w = W[inst?.id]
  eyePos(a, _eye)
  const dist = _eye.distanceTo(t.pos)

  // settle the aim error while tracking
  const k = Math.exp(-b.d.settle * dt)
  b.errX *= k; b.errY *= k

  // aim point, with the error expressed as an angle
  // point-blank head clicks are for the good bots only
  if (b.aimHead || (dist < 4 && b.d.head >= 0.5)) headOf(t, _tgt); else chestOf(t, _tgt)
  if (b.visKind === 'head' && !b.aimHead) headOf(t, _tgt).y -= 0.15   // only the head is showing
  const reacted = game.time >= b.reactAt
  const errScale = reacted ? 1 : 2.2
  const spray = b.d.spray
  const yawOff = (b.errX * errScale) * D2R - a.w.punch.x * 2 * spray * D2R
  const pitchOff = (b.errY * errScale) * D2R - a.w.punch.y * 2 * spray * D2R
  aimAt(a, _tgt.x, _tgt.y, _tgt.z, dt, 1, yawOff, pitchOff)
  // where the next bullet actually goes: the view plus twice the aim punch
  const effYaw = a.yaw - a.w.punch.x * 2 * D2R, effPitch = a.pitch + a.w.punch.y * 2 * D2R
  const aimErr = Math.hypot(wrap(lastAim.yaw - effYaw), lastAim.pitch - effPitch) * R2D

  // what a hit needs: roughly the target's angular half-width
  const tol = Math.atan2(b.aimHead ? 0.12 : 0.22, dist) * R2D + 0.4 + (dist < 5 ? 3 : 0)

  // --- movement: stop to shoot at range, strafe up close ---
  const moving = Math.hypot(a.vel.x, a.vel.z)
  const accurateSpeed = maxSpeed(a) * 0.34
  let wantStop = false
  // decide stop-or-move a few times a second, not every frame (no jitter)
  if (game.time > (b.stanceUntil ?? 0)) {
    b.stanceUntil = game.time + 0.5 + Math.random() * 0.5
    b.stopShoot = w?.type === 'sniper' || (dist > 12 && Math.random() < b.d.stop + 0.1)
    b.strafing = Math.random() < b.d.strafe + (dist < 12 ? 0.35 : 0.15)
  }
  if (w?.type === 'knife') {
    moveTo(a, t.pos.x, t.pos.z, dt, 'knife', false, t.pos.y)
  } else if (b.stopShoot && !(game.time < b.burstPause && b.strafing)) {
    wantStop = true
  } else {
    // ADAD: strafe between bursts and up close, so a fight is never a
    // statue duel
    if (game.time > b.strafeUntil) { b.strafeDir = -b.strafeDir; b.strafeUntil = game.time + 0.3 + Math.random() * 0.5 }
    cmd.fwd = 0; cmd.side = b.strafing ? b.strafeDir : 0
  }
  // peek-lean while holding still to shoot, toward whichever side has room
  if (wantStop && dist > 8 && w?.type !== 'knife') {
    if (b.leanFor !== t) {
      b.leanFor = t
      b.leanDir = Math.random() < b.d.strafe + 0.2 ? sideWithRoom(a) : 0
    }
    cmd.lean = b.leanDir
  }
  if (wantStop) {
    // counter-strafe: push against the current velocity for a frame
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw)
    const vf = a.vel.x * fx + a.vel.z * fz, vs = a.vel.x * rx + a.vel.z * rz
    cmd.fwd = b.d.stop > 0.8 && Math.abs(vf) > 0.6 ? -Math.sign(vf) : 0
    cmd.side = b.d.stop > 0.8 && Math.abs(vs) > 0.6 ? -Math.sign(vs) : 0
  }
  if (dist > 20 && b.d.head > 0.5 && game.time < b.crouchUntil) cmd.duck = true
  if (reacted && dist > 20 && Math.random() < 0.004) b.crouchUntil = game.time + 1.5

  if (!w || !reacted) return

  // --- reload / empty ---
  if (w.clip && inst.clip === 0) { cmd.reload = true; return }

  // --- shoot ---
  const onTarget = aimErr < tol
  // shots that actually left the barrel since the last tick count toward the burst
  b.burst += a.w.fireSeq - (b.seenSeq ?? a.w.fireSeq)
  b.seenSeq = a.w.fireSeq
  switch (w.type) {
    case 'knife':
      if (dist < 1.7) { if (Math.random() < 0.3) cmd.attack2 = true; else cmd.attack = true }
      break
    case 'sniper': {
      if (a.w.zoom === 0 && !a.w.resumeZoom && game.time > b.zoomAt) {
        cmd.attack2Pressed = true; b.zoomAt = game.time + 0.35
      }
      const settled = a.w.zoom > 0 && game.time > b.zoomAt - 0.1 && moving < accurateSpeed
      if (settled && onTarget) cmd.attack = true
      break
    }
    case 'pistol': {
      b.click = !b.click
      const ready = a.w.penalty < 18 || dist < 7
      if (onTarget && ready && b.click) cmd.attack = true
      break
    }
    default: {
      // rifles & SMGs: bursts at range, spray up close
      const burstLen = dist > 25 ? 2 + (Math.random() < 0.5 ? 1 : 0) : dist > 12 ? 4 : 30
      if (game.time < b.burstPause) break
      if (onTarget || (b.burst > 0 && aimErr < tol * 3)) {
        if (dist > 12 && moving > accurateSpeed && b.d.stop > 0.5) break   // let the stop land first
        if (b.burst >= burstLen) { b.burst = 0; b.burstPause = game.time + 0.2 + Math.random() * 0.3 * (dist / 20); break }
        cmd.attack = true
      } else b.burst = 0
    }
  }
}

function sideWithRoom(a) {
  eyePos(a, _eye)
  const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw)
  const room = s => {
    const h = raycast(_eye, { x: rx * s, y: 0, z: rz * s }, 1)
    return h ? h.t : 1
  }
  const r = room(1), l = room(-1)
  if (Math.max(r, l) < 0.4) return 0
  return r >= l ? 1 : -1
}

/**
 * Turn toward a point at a limited rate. Returns the remaining angular error
 * to the true point (degrees), ignoring the deliberate offsets.
 */
function aimAt(a, x, y, z, dt, urgency = 1, yawOff = 0, pitchOff = 0) {
  eyePos(a, _eye)
  _dir.set(x - _eye.x, y - _eye.y, z - _eye.z)
  const h = Math.hypot(_dir.x, _dir.z)
  const tYaw = Math.atan2(-_dir.x, -_dir.z)
  const tPitch = Math.atan2(_dir.y, h)
  const dYaw = wrap(tYaw + yawOff - a.yaw)
  const dPitch = tPitch + pitchOff - a.pitch
  const maxStep = a.bot.d.turn * D2R * dt * urgency
  // fast when far off, gentle when close: a flick then a correction
  const ease = Math.min(1, dt * 14)
  const sy = clampAbs(dYaw * Math.max(ease, Math.min(1, maxStep / (Math.abs(dYaw) + 1e-6))), maxStep)
  const sp = clampAbs(dPitch * Math.max(ease, Math.min(1, maxStep / (Math.abs(dPitch) + 1e-6))), maxStep)
  a.yaw = wrap(a.yaw + sy)
  a.pitch = THREE.MathUtils.clamp(a.pitch + sp, -1.5, 1.5)
  lastAim.yaw = tYaw; lastAim.pitch = tPitch
  const ey = wrap(tYaw - a.yaw), ep = tPitch - a.pitch
  return Math.hypot(ey, ep) * R2D
}
const lastAim = { yaw: 0, pitch: 0 }

const wrap = x => Math.atan2(Math.sin(x), Math.cos(x))
const clampAbs = (x, m) => Math.max(-m, Math.min(m, x))

function idleLook(a, dt) {
  a.pitch += (0 - a.pitch) * Math.min(1, dt * 3)
}

/* ------------------------------------------------------------ objective --- */

function objective(a, dt) {
  const b = a.bot
  if (game.mode === 'aim') return hunt(a, dt)
  const bomb = game.bomb
  const roundLeft = game.phaseEnd - game.time

  if (a.team === 'T') {
    // bomb on the floor: the nearest T fetches it
    if (bomb?.state === 'dropped') {
      const ts = game.agents.filter(x => x.alive && x.team === 'T')
      const nearest = ts.sort((p, q) => p.pos.distanceTo(bomb.pos) - q.pos.distanceTo(bomb.pos))[0]
      if (nearest === a) { moveTo(a, bomb.pos.x, bomb.pos.z, dt, 'bomb', false, bomb.pos.y); lookAlongPath(a, dt); return }
    }
    if (bomb?.state === 'planted') {
      const posts = bomb.site === 'A' ? SPOTS.postA : SPOTS.postB
      const s = posts[b.postIdx % posts.length]
      return hold(a, s, dt)
    }
    const plan = team.T || (team.T = newTPlan())
    if (!plan.assigned) assignGroups(plan)
    const g = plan.groups[b.group]
    if (!g) return hold(a, { p: SPOTS.midTop, look: SPOTS.midMid }, dt)
    const elapsed = game.time - game.roundStart
    const site = g.fake && !plan.fakeDone ? plan.tac.fake : plan.site
    // the groups are in place: everyone alive in each has reached its stage
    const ready = plan.groups.every(gr => gr.members.every(m => !m.alive || m.bot.routeI >= m.bot.route.length))
    if (!plan.goAt && (plan.rush || roundLeft < 40 || (elapsed > plan.execAt && (ready || !b.d.sync || elapsed > plan.execAt + 8)))) {
      plan.goAt = game.time
      radio('T', `Vào site ${plan.site}!`)
    }
    // a fake hits early to pull the CTs over, then rotates to the real site
    if (g.fake && !plan.fakeAt && elapsed > plan.execAt - 8) plan.fakeAt = game.time
    if (g.fake && plan.goAt && game.time > plan.goAt + 6) plan.fakeDone = true
    const go = g.fake ? (plan.fakeAt && !plan.fakeDone) || plan.fakeDone : plan.goAt
    // the bomb goes in a beat after its group
    const goNow = go && (!a.inv[5] || game.time > plan.goAt + 1.5)

    if (!goNow) {
      // walk the route, each bot on its own line through it, then wait
      if (game.time < b.departAt) { a.cmd.fwd = 0; a.cmd.side = 0; idleScan(a, dt); return }
      if (b.routeI < b.route.length) {
        const [x, z, y] = b.route[b.routeI]
        if (Math.hypot(a.pos.x - x, a.pos.z - z) < 1.1) b.routeI++
        else { moveTo(a, x, z, dt, 'route', false, y); lookAlongPath(a, dt); return }
      }
      a.cmd.fwd = 0; a.cmd.side = 0
      const c = SITES[site].center
      aimAt(a, c[0], (c[2] ?? 0) + 1.6, c[1], dt, 0.3)
      return
    }
    if (a.inv[5]) {
      const here = siteAt(a.pos.x, a.pos.z)
      const spots = site === 'A' ? SPOTS.plantA : SPOTS.plantB
      const spot = spots[a.id % spots.length]
      if (here === site && Math.hypot(a.pos.x - spot[0], a.pos.z - spot[1]) < 1.4 && canPlant(a)) {
        if (a.active !== 5) switchTo(a, 5)
        a.cmd.fwd = 0; a.cmd.side = 0
        a.wantPlant = true
        a.pitch += (-0.9 - a.pitch) * Math.min(1, dt * 5)
        return
      }
      moveTo(a, spot[0], spot[1], dt, 'plant', false, spot[2])
      lookAlongPath(a, dt)
      return
    }
    // execute: flash/smoke onto the site once, then take a post on it
    if (!b.threwExec) {
      b.threwExec = true
      const gr = a.inv[4].find(x => x.id === 'flash' || x.id === 'smoke')
      const c = SITES[site].center
      if (gr && Math.random() < b.d.nades) { b.throwPlan = { type: gr.id, target: new THREE.Vector3(c[0], 1, c[1]), t: 0 }; return }
    }
    const posts = site === 'A' ? SPOTS.postA : SPOTS.postB
    const ps = posts[b.postIdx % posts.length]
    hold(a, ps, dt)
    return
  }

  // --- CT ---
  if (bomb?.state === 'planted') {
    // the nearest bot goes for the kit; the rest cover it
    const cts = game.agents.filter(x => x.alive && x.team === 'CT' && x.isBot)
    const nearest = cts.sort((p, q) => p.pos.distanceTo(bomb.pos) - q.pos.distanceTo(bomb.pos))[0]
    const d = Math.hypot(a.pos.x - bomb.pos.x, a.pos.z - bomb.pos.z)
    if (nearest === a) {
      if (d < 0.9) {
        a.cmd.fwd = 0; a.cmd.side = 0; a.cmd.duck = true
        a.wantUse = true
        aimAt(a, bomb.pos.x, bomb.pos.y, bomb.pos.z, dt, 0.8)
        return
      }
      moveTo(a, bomb.pos.x, bomb.pos.z, dt, 'defuse', false, bomb.pos.y)
      lookAlongPath(a, dt)
      return
    }
    // cover the defuser from a few metres off
    if (d > 6) { moveTo(a, bomb.pos.x, bomb.pos.z, dt, 'retake', false, bomb.pos.y); lookAlongPath(a, dt); return }
    a.cmd.fwd = 0; a.cmd.side = 0
    idleScan(a, dt)
    return
  }
  // chase what we heard if it was close and we are not anchoring a site
  if (b.heard && game.time - b.heard.t < 3 && b.role === 'mid' && a.pos.distanceTo(b.heard.pos) < 20) {
    moveTo(a, b.heard.pos.x, b.heard.pos.z, dt, 'investigate', true, b.heard.pos.y)
    aimAt(a, b.heard.pos.x, b.heard.pos.y + 1.5, b.heard.pos.z, dt, 0.8)
    return
  }
  ctRead()
  // rotate: when Ts show up in force on one site, the mid bot and all but
  // one anchor of the other site go there
  let role = b.role
  const rot = team.CT?.rotateTo
  if (rot && game.time < team.CT.rotateUntil && role !== rot) {
    const anchors = game.agents.filter(x => x.alive && x.isBot && x.team === 'CT' && x.bot.role === role)
    if (role === 'mid' || anchors.indexOf(a) > 0) role = rot
  }
  // swap angles now and then, as players do, instead of standing on one spot
  if (game.time > b.holdShuffleAt) { b.holdShuffleAt = game.time + 18 + Math.random() * 18; b.holdIdx++ }
  const holds = role === 'A' ? SPOTS.holdA : role === 'B' ? SPOTS.holdB : SPOTS.holdMid
  hold(a, holds[b.holdIdx % holds.length], dt)
}

/* Split the T bots over the tactic's groups: the bomb carrier into the
   group that brings it, the rest in turn; each bot gets its own copy of the
   route, every point nudged a little so a group spreads out rather than
   walking single file, and leaves spawn at its own moment. */
function assignGroups(plan) {
  plan.assigned = true
  const ts = game.agents.filter(x => x.alive && x.team === 'T' && x.isBot).sort(() => Math.random() - 0.5)
  const carrier = ts.find(x => x.inv[5])
  const order = carrier ? [carrier, ...ts.filter(x => x !== carrier)] : ts
  const groups = plan.tac.groups.map(gr => ({ ...gr, members: [] }))
  const bombG = Math.max(0, groups.findIndex(gr => gr.bomb))
  let gi = 0
  for (const a of order) {
    let k
    if (a === carrier) k = bombG
    else {
      // fill groups to size in order, the rest join the biggest
      while (gi < groups.length && groups[gi].members.length >= groups[gi].n) gi++
      k = gi < groups.length ? gi : 0
    }
    groups[k].members.push(a)
    const b = a.bot
    b.group = k
    b.route = groups[k].route.map(n => SPOTS[n]).filter(Boolean).map(pt => randomNear(pt[0], pt[1], 1.8, pt[2]))
    b.routeI = 0
    b.departAt = game.roundStart + Math.random() * 3
  }
  plan.groups = groups
  // tell the T side the call, and suggest a group to a human on it
  const where = { tunnelsOut: 'Tunnel', tunnelsIn: 'Tunnel', longDoors: 'Long', longCorner: 'Long', midTop: 'Mid', midMid: 'Mid', catBottom: 'Short', shortTop: 'Short', ctMid: 'Mid → CT', bDoors: 'cửa B' }
  const label = gr => where[gr.route[gr.route.length - 1]] || gr.route[gr.route.length - 1]
  radio('T', `Chiến thuật: ${TAC_NAME[plan.tac.id]} — ` + groups.map(gr => `${gr.members.length} ${label(gr)}${gr.fake ? ' (giả)' : ''}`).join(' · '))
  const me = game.local
  if (me?.alive && me.team === 'T' && groups.length) {
    const need = groups.map(gr => gr.n - gr.members.length)
    const k = need.indexOf(Math.max(...need))
    radio('T', me.inv[5] ? `Bạn cầm bom: đi cùng nhóm ${label(groups[bombG])}, đặt ở ${plan.site}` : `Bạn: đi cùng nhóm ${label(groups[k])}`)
  }
}
const TAC_NAME = { rushB: 'Rush B', splitA: 'Split A', splitB: 'Split B', longA: 'Long → A', midShortA: 'Mid → Short → A', fakeAB: 'Fake A → B' }

/* What the CTs know: every half second, count the Ts spotted near each site
   (or on its approaches) and call a rotation when two or more show at one. */
function ctRead() {
  const ct = team.CT || (team.CT = { rotateTo: null, rotateUntil: 0, checkAt: 0 })
  if (game.time < ct.checkAt) return
  ct.checkAt = game.time + 0.5
  const near = { A: 0, B: 0 }
  for (const t of game.agents) {
    if (!t.alive || t.team !== 'T' || !(t.spottedUntil > game.time)) continue
    for (const k of ['A', 'B']) {
      const c = SITES[k].center
      if (Math.hypot(t.pos.x - c[0], t.pos.z - c[1]) < 32) near[k]++
    }
  }
  const hot = near.A >= 2 && near.A >= near.B ? 'A' : near.B >= 2 ? 'B' : null
  const canRotate = game.agents.some(x => x.isBot && x.team === 'CT' && x.bot.d.rotate)
  if (hot && canRotate) {
    if (ct.rotateTo !== hot || game.time > ct.rotateUntil) radio('CT', `Địch dồn về ${hot} — xoay về ${hot}!`)
    ct.rotateTo = hot; ct.rotateUntil = game.time + 25
  }
}

/* Solo aim: go find the enemy. The bot knows roughly where you are — a guess
   within a few metres, refreshed every few seconds — never exactly. */
function hunt(a, dt) {
  const b = a.bot
  const foes = game.agents.filter(x => x.alive && x.team !== a.team)
  if (!foes.length) { a.cmd.fwd = 0; a.cmd.side = 0; return }
  if (!b.huntSpot || game.time > b.huntUntil) {
    const f = foes.sort((p, q) => p.pos.distanceTo(a.pos) - q.pos.distanceTo(a.pos))[0]
    const src = b.lastKnown && game.time - b.lastSeen < 4 ? b.lastKnown : f.pos
    b.huntSpot = randomNear(src.x, src.z, 5, src.y)
    b.huntUntil = game.time + 2.5 + Math.random() * 2
  }
  const [x, z, y] = b.huntSpot
  if (Math.hypot(a.pos.x - x, a.pos.z - z) < 1.2) { b.huntUntil = 0; idleScan(a, dt); a.cmd.fwd = 0; a.cmd.side = 0; return }
  moveTo(a, x, z, dt, 'hunt', false, y)
  lookAlongPath(a, dt)
}

function hold(a, spot, dt) {
  const d = Math.hypot(a.pos.x - spot.p[0], a.pos.z - spot.p[1])
  if (d > 0.7) {
    moveTo(a, spot.p[0], spot.p[1], dt, 'hold', false, spot.p[2])
    // walk the last few metres, like a player settling into an angle
    if (d < 5) a.cmd.walk = true
    lookAlongPath(a, dt)
    return
  }
  a.cmd.fwd = 0; a.cmd.side = 0
  const b = a.bot
  if (b.lookAt && game.time < b.lookUntil) { aimAt(a, b.lookAt.x, b.lookAt.y + 1.4, b.lookAt.z, dt, 0.7); return }
  const lx = spot.look[0], lz = spot.look[1]
  // small scanning sweep around the held angle
  const t = game.time * 0.6 + a.id
  const side = Math.sin(t) * 1.6
  const ang = Math.atan2(-(lx - a.pos.x), -(lz - a.pos.z))
  const rx = Math.cos(ang), rz = -Math.sin(ang)
  aimAt(a, lx + rx * side, (spot.look[2] ?? a.pos.y) + 1.55, lz + rz * side, dt, 0.35)
}

function idleScan(a, dt) {
  const b = a.bot
  if (b.lookAt && game.time < b.lookUntil) { aimAt(a, b.lookAt.x, b.lookAt.y + 1.4, b.lookAt.z, dt, 0.7); return }
  a.yaw = wrap(a.yaw + Math.sin(game.time * 0.7 + a.id) * dt * 0.8)
  a.pitch += (0 - a.pitch) * Math.min(1, dt * 2)
}

/* --------------------------------------------------------- path follow --- */

function moveTo(a, x, z, dt, why, walk = false, y = a.pos.y) {
  const b = a.bot
  const key = `${why}:${Math.round(x * 2)}:${Math.round(z * 2)}`
  if (b.goalKey !== key || !b.path) {
    b.goalKey = key
    const noise = Math.random() * 1000
    // a little per-bot noise in the costs so a team does not walk single-file
    b.path = findPath(a.pos, { x, y, z }, (i, j) => ((i * 73 + j * 151 + noise) % 7) * 0.04)
    b.pathI = 1
    b.stuckT = 0
    b.stuckPos.copy(a.pos)
  }
  const cmd = a.cmd
  if (!b.path || b.pathI >= b.path.length) {
    const dx = x - a.pos.x, dz = z - a.pos.z
    if (Math.hypot(dx, dz) < 0.3) { cmd.fwd = 0; cmd.side = 0; return true }
    steer(a, dx, dz)
    return false
  }
  let p = b.path[b.pathI]
  let dx = p[0] - a.pos.x, dz = p[1] - a.pos.z
  while (Math.hypot(dx, dz) < 0.55 && b.pathI < b.path.length - 1) {
    b.pathI++
    p = b.path[b.pathI]; dx = p[0] - a.pos.x; dz = p[1] - a.pos.z
  }
  if (b.pathI === b.path.length - 1 && Math.hypot(dx, dz) < 0.3) { cmd.fwd = 0; cmd.side = 0; b.pathI++; return true }
  steer(a, dx, dz)
  cmd.walk = walk

  // stuck?
  b.stuckT += dt
  if (b.stuckT > 1) {
    if (a.pos.distanceTo(b.stuckPos) < 0.35) {
      b.stuckN++
      cmd.jump = true
      if (b.stuckN > 2) { b.path = null; b.stuckN = 0 }
    } else b.stuckN = 0
    b.stuckT = 0
    b.stuckPos.copy(a.pos)
  }
  return false
}

function steer(a, dx, dz) {
  const l = Math.hypot(dx, dz) || 1
  dx /= l; dz /= l
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw)
  a.cmd.fwd = dx * fx + dz * fz
  a.cmd.side = dx * rx + dz * rz
  a.moveDir = [dx, dz]
}

function lookAlongPath(a, dt) {
  const b = a.bot
  if (b.lookAt && game.time < b.lookUntil) { aimAt(a, b.lookAt.x, b.lookAt.y + 1.4, b.lookAt.z, dt, 0.8); return }
  if (!b.path) return
  // look a few metres down the path, at head height
  const p = b.path[Math.min(b.pathI + 1, b.path.length - 1)] || b.path[b.path.length - 1]
  if (!p) return
  const dx = p[0] - a.pos.x, dz = p[1] - a.pos.z
  if (Math.hypot(dx, dz) < 0.5) return
  aimAt(a, p[0], (p[2] || 0) + MOVE.eye, p[1], dt, 0.45)
}

/* ------------------------------------------------------------ grenades --- */

function doThrow(a, dt) {
  const b = a.bot, p = b.throwPlan
  p.t += dt
  a.cmd.fwd = 0; a.cmd.side = 0
  // switch to it
  const idx = a.inv[4].findIndex(x => x.id === p.type)
  if (idx < 0) { b.throwPlan = null; return }
  if (a.active !== 4 || a.inv[4][0].id !== p.type) {
    if (idx > 0) a.inv[4].unshift(a.inv[4].splice(idx, 1)[0])
    if (a.active !== 4) switchTo(a, 4)
    else { a.w.deploySeq++; a.w.deployEnd = game.time + 0.5 }
  }
  // ballistic pitch for the distance (flat-ground approximation)
  eyePos(a, _eye)
  const dx = p.target.x - _eye.x, dz = p.target.z - _eye.z
  const d = Math.hypot(dx, dz)
  const v = 750 * U, g = MOVE.sv_gravity * 0.4
  const s = Math.min(1, (g * d) / (v * v))
  const theta = 0.5 * Math.asin(s)
  const lift = 10 * D2R * (1 - Math.abs(theta) / (Math.PI / 2))
  const yaw = Math.atan2(-dx, -dz)
  a.yaw += wrap(yaw - a.yaw) * Math.min(1, dt * 10)
  a.pitch += (theta - lift - a.pitch) * Math.min(1, dt * 10)
  if (p.t > 0.7 && p.t < 1.1) a.cmd.attack = true
  if (p.t > 1.6) b.throwPlan = null
}
