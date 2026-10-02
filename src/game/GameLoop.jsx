import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { game, emit, eyePos, viewDir, activeWeapon } from './state'
import { input, consume, lookDelta } from './input'
import { moveAgent, separateAgents } from './movement'
import { weaponTick, switchTo, hasSlot, runTimers } from './weaponLogic'
import { updateGrenades } from './grenades'
import { updateRules, dropActive, pickupAimed } from './rules'
import { updateBots, canSee } from './bots'
import { D2R, RECOIL, BASE_FOV, hfovToVfov } from './constants'
import { raycast } from '../world/collision'
import { W, ADS_FOV, canAds } from './weapons'
import { level } from '../world/level'
import { killAgent } from './combat'
import { player } from '../lib/playerState'

/* The simulation tick. Runs first every frame (lowest priority number), before
   the characters and the viewmodel read the state it writes. */

const _eye = new THREE.Vector3()
const _dir = new THREE.Vector3()
const localCmd = { fwd: 0, side: 0, jump: false, duck: false, walk: false, attack: false, attack2: false, attack2Pressed: false, reload: false }

export function GameLoop({ onLockChange }) {
  const { camera, gl } = useThree()

  useEffect(() => {
    game.camera = camera
    const el = gl.domElement
    const onMove = e => {
      if (document.pointerLockElement !== el) return
      lookDelta(e.movementX, e.movementY)
    }
    const onLock = () => {
      const locked = document.pointerLockElement === el
      game.locked = locked
      onLockChange?.(locked)
      if (!locked) { input.keys = Object.create(null); input.mouse = [false, false, false] }
    }
    const down = e => {
      if (e.repeat) return
      mods(e)
      input.keys[e.code] = true
      input.pressed.add(e.code)
      if (game.locked && ['Space', 'Tab', 'ControlLeft', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) e.preventDefault()
    }
    const up = e => { input.keys[e.code] = false; mods(e) }
    // a modifier's keyup can go missing (released during a browser shortcut,
    // or while the window was away) and leave you crouched: every key and
    // mouse event says whether Shift / Ctrl are really down, so trust that
    const mods = e => {
      if (!e.shiftKey) { input.keys.ShiftLeft = false; input.keys.ShiftRight = false }
      if (!e.ctrlKey) { input.keys.ControlLeft = false; input.keys.ControlRight = false }
    }
    const blur = () => { input.keys = Object.create(null); input.mouse = [false, false, false] }
    const mdown = e => {
      if (document.pointerLockElement !== el) return
      mods(e)
      input.mouse[e.button] = true
      input.pressed.add('Mouse' + e.button)
    }
    const mup = e => { input.mouse[e.button] = false }
    const wheel = e => { if (game.locked) input.wheel += Math.sign(e.deltaY) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('pointerlockchange', onLock)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    window.addEventListener('mousedown', mdown)
    window.addEventListener('mouseup', mup)
    window.addEventListener('wheel', wheel, { passive: true })
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('pointerlockchange', onLock)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('mousedown', mdown)
      window.removeEventListener('mouseup', mup)
      window.removeEventListener('wheel', wheel)
    }
  }, [camera, gl, onLockChange])

  useFrame((_, rawDt) => {
    const dt = game.devDt || Math.min(rawDt, 0.05)   // devDt: fixed step for the test harness
    if (game.phase === 'menu' || !game.local) { idleCamera(camera, dt); return }
    if (game.paused || game.devFreeze) { input.pressed.clear(); placeCamera(camera, dt); return }

    game.time += dt
    const me = game.local

    // ---------------- local input ----------------
    const k = input.keys
    const canAct = game.locked && !game.buyOpen
    const frozen = game.phase === 'freeze'
    localCmd.fwd = canAct && !frozen ? (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) : 0
    localCmd.side = canAct && !frozen ? (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) : 0
    localCmd.jump = canAct && !frozen && !!k.Space
    localCmd.duck = canAct && !!(k.ControlLeft || k.ControlRight || k.KeyC || k.ShiftLeft || k.ShiftRight)
    localCmd.walk = false          // Shift crouches in this build (see duck)
    // PUBG-style lean on Q / E (hold)
    localCmd.lean = canAct ? (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0) : 0
    localCmd.attack = canAct && input.mouse[0]
    localCmd.attack2 = canAct && input.mouse[2]
    localCmd.attack2Pressed = canAct && consume('Mouse2')
    localCmd.reload = canAct && consume('KeyR')
    // read the click before it is thrown away: dead, it changes who you watch
    const clicked = consume('Mouse0')
    const rightClicked = !me.alive && localCmd.attack2Pressed

    if (me.alive && canAct) {
      for (let s = 1; s <= 5; s++) if (consume('Digit' + s)) switchTo(me, s)
      if (consume('KeyX')) switchTo(me, hasSlot(me, me.lastActive) ? me.lastActive : 3)
      if (consume('KeyG')) dropActive(me)
      if (consume('KeyF')) pickupAimed(me)
      if (consume('KeyV')) { me.w.inspectSeq++; emit('inspect', { agent: me }) }
      if (input.wheel) {
        const order = [1, 2, 3, 4, 5].filter(s => hasSlot(me, s))
        const i = order.indexOf(me.active)
        const next = order[(i + (input.wheel > 0 ? 1 : -1) + order.length) % order.length]
        if (next) switchTo(me, next)
        input.wheel = 0
      }
    } else if (!me.alive) {
      // dead: left click / Space for the next teammate, right click for the previous
      if (clicked || consume('Space')) nextSpectate(1)
      else if (rightClicked) nextSpectate(-1)
    }
    input.wheel = 0
    // knife tricks: only while the knife is out (1-5 stay weapon slots)
    // (R was read as reload above; with the knife out it plays a flourish instead)
    if (me.alive && me.active === 3 && canAct && localCmd.reload) emit('knifeTrick', { move: 'next' })
    me.wantUse = canAct && !!k.KeyF
    leanAim(me, localCmd.lean)
    me.wantPlant = canAct && input.mouse[0] && me.active === 5

    // ---------------- simulation ----------------
    updateBots(dt)
    for (const a of game.agents) {
      if (!a.alive) continue
      const cmd = a.isBot ? a.cmd : localCmd
      // no walking while planting, defusing, or in freeze time
      const pinned = a.planting > 0 || a.defusing > 0 || frozen
      if (pinned) { cmd._f = cmd.fwd; cmd._s = cmd.side; cmd.fwd = 0; cmd.side = 0; cmd.jump = false }
      moveAgent(a, cmd, dt)
      if (pinned) { cmd.fwd = cmd._f; cmd.side = cmd._s }
      const wcmd = frozen || a.planting > 0 ? NO_FIRE : cmd
      weaponTick(a, wcmd, dt)
      footsteps(a, dt)
      if (level.ready && a.pos.y < level.bounds.min.y - 6) killAgent(a, null, { weapon: 'world' })
      if (a.flashUntil < game.time) a.flashAmount = 0
    }
    separateAgents()
    updateGrenades(dt)
    runTimers()
    updateRules(dt)
    spotting()
    syncViewmodelState(me, dt)

    placeCamera(camera, dt)
    input.pressed.clear()
  }, -2)

  return null
}

const NO_FIRE = { attack: false, attack2: false, attack2Pressed: false, reload: false }

/* Footsteps: running (not walking, not ducked) is loud, as in CS:GO. */
function footsteps(a, dt) {
  if (!a.onGround) { a.stepAcc = 0; return }
  const speed = Math.hypot(a.vel.x, a.vel.z)
  const loud = speed > 110 * 0.0254 * 1.1 && !a.walking && a.duck < 0.5
  a.stepAcc = (a.stepAcc || 0) + speed * dt
  if (a.stepAcc > 1.55) {
    a.stepAcc = 0
    if (loud) emit('footstep', { agent: a })
  }
  if (a.landSpeed) {
    if (a.landSpeed > 4) emit('land', { agent: a, speed: a.landSpeed })
    if (a === game.local) player.landImpulse = Math.min(1, a.landSpeed / 6)
    a.landSpeed = 0
  }
}

/* Leaning with Q/E brings the gun up: ADS for ordinary guns, the first scope
   level for snipers. Letting go of the lean drops back out — unless you were
   already aiming before you leaned, in which case it leaves your aim alone. */
function leanAim(me, lean) {
  if (!me.alive) return
  const inst = activeWeapon(me)
  const w = inst && W[inst.id]
  const ws = me.w
  const leaning = lean !== 0
  if (leaning) {
    if (!ws.leanAim) { ws.leanAim = true; ws.leanAimedBefore = ws.ads || ws.zoom > 0 }
    // held every tick, so it comes back by itself after a reload or a bolt
    if (!ws.reloadEnd) {
      if (canAds(w)) ws.ads = true
      else if (w?.zoom && ws.zoom === 0 && !ws.resumeZoom) ws.zoom = 1
    }
  } else if (!leaning && ws.leanAim) {
    ws.leanAim = false
    if (!ws.leanAimedBefore) { ws.ads = false; if (w?.zoom) { ws.zoom = 0; ws.resumeZoom = 0 } }
  }
}

/* The Source viewmodel maths (lib/viewmodel) reads its inputs from here. */
function syncViewmodelState(me, dt) {
  player.yaw = me.yaw
  player.pitch = me.pitch
  player.speed = Math.hypot(me.vel.x, me.vel.z)
  player.strafe = localCmd.side
  player.grounded = me.onGround
  player.crouching = me.duck > 0.5
  player.sprinting = false
  player.landImpulse *= Math.exp(-6 * dt)
}

/* Radar spotting: enemies your team can see light up for everyone on it. */
let spotT = 0
function spotting() {
  spotT -= 1 / 60
  if (spotT > 0) return
  spotT = 0.1
  const me = game.local
  if (!me?.alive) return
  for (const t of game.agents) {
    if (!t.alive || t.team === me.team) continue
    if (canSee(me, t, 106)) t.spottedUntil = game.time + 1.2
  }
}

/* ---------------------------------------------------------------- camera --- */

const _off = new THREE.Vector3()
function placeCamera(camera, dt) {
  const me = game.local
  let fov = hfovToVfov(BASE_FOV)
  if (me?.alive) {
    eyePos(me, _eye)
    camera.position.copy(_eye)
    // the view kicks by aim punch * view_recoil_tracking; bullets go at 2x
    const t = RECOIL.view_recoil_tracking
    // leaning rolls the view with the head
    camera.rotation.set(me.pitch + me.w.punch.y * t * D2R, me.yaw - me.w.punch.x * t * D2R, -me.lean * 11 * D2R, 'YXZ')
    const inst = activeWeapon(me)
    const w = inst && W[inst.id]
    if (me.w.zoom && w?.zoom) fov = hfovToVfov(w.zoom[me.w.zoom - 1])
    else if (me.w.ads && ADS_FOV[w?.type]) fov = hfovToVfov(ADS_FOV[w.type])
    game.spectate = null
  } else {
    // dead: watch a teammate over the shoulder
    const target = spectateTarget()
    if (target) {
      eyePos(target, _eye)
      viewDir(target.yaw, target.pitch, _dir)
      _off.copy(_dir).multiplyScalar(-2.4)
      _off.y += 0.45
      const dist = _off.length()
      _off.normalize()
      const hit = raycast(_eye, _off, dist)
      const d = hit ? Math.max(0.3, hit.t - 0.2) : dist
      camera.position.copy(_eye).addScaledVector(_off, d)
      camera.lookAt(_eye.x + _dir.x * 6, _eye.y + _dir.y * 6, _eye.z + _dir.z * 6)
    } else {
      // everyone dead: slow orbit over the last death
      const t = game.time * 0.1
      camera.position.set(me.pos.x + Math.sin(t) * 6, me.pos.y + 4, me.pos.z + Math.cos(t) * 6)
      camera.lookAt(me.pos.x, me.pos.y + 0.5, me.pos.z)
    }
  }
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 30)
    if (Math.abs(camera.fov - fov) < 0.05) camera.fov = fov
    camera.updateProjectionMatrix()
  }
}

