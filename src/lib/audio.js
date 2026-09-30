/* Procedural SFX — no asset files, everything is synthesised on the fly.
   World sounds are positional (HRTF panner + distance filtering + a shared
   reverb send), so you can hear which way a shot or a footstep came from. */
let ctx = null
let master = null
let reverb = null
let reverbSend = null
const ensure = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = volume
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    master.connect(comp).connect(ctx.destination)
    reverb = ctx.createConvolver()
    reverb.buffer = impulse(ctx, 1.6, 2.4)
    reverbSend = ctx.createGain()
    reverbSend.gain.value = 0.28
    reverbSend.connect(reverb).connect(master)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function impulse(c, secs, decay) {
  const len = Math.floor(c.sampleRate * secs)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

let noiseBuf = null
function noise(c) {
  if (noiseBuf) return noiseBuf
  noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

let muted = false
let volume = 0.8
export const setMuted = v => { muted = v; if (master) master.gain.value = v ? 0 : volume }
export const isMuted = () => muted
export const setVolume = v => { volume = v; if (master && !muted) master.gain.value = v }

/* ------------------------------------------------------------ listener --- */

const lis = { x: 0, y: 0, z: 0 }
export function updateListener(cam) {
  if (!ctx) return
  const L = ctx.listener
  const p = cam.position
  lis.x = p.x; lis.y = p.y; lis.z = p.z
  const e = cam.matrixWorld.elements
  // forward is -Z of the camera, up is +Y
  const fx = -e[8], fy = -e[9], fz = -e[10], ux = e[4], uy = e[5], uz = e[6]
  if (L.positionX) {
    const t = ctx.currentTime
    L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t)
    L.forwardX.setValueAtTime(fx, t); L.forwardY.setValueAtTime(fy, t); L.forwardZ.setValueAtTime(fz, t)
    L.upX.setValueAtTime(ux, t); L.upY.setValueAtTime(uy, t); L.upZ.setValueAtTime(uz, t)
  } else {
    L.setPosition(p.x, p.y, p.z)
    L.setOrientation(fx, fy, fz, ux, uy, uz)
  }
}

/** An output chain for a sound at `pos` (or at the listener when pos is null). */
function out(c, pos, { ref = 3, rolloff = 1.1, wet = 1, gain = 1 } = {}) {
  const g = c.createGain()
  g.gain.value = gain
  if (!pos) {
    g.connect(master)
    const s = c.createGain(); s.gain.value = 0.5 * wet
    g.connect(s).connect(reverbSend)
    return g
  }
  const dist = Math.hypot(pos.x - lis.x, pos.y - lis.y, pos.z - lis.z)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = Math.max(900, 20000 / (1 + dist / 7))
  const pan = c.createPanner()
  pan.panningModel = 'HRTF'
  pan.distanceModel = 'inverse'
  pan.refDistance = ref
  pan.rolloffFactor = rolloff
  pan.maxDistance = 200
  if (pan.positionX) { pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z }
  else pan.setPosition(pos.x, pos.y, pos.z)
  g.connect(lp).connect(pan).connect(master)
  const s = c.createGain()
  s.gain.value = Math.min(1, 0.25 + dist / 30) * wet
  g.connect(s).connect(reverbSend)
  return g
}

function env(g, now, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay)
}

function burst(c, dest, now, { type = 'lowpass', freq = 1000, q = 0.7, peak = 0.5, attack = 0.002, decay = 0.2, sweepTo }) {
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true
  src.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, now); f.Q.value = q
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, now + attack + decay)
  const g = c.createGain()
  env(g, now, peak, attack, decay)
  src.connect(f).connect(g).connect(dest)
  src.start(now, Math.random() * 0.8); src.stop(now + attack + decay + 0.05)
}

function tone(c, dest, now, { type = 'sine', from = 120, to = 50, peak = 0.5, attack = 0.002, decay = 0.2 }) {
  const o = c.createOscillator(); o.type = type
  o.frequency.setValueAtTime(from, now)
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + attack + decay)
  const g = c.createGain()
  env(g, now, peak, attack, decay)
  o.connect(g).connect(dest)
  o.start(now); o.stop(now + attack + decay + 0.05)
}

