import * as THREE from 'three'
import { D2R, RECOIL, U } from './constants'
import { game, emit, eyePos, viewDir, activeWeapon } from './state'
import { W, canAds } from './weapons'
import { fireBullet, knifeAttack } from './combat'
import { throwGrenade } from './grenades'

/* Everything a held weapon does, shared by the player and the bots: fire rate,
   CS:GO inaccuracy, the aim-punch spray, reloads, deploys, zoom, the knife's
   two attacks and grenade throws. Input arrives as a small command object. */

export function newInstance(id) {
  const w = W[id]
  return { id, clip: w.clip ?? 0, reserve: w.reserve ?? 0 }
}

/** Put a weapon in its slot. Returns whatever it displaced (for dropping). */
export function giveWeapon(a, id) {
  const w = W[id]
  if (w.slot === 4) {
    const same = a.inv[4].filter(g => g.id === id).length
    if (same >= (w.max ?? 1) || a.inv[4].length >= 4) return null
    a.inv[4].push({ id })
    return null
  }
  const old = a.inv[w.slot]
  a.inv[w.slot] = newInstance(id)
  return old && old.id !== 'knife' ? old : null
}

export function hasSlot(a, slot) {
  return slot === 4 ? a.inv[4].length > 0 : !!a.inv[slot]
}

export function switchTo(a, slot, { quiet = false } = {}) {
  if (!hasSlot(a, slot)) return false
  if (slot === a.active) {
    // pressing the grenade slot again cycles through the grenades
    if (slot === 4 && a.inv[4].length > 1) a.inv[4].push(a.inv[4].shift())
    else return false
  }
  if (a.active !== slot) a.lastActive = a.active
  a.active = slot
  const w = W[activeWeapon(a).id]
  a.w.deployEnd = game.time + (w.deploy ?? 1)
  a.w.nextAttack = Math.max(a.w.nextAttack, game.time + (w.deploy ?? 1) * 0.6)
  a.w.reloadEnd = 0
  a.w.zoom = 0
  a.w.ads = false
  a.w.leanAim = false
  a.w.resumeZoom = 0
  a.w.throwing = 0
  a.w.shots = 0
  a.w.deploySeq++
  a.planting = 0
  if (!quiet) emit('deploy', { agent: a, weapon: w.id })
  return true
}

/** Best slot to fall back to after losing the current weapon. */
export function bestSlot(a) {
  for (const s of [1, 2, 3]) if (hasSlot(a, s)) return s
  return 3
}

/* ---------------------------------------------------------- accuracy ---- */

/** Current inaccuracy in milliradians (without spread). */
export function inaccuracy(a) {
  const inst = activeWeapon(a)
  const w = inst && W[inst.id]
  if (!w?.inacc) return 0
  const I = w.inacc
  const scoped = a.w.zoom > 0
  const ducked = a.duck > 0.5 && a.onGround
  let base = ducked ? I.crouch : I.stand
  if (scoped && I.standScoped) base = ducked ? I.crouchScoped : I.standScoped
  // sights steady the first shot and the walk, not the spray
  if (a.w.ads) base *= 0.55
  const speedU = Math.hypot(a.vel.x, a.vel.z) / U
  const maxU = (scoped && w.speedScoped) || w.speed
  const frac = THREE.MathUtils.clamp((speedU - maxU * 0.34) / (maxU * 0.66), 0, 1)
  const move = I.move * frac * (a.w.ads ? 0.8 : 1)
  const air = a.onGround ? 0 : I.jump
  return base + move + air + a.w.penalty
}

/* --------------------------------------------------------------- tick ---- */

const _eye = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()

/**
 * @param {object} cmd { attack, attack2, reload, attackPressed, attack2Pressed }
 */
