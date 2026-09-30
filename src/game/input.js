import { game } from './state'
import { D2R } from './constants'
import { W, ADS_FOV } from './weapons'

/* Raw input for the local player. Mouse look is applied straight to the
   agent's angles as events arrive (lowest latency); everything else is sampled
   by the game loop once per tick. */

export const input = {
  keys: Object.create(null),
  mouse: [false, false, false],
  pressed: new Set(),     // key codes / 'Mouse0' etc. pressed since the last tick
  wheel: 0,
}

/** CS:GO: m_yaw / m_pitch are 0.022 degrees per count, times sensitivity. */
const M_YAW = 0.022

export function lookDelta(dx, dy) {
  const a = game.local
  if (!a || game.paused) return
  const zoomScale = a.w.zoom > 0 ? zoomSensitivity(a) : a.w.ads ? adsSensitivity(a) : 1
  const k = M_YAW * game.settings.sensitivity * zoomScale * D2R
  const target = a.alive ? a : null
  if (target) {
    target.yaw -= dx * k
    target.pitch -= dy * k
    target.pitch = Math.max(-89 * D2R, Math.min(89 * D2R, target.pitch))
  }
  game.lookDX = (game.lookDX || 0) + dx * k
  game.lookDY = (game.lookDY || 0) + dy * k
}

function adsSensitivity(a) {
  const inst = a.active === 4 ? null : a.inv[a.active]
  const f = ADS_FOV[W[inst?.id]?.type] ?? 90
  return Math.tan((f * D2R) / 2) / Math.tan((90 * D2R) / 2)
}

/** zoom_sensitivity_ratio_mouse 1: scale by the ratio of the FOVs. */
function zoomSensitivity(a) {
  const fovs = { 1: 40, 2: a.inv[1]?.id === 'awp' ? 10 : 15 }
  const f = fovs[a.w.zoom] ?? 90
  return Math.tan((f * D2R) / 2) / Math.tan((90 * D2R) / 2)
}

export function consume(code) {
  if (input.pressed.has(code)) { input.pressed.delete(code); return true }
  return false
}

export function clearInput() {
  input.keys = Object.create(null)
  input.mouse = [false, false, false]
  input.pressed.clear()
  input.wheel = 0
}