/* ------------------------------------------------------------ gunshots --- */

const GUN = {
  ak47: { body: 1100, low: 95, decay: 0.3, gain: 1.05, crack: 0.8 },
  galil: { body: 1300, low: 105, decay: 0.26, gain: 0.95, crack: 0.8 },
  m4a4: { body: 1700, low: 120, decay: 0.24, gain: 0.95, crack: 0.9 },
  famas: { body: 1800, low: 125, decay: 0.22, gain: 0.9, crack: 0.9 },
  m4a1s: { body: 1100, low: 0, decay: 0.09, gain: 0.45, silenced: true },
  usp: { body: 1300, low: 0, decay: 0.07, gain: 0.35, silenced: true },
  glock: { body: 2200, low: 170, decay: 0.13, gain: 0.7, crack: 0.9 },
  p250: { body: 1900, low: 150, decay: 0.16, gain: 0.8, crack: 0.9 },
  deagle: { body: 900, low: 80, decay: 0.4, gain: 1.25, crack: 1 },
  mac10: { body: 2100, low: 150, decay: 0.12, gain: 0.7, crack: 0.8 },
  mp9: { body: 2300, low: 160, decay: 0.11, gain: 0.65, crack: 0.8 },
  ump: { body: 1500, low: 120, decay: 0.16, gain: 0.8, crack: 0.8 },
  ssg08: { body: 1200, low: 90, decay: 0.45, gain: 1.1, crack: 1.1 },
  awp: { body: 700, low: 60, decay: 0.8, gain: 1.5, crack: 1.2 },
  g3sg1: { body: 950, low: 85, decay: 0.42, gain: 1.2, crack: 1.1 },
  scar20: { body: 1000, low: 90, decay: 0.4, gain: 1.15, crack: 1.1 },
}

export function gunshot(weapon, pos, local = false) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const P = GUN[weapon] || GUN.ak47
  const dest = out(c, local ? null : pos, { ref: P.silenced ? 2 : 6, rolloff: P.silenced ? 1.6 : 0.9, gain: local ? 0.75 : 1 })
  const k = P.gain
  if (P.silenced) {
    burst(c, dest, now, { type: 'bandpass', freq: P.body, q: 1.2, peak: 0.5 * k, attack: 0.001, decay: P.decay, sweepTo: 400 })
    burst(c, dest, now, { type: 'highpass', freq: 3500, peak: 0.15 * k, attack: 0.001, decay: 0.02 })
    tone(c, dest, now, { type: 'triangle', from: 2400, to: 900, peak: 0.05, decay: 0.04 })   // action cycling
    return
  }
  burst(c, dest, now, { type: 'highpass', freq: 2600, peak: 0.55 * P.crack * k, attack: 0.001, decay: 0.035 })
  burst(c, dest, now, { type: 'lowpass', freq: P.body, q: 0.9, peak: 0.9 * k, attack: 0.002, decay: P.decay, sweepTo: P.body * 0.35 })
  if (P.low) tone(c, dest, now, { from: P.low * 1.8, to: P.low * 0.5, peak: 0.7 * k, attack: 0.002, decay: P.decay * 0.8 })
  // mechanical tick of the action, only up close
  if (local) tone(c, dest, now + 0.015, { type: 'square', from: 3200, to: 1800, peak: 0.03, decay: 0.02 })
}

export function dryFire() {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, null)
  tone(c, d, now, { type: 'square', from: 1800, to: 900, peak: 0.08, decay: 0.03 })
}

/* Reload: mag out, mag in, bolt/slide — scheduled across the reload time. */
export function reloadSound(duration, pos, local) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, local ? null : pos, { ref: 2, rolloff: 1.8, gain: local ? 0.8 : 0.6 })
  const click = (t, f, p) => {
    burst(c, d, now + t, { type: 'bandpass', freq: f, q: 3, peak: p, attack: 0.001, decay: 0.05 })
    tone(c, d, now + t, { type: 'triangle', from: f * 1.3, to: f * 0.6, peak: p * 0.4, decay: 0.04 })
  }
  click(duration * 0.3, 1300, 0.22)
  click(duration * 0.72, 1600, 0.3)
  click(duration * 0.74, 900, 0.18)
  click(duration * 0.86, 2100, 0.2)
}