export function weaponTick(a, cmd, dt) {
  const now = game.time
  const ws = a.w
  const inst = activeWeapon(a)
  const w = inst ? W[inst.id] : null

  // --- recoil recovery ---
  const spraying = w?.auto && ws.triggerHeld && now - ws.lastShot < w.cycle * 1.6
  if (!spraying) {
    const len = Math.hypot(ws.punch.x, ws.punch.y)
    if (len > 0) {
      let nl = len * Math.exp(-RECOIL.weapon_recoil_decay2_exp * dt)
      nl = Math.max(0, nl - RECOIL.weapon_recoil_decay2_lin * dt)
      ws.punch.x *= nl / len; ws.punch.y *= nl / len
    }
    if (now - ws.lastShot > (w?.cycle ?? 0.1) + 0.04) ws.shots = Math.max(0, ws.shots - dt * Math.max(10, ws.shots * 3))
  }
  if (w?.inacc) ws.penalty *= Math.pow(0.1, dt / w.inacc.recover)

  const pressed = cmd.attack && !ws.triggerHeld
  ws.triggerHeld = !!cmd.attack
  // a click that lands a hair before the gun is ready (tapping a pistol, the
  // AWP's bolt) is kept for a moment and fires as soon as it can, instead of
  // being swallowed
  if (pressed) ws.clickAt = now
  if (!w || !a.alive) return

  // --- reload completion ---
  if (ws.reloadEnd && now >= ws.reloadEnd) {
    const need = w.clip - inst.clip
    const take = Math.min(need, inst.reserve)
    inst.clip += take; inst.reserve -= take
    ws.reloadEnd = 0
    ws.shots = 0
  }

  // --- zoom resumes after a bolt ---
  if (ws.resumeZoom && now >= ws.nextAttack && !ws.reloadEnd) { ws.zoom = ws.resumeZoom; ws.resumeZoom = 0 }

  // --- pending knife hit ---
  if (ws.knifePending && now >= ws.knifePending.at) {
    const heavy = ws.knifePending.heavy
    ws.knifePending = null
    eyePos(a, _eye)
    viewDir(a.yaw, a.pitch, _dir)
    knifeAttack(a, _eye, _dir, heavy)
  }

  if (now < ws.deployEnd - (w.deploy ?? 1) * 0.4 && w.type !== 'knife') return

  switch (w.type) {
    case 'pistol': case 'smg': case 'rifle': case 'sniper': {
      if (cmd.reload && !ws.reloadEnd && inst.clip < w.clip && inst.reserve > 0) startReload(a, w)
      // an empty gun reloads by itself, as soon as the last shot has cycled
      // (no click on an empty chamber needed first)
      if (inst.clip === 0 && inst.reserve > 0 && !ws.reloadEnd && now >= ws.nextAttack) startReload(a, w)
      if (cmd.attack2Pressed && canAds(w) && !ws.reloadEnd) {
        ws.ads = !ws.ads
        emit('ads', { agent: a, on: ws.ads })
      }
      if (cmd.attack2Pressed && w.zoom && !ws.reloadEnd) {
        ws.zoom = (ws.zoom + 1) % (w.zoom.length + 1)
        ws.resumeZoom = 0
        emit('zoom', { agent: a, level: ws.zoom })
      }
      const want = w.auto ? cmd.attack : pressed || now - (ws.clickAt ?? -9) < 0.18
      if (want && now >= ws.nextAttack && !ws.reloadEnd) {
        ws.clickAt = -9
        if (inst.clip > 0) fire(a, inst, w)
        else {
          ws.nextAttack = now + 0.2
          emit('dryfire', { agent: a })
          if (inst.reserve > 0) startReload(a, w)
        }
      }
      break
    }
    case 'knife': {
      if (now < ws.nextAttack) break
      if (cmd.attack2) {
        ws.nextAttack = now + 1.0
        ws.knifePending = { at: now + 0.21, heavy: true }
        ws.knifeHeavy = true; ws.knifeSeq++
        emit('knifeSwing', { agent: a, heavy: true })
      } else if (cmd.attack) {
        ws.nextAttack = now + 0.5
        ws.knifePending = { at: now + 0.135, heavy: false }
        ws.knifeHeavy = false; ws.knifeSeq++
        emit('knifeSwing', { agent: a, heavy: false })
      }
      break
    }
    case 'grenade': {
      if (!ws.throwing && (cmd.attack || cmd.attack2) && now >= ws.nextAttack) {
        ws.throwing = now
        ws.throwStrength = cmd.attack ? 1 : 0.45
        emit('pin', { agent: a })
      } else if (ws.throwing) {
        if (cmd.attack) ws.throwStrength = cmd.attack2 ? 0.7 : 1
        const held = cmd.attack || cmd.attack2
        // CS:GO throws on release, after the pin is out
        if (!held && now - ws.throwing > 0.25) {
          eyePos(a, _eye)
          viewDir(a.yaw, a.pitch, _dir)
          throwGrenade(a, inst.id, _eye, _dir, ws.throwStrength)
          ws.throwing = 0
          ws.throwSeq = (ws.throwSeq || 0) + 1
          ws.lastThrow = now
          a.inv[4].shift()
          ws.nextAttack = now + 0.5
          // next grenade, or back to the best gun
          setTimeoutSim(a, 0.45, () => {
            if (a.active !== 4) return
            if (a.inv[4].length) { a.w.deploySeq++; a.w.deployEnd = game.time + 0.5 }
            else switchTo(a, bestSlot(a))
          })
        }
      }
      break
    }
    default:
      break
  }
}

