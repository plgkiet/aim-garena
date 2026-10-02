import { MOVE } from './constants'
import { hullBlocked, groundHeight, ceilingHeight, raycast } from '../world/collision'
import { game, eyeHeight, LEAN_DIST } from './state'
import { W } from './weapons'

/* CGameMovement, the parts CS:GO actually uses on the ground: Friction,
   Accelerate, AirAccelerate, the jump impulse and a stair-stepping slide move.
   Speeds are the engine's (see constants), so a knife runs at 250 u/s, an AK at
   215, shift walks at 52% and a duck at 34%. */

const R = MOVE.radius

/** Max ground speed for an agent right now, in m/s. */
export function maxSpeed(a) {
  const w = a.active === 4 ? W[a.inv[4][0]?.id] : W[a.inv[a.active]?.id]
  let s = (w?.speed ?? 250)
  if (a.w.zoom > 0 && w?.speedScoped) s = w.speedScoped
  if (a.w.ads) s *= 0.8
  s *= 0.0254
  if (a.duck > 0.5 && a.onGround) s *= MOVE.duck_modifier
  else if (a.walking) s *= MOVE.walk_modifier
  return s * a.velMod
}

function friction(a, dt) {
  const v = a.vel
  const speed = Math.hypot(v.x, v.z)
  if (speed < 0.001) { v.x = 0; v.z = 0; return }
  const control = Math.max(speed, MOVE.sv_stopspeed)
  const drop = control * MOVE.sv_friction * dt
  const ns = Math.max(0, speed - drop) / speed
  v.x *= ns; v.z *= ns
}

function accelerate(a, wx, wz, wishspeed, accel, dt) {
  const current = a.vel.x * wx + a.vel.z * wz
  const add = wishspeed - current
  if (add <= 0) return
  const as = Math.min(add, accel * dt * wishspeed)
  a.vel.x += as * wx
  a.vel.z += as * wz
}

/**
 * One tick of movement.
 * @param {object} cmd  { fwd, side (-1..1), jump, duck, walk }
 */
export function moveAgent(a, cmd, dt) {
  // --- duck ---
  const wantDuck = !!cmd.duck
  if (wantDuck && !a.ducking) {
    a.ducking = true
    // ducking in the air pulls the legs up: the crouch-jump
    if (!a.onGround) {
      const lift = MOVE.height - MOVE.heightDuck
      if (!hullBlocked(a.pos.x, a.pos.y + lift, a.pos.z, R, MOVE.heightDuck)) a.pos.y += lift
    }
  } else if (!wantDuck && a.ducking) {
    // stand only if there is room
    if (a.onGround) {
      if (!hullBlocked(a.pos.x, a.pos.y, a.pos.z, R, MOVE.height)) a.ducking = false
    } else {
      const drop = MOVE.height - MOVE.heightDuck
      const g = groundHeight(a.pos.x, a.pos.z, R, a.pos.y)
      const ny = Math.max(g, a.pos.y - drop)
      if (!hullBlocked(a.pos.x, ny, a.pos.z, R, MOVE.height)) { a.pos.y = ny; a.ducking = false }
    }
  }
  const duckTarget = a.ducking ? 1 : 0
  a.duck += Math.sign(duckTarget - a.duck) * Math.min(Math.abs(duckTarget - a.duck), MOVE.duckSpeed * dt)
  a.walking = !!cmd.walk

  // --- wish direction ---
  const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw)
  // forward (-sin, -cos), right (cos, -sin)
  let wx = -sy * cmd.fwd + cy * cmd.side
  let wz = -cy * cmd.fwd - sy * cmd.side
  const wl = Math.hypot(wx, wz)
  if (wl > 1e-4) { wx /= wl; wz /= wl }
  const wishspeed = wl > 1e-4 ? maxSpeed(a) : 0

  // --- jump ---
  if (cmd.jump && a.onGround && !a.jumpHeld) {
    a.vel.y = MOVE.sv_jump_impulse
    a.onGround = false
    a.jumped = true
  }
  a.jumpHeld = !!cmd.jump

  if (a.onGround) {
    friction(a, dt)
    accelerate(a, wx, wz, wishspeed, MOVE.sv_accelerate, dt)
    // the engine clamps ground speed to maxspeed
    const hs = Math.hypot(a.vel.x, a.vel.z), cap = Math.max(wishspeed, maxSpeed(a))
    if (hs > cap && cap > 0) { a.vel.x *= cap / hs; a.vel.z *= cap / hs }
  } else {
    const ws = Math.min(wishspeed, MOVE.sv_air_max_wishspeed)
    const current = a.vel.x * wx + a.vel.z * wz
    const add = ws - current
    if (add > 0 && wl > 1e-4) {
      const as = Math.min(add, MOVE.sv_airaccelerate * wishspeed * dt)
      a.vel.x += as * wx; a.vel.z += as * wz
    }
    a.vel.y -= MOVE.sv_gravity * dt
  }

  slide(a, dt)
  a.velMod = Math.min(1, a.velMod + dt * 1.1)
  updateLean(a, cmd.lean || 0, dt)
}