export function deploySound(local) {
  if (muted || !local) return
  const c = ensure(), now = c.currentTime
  const d = out(c, null, { gain: 0.6 })
  burst(c, d, now, { type: 'bandpass', freq: 900, q: 1.5, peak: 0.12, attack: 0.01, decay: 0.12, sweepTo: 2200 })
  tone(c, d, now + 0.12, { type: 'triangle', from: 1400, to: 700, peak: 0.08, decay: 0.05 })
}

/* ---------------------------------------------------------- footsteps ---- */

export function footstep(pos, local = false, surface = 'sand') {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, local ? null : pos, { ref: 2.5, rolloff: 1.4, gain: local ? 0.35 : 0.9, wet: 0.5 })
  const f = surface === 'wood' ? 700 : surface === 'metal' ? 1600 : 1100
  burst(c, d, now, { type: 'bandpass', freq: f, q: 0.9, peak: 0.4, attack: 0.004, decay: 0.07 })
  burst(c, d, now + 0.03, { type: 'lowpass', freq: 500, peak: 0.25, attack: 0.004, decay: 0.08 })
  tone(c, d, now, { from: 110, to: 60, peak: 0.25, decay: 0.06 })
}

export function landSound(pos, local) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, local ? null : pos, { ref: 2.5, rolloff: 1.4, gain: local ? 0.5 : 1 })
  burst(c, d, now, { type: 'lowpass', freq: 700, peak: 0.5, attack: 0.003, decay: 0.12 })
  tone(c, d, now, { from: 90, to: 45, peak: 0.35, decay: 0.1 })
}

/* --------------------------------------------------------------- hits ---- */

/** The meaty thwack of a body hit, and CS:GO's unmistakable helmet "dink". */
export function hitSound(kind, pos, local) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, local ? null : pos, { ref: 3, rolloff: 1.2, gain: local ? 0.8 : 1 })
  if (kind === 'helmet') {
    for (const f of [2900, 4100, 5600]) tone(c, d, now, { type: 'sine', from: f, to: f * 0.97, peak: 0.12, attack: 0.001, decay: 0.35 })
    burst(c, d, now, { type: 'highpass', freq: 4000, peak: 0.2, decay: 0.03 })
  } else if (kind === 'head') {
    burst(c, d, now, { type: 'bandpass', freq: 1600, q: 1.2, peak: 0.5, decay: 0.08 })
    tone(c, d, now, { from: 240, to: 90, peak: 0.4, decay: 0.12 })
  } else {
    burst(c, d, now, { type: 'lowpass', freq: 900, peak: 0.45, decay: 0.09 })
    tone(c, d, now, { from: 150, to: 60, peak: 0.35, decay: 0.1 })
  }
}

/* ----------------------------------------------------------- explosives -- */

export function explosion(pos, kind = 'he') {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const big = kind === 'c4'
  const d = out(c, pos, { ref: big ? 20 : 8, rolloff: 0.6, gain: big ? 1.6 : 1.2 })
  if (kind === 'flash') {
    burst(c, d, now, { type: 'highpass', freq: 1800, peak: 0.9, attack: 0.001, decay: 0.12 })
    burst(c, d, now, { type: 'lowpass', freq: 2500, peak: 0.6, attack: 0.001, decay: 0.3 })
    return
  }
  if (kind === 'smoke') {
    burst(c, d, now, { type: 'bandpass', freq: 3000, q: 0.6, peak: 0.25, attack: 0.05, decay: 2.2, sweepTo: 1200 })
    return
  }
  burst(c, d, now, { type: 'lowpass', freq: big ? 900 : 1600, peak: 1, attack: 0.003, decay: big ? 2.2 : 0.9, sweepTo: 120 })
  burst(c, d, now, { type: 'highpass', freq: 2000, peak: 0.5, attack: 0.001, decay: 0.08 })
  tone(c, d, now, { from: big ? 70 : 110, to: 25, peak: 1, attack: 0.004, decay: big ? 1.8 : 0.7 })
}

