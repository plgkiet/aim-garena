import * as THREE from 'three'
import { player } from './playerState'

/* A port of Source's viewmodel maths (CS:GO flavour).

   Everything here works in *Source units* (1 unit = 1 inch) and degrees, exactly
   like the engine, then gets converted once at the end. That way the cvars below
   hold the same numbers you would type into the CS:GO console, and the motion
   curves come out with the same feel instead of hand-tuned lookalikes.

   Axis mapping, engine -> three (the viewmodel scene has the camera at the
   origin looking down -Z):
     forward -> -Z      right -> +X      up -> +Y
     PITCH (down+) -> -rotation.x        YAW (left+) -> +rotation.y
     ROLL (right+) -> -rotation.z        angle order YXZ                      */

export const U = 0.0254            // one Source unit, in metres
const D2R = Math.PI / 180
const MAX_SPEED = 320              // units/s, CS:GO run speed cap for bob
const M2U = 1 / U                  // metres/s -> units/s

/** CS:GO cvars. In dev these are on `window.VM`, so you can tune live. */
export const VM = {
  viewmodel_fov: 68,               // 54..68
  viewmodel_offset_x: 2.5,         // -2.5..2.5, right
  viewmodel_offset_y: 2,           // -2..2, forward
  viewmodel_offset_z: -1.5,        // -2..2, up
  viewmodel_recoil: 1,

  cl_bobcycle: 0.98,
  cl_bobup: 0.5,
  cl_bobamt_lat: 0.33,
  cl_bobamt_vert: 0.14,
  cl_bob_lower_amt: 21,

  cl_viewmodel_shift_left_amt: 1.5,
  cl_viewmodel_shift_right_amt: 0.75,

  cl_wpn_sway_interp: 0.1,
  max_lag: 1.5,                    // g_flMaxViewModelLag
  pitch_droop: 0.4,                // see calcLag — Source's numbers, scaled to a knife
  lag_scale: 1,                    // 0 disables the lag entirely
}

/** viewmodel_fov is a horizontal FOV quoted at 4:3 — three wants vertical. */
export function viewmodelVFov(fov = VM.viewmodel_fov) {
  return 2 * Math.atan(Math.tan(fov * 0.5 * D2R) / (4 / 3)) / D2R
}

/* ------------------------------------------------------------------ bob --- */

const bobState = { time: 0, lastSpeed: 0, vertical: 0, lateral: 0 }

/** CBaseCombatWeapon::CalcViewmodelBob, one for one. */
export function calcBob(dt) {
  let speed = player.speed * M2U
  // the engine refuses to let the bob speed jump more than 320 u/s²
  const maxDelta = Math.max(0, dt * 320)
  speed = THREE.MathUtils.clamp(speed, bobState.lastSpeed - maxDelta, bobState.lastSpeed + maxDelta)
  speed = THREE.MathUtils.clamp(speed, -MAX_SPEED, MAX_SPEED)
  bobState.lastSpeed = speed

  // airborne weapons stop bobbing
  const offset = THREE.MathUtils.clamp(speed / MAX_SPEED, 0, 1) * (player.grounded ? 1 : 0.15)
  bobState.time += dt * offset

  const wave = cycleLen => {
    let cycle = bobState.time - Math.floor(bobState.time / cycleLen) * cycleLen
    cycle /= cycleLen
    cycle = cycle < VM.cl_bobup
      ? Math.PI * cycle / VM.cl_bobup
      : Math.PI + Math.PI * (cycle - VM.cl_bobup) / (1 - VM.cl_bobup)
    const b = speed * 0.005
    return THREE.MathUtils.clamp(b * 0.3 + b * 0.7 * Math.sin(cycle), -7, 4)
  }
  // the cvars are ratios against their stock values, exactly as in the game
  bobState.vertical = wave(VM.cl_bobcycle) * (VM.cl_bobamt_vert / 0.14)
  bobState.lateral = wave(VM.cl_bobcycle * 2) * (VM.cl_bobamt_lat / 0.33)
  bobState.speedFrac = Math.abs(speed) / MAX_SPEED
  return bobState
}

/* ------------------------------------------------------------------ lag --- */

const lastFacing = new THREE.Vector3(0, 0, -1)
const _fwd = new THREE.Vector3()
const _diff = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler(0, 0, 0, 'YXZ')

/** CBaseViewModel::CalcViewModelLag — the weapon trails behind a fast flick. */
export function calcLag(dt, out) {
  _e.set(player.pitch, player.yaw, 0)
  _q.setFromEuler(_e)
  _fwd.set(0, 0, -1).applyQuaternion(_q)

  if (dt > 0) {
    _diff.subVectors(_fwd, lastFacing)
    let speed = 5
    const d = _diff.length()
    if (d > VM.max_lag && VM.max_lag > 0) speed *= d / VM.max_lag
    lastFacing.addScaledVector(_diff, Math.min(1, speed * dt)).normalize()
    // origin += -5 * diff  (world space) -> rotate into view space
    out.copy(_diff).multiplyScalar(-5 * VM.lag_scale).applyQuaternion(_q.invert())
  } else out.set(0, 0, 0)

  // ...then the pitch-driven droop, already expressed along view axes.
  // Source's coefficients assume a viewmodel whose mass sits ~20 units ahead of
  // the eye; a knife grip is half that, so the same numbers would swing it clean
  // off the bottom of the screen when you look down. pitch_droop scales it back.
  const pitchDeg = THREE.MathUtils.clamp(-player.pitch / D2R, -89, 89) * VM.pitch_droop
  out.x += -pitchDeg * 0.03
  out.y += -pitchDeg * 0.02
  out.z += pitchDeg * 0.035
  return out
}