/* PUBG-style lean: the eye slides sideways and the body tilts. It can never
   put your head through a wall — the reach is clamped by a trace each tick. */
const _o = { x: 0, y: 0, z: 0 }, _d = { x: 0, y: 0, z: 0 }
function updateLean(a, target, dt) {
  const step = dt * 5.5
  a.lean += Math.max(-step, Math.min(step, target - a.lean))
  if (Math.abs(a.lean) < 1e-3) { a.lean = 0; return }
  const s = Math.sign(a.lean)
  _o.x = a.pos.x; _o.y = a.pos.y + eyeHeight(a); _o.z = a.pos.z
  _d.x = Math.cos(a.yaw) * s; _d.y = 0; _d.z = -Math.sin(a.yaw) * s
  const hit = raycast(_o, _d, LEAN_DIST + 0.16)
  if (hit) {
    const room = Math.max(0, (hit.t - 0.16) / LEAN_DIST)
    if (Math.abs(a.lean) > room) a.lean = s * room
  }
}

/** Axis-separated move with stair stepping. */
function slide(a, dt) {
  const h = a.ducking ? MOVE.heightDuck : MOVE.height
  const p = a.pos

  // wedged inside geometry (stepped in between two stair treads, slid under
  // a flight): lift out onto whatever is just above rather than staying stuck
  if (hullBlocked(p.x, p.y, p.z, R, h)) {
    for (let up = 0.1; up <= 0.61; up += 0.1) {
      if (!hullBlocked(p.x, p.y + up, p.z, R, h)) { p.y += up; a.vel.y = 0; break }
    }
  }

  for (const axis of ['x', 'z']) {
    const d = a.vel[axis] * dt
    if (Math.abs(d) < 1e-7) continue
    const nx = axis === 'x' ? p.x + d : p.x
    const nz = axis === 'z' ? p.z + d : p.z
    if (!hullBlocked(nx, p.y, nz, R, h)) { p.x = nx; p.z = nz; continue }
    // Source's StepMove: lift the hull a full step, move, then drop back onto
    // whatever is underneath. Lifting by the whole step (not just to the next
    // tread) is what lets a hull wider than one tread climb a staircase.
    if (a.onGround || a.vel.y <= 0) {
      const lift = MOVE.step
      if (!hullBlocked(nx, p.y + lift, nz, R, h - lift) && !hullBlocked(p.x, p.y + lift, p.z, R, h - lift)) {
        const top = groundHeight(nx, nz, R, p.y + lift)
        if (top >= p.y - 0.02 && top <= p.y + lift + 0.01) {
          p.x = nx; p.z = nz; p.y = Math.max(p.y, top)
          if (!a.onGround) { a.onGround = true; a.vel.y = 0 }
          continue
        }
      }
    }
    a.vel[axis] = 0
  }

  // vertical
  const ground = groundHeight(p.x, p.z, R, p.y + (a.onGround ? MOVE.step : 0.001))
  if (a.onGround && a.vel.y <= 0) {
    // stick to the floor going down stairs
    if (p.y - ground <= MOVE.step + 0.02) { p.y = ground; a.vel.y = 0; a.jumped = false; return }
    a.onGround = false
  }
  const ny = p.y + a.vel.y * dt
  if (a.vel.y > 0) {
    const ceil = ceilingHeight(p.x, p.z, R - 0.01, p.y + h)
    if (ny + h >= ceil) { p.y = ceil - h - 0.001; a.vel.y = 0; return }
    p.y = ny
    a.onGround = false
    return
  }
  const g = groundHeight(p.x, p.z, R, p.y + 0.001)
  if (ny <= g) {
    if (!a.onGround) a.landSpeed = -a.vel.y
    p.y = g; a.vel.y = 0; a.onGround = true; a.jumped = false
  } else {
    p.y = ny
    a.onGround = false
  }
}

/** Keep agents from standing inside each other. */
export function separateAgents() {
  const list = game.agents
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (!a.alive) continue
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]
      if (!b.alive) continue
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z
      if (Math.abs(a.pos.y - b.pos.y) > 1.5) continue
      const d = Math.hypot(dx, dz), min = R * 2
      if (d >= min || d < 1e-5) continue
      const push = (min - d) / 2 / d
      const ax = a.pos.x - dx * push, az = a.pos.z - dz * push
      const bx = b.pos.x + dx * push, bz = b.pos.z + dz * push
      if (!hullBlocked(ax, a.pos.y, az, R, MOVE.heightDuck)) { a.pos.x = ax; a.pos.z = az }
      if (!hullBlocked(bx, b.pos.y, bz, R, MOVE.heightDuck)) { b.pos.x = bx; b.pos.z = bz }
    }
  }
}