export function grenadeBounce(pos) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, pos, { ref: 2, rolloff: 1.5, gain: 0.7 })
  tone(c, d, now, { type: 'triangle', from: 1200 + Math.random() * 400, to: 500, peak: 0.25, decay: 0.07 })
  burst(c, d, now, { type: 'bandpass', freq: 2500, q: 2, peak: 0.2, decay: 0.04 })
}

/** Local tinnitus after a flash. */
export function flashRing(dur) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 3150
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(0.08, now + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  o.connect(g).connect(master)
  o.start(now); o.stop(now + dur + 0.1)
}

export function bombBeep(pos) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, pos, { ref: 6, rolloff: 0.8, gain: 0.7, wet: 0.4 })
  tone(c, d, now, { type: 'square', from: 2600, to: 2600, peak: 0.12, attack: 0.002, decay: 0.09 })
}

export function keypad(pos, local, n = 7) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, local ? null : pos, { ref: 3, rolloff: 1.3, gain: 0.7 })
  for (let i = 0; i < n; i++) tone(c, d, now + i * 0.32, { type: 'square', from: 1400 + (i % 3) * 350, to: 1400 + (i % 3) * 350, peak: 0.07, decay: 0.08 })
}

export function defuseSound(pos, local) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, local ? null : pos, { ref: 3, rolloff: 1.3, gain: 0.8 })
  burst(c, d, now, { type: 'bandpass', freq: 1200, q: 2, peak: 0.25, attack: 0.02, decay: 0.3 })
  tone(c, d, now + 0.2, { type: 'triangle', from: 900, to: 1500, peak: 0.1, decay: 0.2 })
}

export function uiClick(ok = true) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, null, { wet: 0.1, gain: 0.5 })
  tone(c, d, now, { type: 'triangle', from: ok ? 1500 : 400, to: ok ? 1900 : 300, peak: 0.12, decay: 0.06 })
}

/** Air being cut — a filtered noise sweep. */
export function swoosh(strength = 1, pos = null) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, pos, { ref: 2, rolloff: 1.5 })
  const dur = 0.16 + 0.1 * strength
  burst(c, d, now, { type: 'bandpass', freq: 700, q: 1.6, peak: 0.16 * strength, attack: dur * 0.3, decay: dur * 0.7, sweepTo: 3600 * strength + 900 })
}

/** Balisong handle slapping home / knife catch. */
export function clack(pitch = 1, gain = 0.22) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, null, { wet: 0.3 })
  burst(c, d, now, { type: 'highpass', freq: 1800 * pitch, peak: gain, attack: 0.001, decay: 0.055 })
  tone(c, d, now, { type: 'triangle', from: 2100 * pitch, to: 700 * pitch, peak: gain * 0.5, decay: 0.06 })
}

/** Blade sinking into something. */
export function thud(pos = null) {
  if (muted) return
  const c = ensure(), now = c.currentTime
  const d = out(c, pos, { ref: 2, rolloff: 1.4 })
  tone(c, d, now, { from: 180, to: 52, peak: 0.3, decay: 0.16 })
  burst(c, d, now, { type: 'highpass', freq: 1300, peak: 0.1, decay: 0.05 })
}

/* The radio announcer, via the browser's speech synthesiser. */
export function announce(text) {
  if (muted || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 1.05
    u.pitch = 0.8
    u.volume = 0.7
    const v = window.speechSynthesis.getVoices().find(v => /en-(US|GB)/.test(v.lang) && /male|daniel|alex|fred/i.test(v.name))
    if (v) u.voice = v
    window.speechSynthesis.speak(u)
  } catch { /* speech is optional */ }
}

export function unlockAudio() { try { ensure() } catch { /* user gesture will retry */ } }