/* ---------------------------------------------------------------- punch --- */

/* CS:GO's punch angles: an impulse that springs back to zero. Used for the
   little kick you feel when the blade actually connects with something. */
const punch = { x: 0, y: 0, vx: 0, vy: 0 }
export function addPunch(pitch, yaw) { punch.vx += pitch; punch.vy += yaw }
export function stepPunch(dt) {
  const damp = 9, spring = 65
  punch.vx += (-punch.x * spring - punch.vx * damp) * dt
  punch.vy += (-punch.y * spring - punch.vy * damp) * dt
  punch.x += punch.vx * dt
  punch.y += punch.vy * dt
  if (Math.abs(punch.x) < 1e-4 && Math.abs(punch.vx) < 1e-3) { punch.x = 0; punch.vx = 0 }
  if (Math.abs(punch.y) < 1e-4 && Math.abs(punch.vy) < 1e-3) { punch.y = 0; punch.vy = 0 }
  return punch
}
export const punchAngle = punch

/* -------------------------------------------------------------- compose --- */

const _pos = new THREE.Vector3()
const _lag = new THREE.Vector3()
const _ang = { pitch: 0, yaw: 0, roll: 0 }
const state = { shift: 0, lower: 0, air: 0, crouch: 0 }

/**
 * Full CS:GO viewmodel transform for this frame.
 * Writes metres/radians straight onto `arm` (position + YXZ rotation).
 */
export function applyViewmodel(arm, dt) {
  const bob = calcBob(dt)
  calcLag(dt, _lag)
  const p = stepPunch(dt)

  // cl_viewmodel_offset_*  (x right, y forward, z up)
  _pos.set(VM.viewmodel_offset_x, VM.viewmodel_offset_z, -VM.viewmodel_offset_y)
  _ang.pitch = 0; _ang.yaw = 0; _ang.roll = 0

  // --- bob: AddViewmodelBob ---
  _pos.z += bob.vertical * 0.1 * -1          // along forward
  _pos.y += bob.vertical * 0.1               // and a little more straight up
  _pos.x += bob.lateral * 0.8                // along right
  _ang.roll += bob.vertical * 0.5
  _ang.pitch -= bob.vertical * 0.4
  _ang.yaw -= bob.lateral * 0.3

  // --- cl_bob_lower_amt: the weapon sinks back as you pick up speed ---
  const lowerTarget = bob.speedFrac * (player.sprinting ? 1 : 0.72) * (player.grounded ? 1 : 0.35)
  state.lower += (lowerTarget - state.lower) * Math.min(1, dt * 8)
  _pos.z += VM.cl_bob_lower_amt * 0.05 * state.lower     // backwards, toward the eye
  _pos.y -= VM.cl_bob_lower_amt * 0.055 * state.lower
  _ang.pitch += 5.5 * state.lower
  _ang.roll += 4.0 * state.lower

  // --- cl_viewmodel_shift: strafing leans the weapon across the screen ---
  const strafe = THREE.MathUtils.clamp(player.strafe ?? 0, -1, 1)
  state.shift += (strafe - state.shift) * Math.min(1, dt * 6)
  const shiftAmt = state.shift < 0 ? VM.cl_viewmodel_shift_left_amt : VM.cl_viewmodel_shift_right_amt
  _pos.x += state.shift * shiftAmt * 0.6
  _ang.roll -= state.shift * shiftAmt * 2.2

  // --- lag / sway ---
  _pos.add(_lag)

  // --- jump & land ---
  state.air += ((player.grounded ? 0 : 1) - state.air) * Math.min(1, dt * 9)
  _pos.y += state.air * 0.9
  _ang.pitch -= state.air * 2.4
  _pos.y -= player.landImpulse * 2.6
  _ang.pitch += player.landImpulse * 7

  // --- crouch: tucked in a touch closer ---
  const crouch = player.crouching ? 1 : 0
  state.crouch += (crouch - state.crouch) * Math.min(1, dt * 9)
  _pos.y -= state.crouch * 0.35
  _pos.z -= state.crouch * 0.5
  _ang.roll += state.crouch * 1.5

  // --- hit punch ---
  _ang.pitch += p.x * VM.viewmodel_recoil
  _ang.yaw += p.y * VM.viewmodel_recoil
  _pos.z += p.x * 0.25

  arm.position.set(_pos.x * U, _pos.y * U, _pos.z * U)
  arm.rotation.order = 'YXZ'
  arm.rotation.set(-_ang.pitch * D2R, _ang.yaw * D2R, -_ang.roll * D2R)
  return { bob, punch: p, lower: state.lower }
}