function spectateTarget() {
  const me = game.local
  const mates = game.agents.filter(a => a.alive && a.team === me.team)
  const pool = mates.length ? mates : game.agents.filter(a => a.alive)
  if (!pool.length) return null
  if (!game.spectate || !game.spectate.alive || !pool.includes(game.spectate)) {
    // after a short beat on your own body, jump to your killer's view like CS:GO, else a teammate
    if (game.time - me.deathTime < 2.2) return null
    game.spectate = pool[0]
  }
  return game.spectate
}

function nextSpectate(dir) {
  const me = game.local
  const mates = game.agents.filter(a => a.alive && a.team === me.team)
  const pool = mates.length ? mates : game.agents.filter(a => a.alive)
  if (!pool.length) return
  const i = pool.indexOf(game.spectate)
  game.spectate = pool[(i + dir + pool.length) % pool.length]
}

function idleCamera(camera) {
  // slow flyover of the map behind the main menu
  const t = performance.now() / 1000 * 0.04
  const c = level.ready ? level.bounds.getCenter(_off) : _off.set(0, 0, 0)
  const cx = c.x, cz = c.z
  camera.position.set(cx + Math.sin(t) * 55, 38, cz + Math.cos(t) * 55)
  camera.lookAt(cx, 0, cz)
}
