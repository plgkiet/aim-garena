/* Small keyframe engine used by the viewmodel.
   A move is a list of keys sorted by `t` (seconds). Every channel is an offset
   applied on top of the idle pose, so moves compose with sway / bob for free. */

export const Ease = {
  linear: t => t,
  in: t => t * t,
  out: t => 1 - (1 - t) * (1 - t),
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: t => t * t * t * t,
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outBack: t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * 2.0944) + 1),
  outBounce: t => {
    const n = 7.5625, d = 2.75
    if (t < 1 / d) return n * t * t
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
    return n * (t -= 2.625 / d) * t + 0.984375
  },
}

const CH = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'open', 'off', 'blur']
const ZERO = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, open: 0, off: 0, blur: 0 }

/** Fill a key with defaults inherited from the previous key (sticky channels). */
export function compile(move) {
  const keys = move.keys.map(k => ({ ...k }))
  let prev = { ...ZERO }
  for (const k of keys) {
    for (const c of CH) k[c] = k[c] === undefined ? prev[c] : k[c]
    k.e = k.e || 'inOut'
    prev = k
  }
  return { ...move, keys, duration: move.duration ?? keys[keys.length - 1].t }
}

/** Sample a compiled move at time t (seconds). Returns a plain channel object. */
export function sample(move, t, out = {}) {
  const keys = move.keys
  if (t <= keys[0].t) { for (const c of CH) out[c] = keys[0][c]; return out }
  const last = keys[keys.length - 1]
  if (t >= last.t) { for (const c of CH) out[c] = last[c]; return out }
  let i = 0
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++
  const a = keys[i], b = keys[i + 1]
  const span = Math.max(1e-6, b.t - a.t)
  const u = (Ease[b.e] || Ease.inOut)((t - a.t) / span)
  for (const c of CH) out[c] = a[c] + (b[c] - a[c]) * u
  return out
}

export const EMPTY = { ...ZERO }