function startReload(a, w) {
  a.w.reloadEnd = game.time + w.reload
  a.w.reloadSeq++
  if (a.w.zoom) { a.w.resumeZoom = 0; a.w.zoom = 0 }
  a.w.ads = false
  emit('reload', { agent: a, weapon: w.id })
}

function fire(a, inst, w) {
  const ws = a.w
  const now = game.time
  inst.clip--
  ws.nextAttack = now + w.cycle
  ws.lastShot = now
  ws.fireSeq++

  // CS:GO's spread: two independent random offsets, one for the inaccuracy
  // cone and one for the weapon's fixed spread
  const inacc = inaccuracy(a) / 1000
  const spread = (w.inacc.spread ?? 0) / 1000
  const t1 = Math.random() * Math.PI * 2, r1 = Math.random() * inacc
  const t2 = Math.random() * Math.PI * 2, r2 = Math.random() * spread
  const sx = Math.cos(t1) * r1 + Math.cos(t2) * r2
  const sy = Math.sin(t1) * r1 + Math.sin(t2) * r2

  // leaning: the shoulder is braced on the cover, so the spray stays near the
  // sights the view shows (it is rolled, which made the full climb land off
  // to the side of where the crosshair sat)
  const k = ws.leanAim ? RECOIL.view_recoil_tracking + 0.3 : RECOIL.weapon_recoil_scale
  const yaw = a.yaw - ws.punch.x * k * D2R
  const pitch = a.pitch + ws.punch.y * k * D2R
  viewDir(yaw, pitch, _dir)
  _right.set(Math.cos(yaw), 0, -Math.sin(yaw))
  _up.crossVectors(_right, _dir).normalize()
  _dir.addScaledVector(_right, sx).addScaledVector(_up, sy).normalize()

  eyePos(a, _eye)
  fireBullet(a, _eye, _dir, inst.id)

  // aim punch for the next bullet
  const kick = w.kicks[Math.min(Math.floor(ws.shots), w.kicks.length - 1)]
  const jitter = w.pattern === 'pistol' ? (Math.random() - 0.5) * 0.6 * w.kick : (Math.random() - 0.5) * 0.08
  const brace = ws.leanAim ? 0.7 : 1
  ws.punch.x += (kick[0] + jitter) * RECOIL.kick_scale * brace
  ws.punch.y += kick[1] * RECOIL.kick_scale * brace
  ws.shots++
  ws.penalty += w.inacc.fire

  // bolt-actions drop out of the scope for the bolt; the autosnipers stay in
  if (w.type === 'sniper' && !w.auto) {
    if (ws.zoom) { ws.resumeZoom = ws.zoom; ws.zoom = 0 }
  }
  if (inst.clip === 0 && inst.reserve > 0 && a.isBot) {
    ws.pendingReload = now + 0.3
  }
}

/* A tiny timer queue on sim time, so things pause with the game. */
const timers = []
export function setTimeoutSim(owner, secs, fn) {
  timers.push({ at: game.time + secs, fn, owner })
}
export function runTimers() {
  for (let i = timers.length - 1; i >= 0; i--) {
    if (game.time >= timers[i].at) {
      const t = timers[i]
      timers.splice(i, 1)
      t.fn()
    }
  }
}
export function clearTimers() { timers.length = 0 }
