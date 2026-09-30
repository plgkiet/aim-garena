import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, on, eyePos, viewDir } from '../game/state'
import { W } from '../game/weapons'
import { RULES } from '../game/constants'
import { buildGun } from './guns'
import * as sfx from '../lib/audio'

/* World-side effects and the sound hookup: bullet tracers, third-person muzzle
   flashes, grenades in flight, smoke clouds, the planted bomb, and weapons
   lying on the floor. Everything is pooled and driven from the shared state. */

const TRACERS = 40
const _eye = new THREE.Vector3()
const _dir = new THREE.Vector3()

function softTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(c)
}

/* A puff of smoke: fractal noise under a soft round falloff, so overlapping
   sprites read as one billowing volume instead of a pile of discs. */
function cloudTexture(seed = 1) {
  const N = 128
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')
  const img = g.createImageData(N, N)
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const G = 16
  const grid = Array.from({ length: (G + 1) * (G + 1) }, rnd)
  const val = (x, y) => {
    const xi = Math.floor(x) % G, yi = Math.floor(y) % G, xf = x - Math.floor(x), yf = y - Math.floor(y)
    const sm = t => t * t * (3 - 2 * t)
    const a = grid[yi * (G + 1) + xi], b = grid[yi * (G + 1) + xi + 1], c2 = grid[(yi + 1) * (G + 1) + xi], d = grid[(yi + 1) * (G + 1) + xi + 1]
    const u = sm(xf), v = sm(yf)
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let n = 0, amp = 0.5, f = 4 / N
    for (let o = 0; o < 5; o++) { n += val(x * f, y * f) * amp; amp *= 0.5; f *= 2 }
    const dx = (x - N / 2) / (N / 2), dy = (y - N / 2) / (N / 2)
    const r = Math.sqrt(dx * dx + dy * dy)
    const fall = Math.max(0, 1 - r) ** 1.6
    const a = Math.max(0, Math.min(1, (n * 1.5 - 0.25) * fall * 1.6))
    const k = (y * N + x) * 4
    const shade = 200 + n * 55 - dy * 25          // lit from above
    img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.min(255, shade)
    img.data[k + 3] = a * 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Where a local shot visibly leaves from: roughly the viewmodel's muzzle. */
function localMuzzle(a, out) {
  eyePos(a, out)
  viewDir(a.yaw, a.pitch, _dir)
  const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw)
  return out.addScaledVector(_dir, 0.55).add(new THREE.Vector3(rx * 0.12, -0.11, rz * 0.12))
}

export function Effects() {
  const tracerGroup = useRef()
  const smokeGroup = useRef()
  const dropGroup = useRef()
  const nadeGroup = useRef()
  const bombRef = useRef()
  const bombLight = useRef()
  const flashLights = useRef([])
  const flashSprites = useRef([])

  const tracerGeo = useMemo(() => new THREE.CylinderGeometry(0.006, 0.006, 1, 5).rotateX(Math.PI / 2), [])
  const tracerMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe3a0', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [])
  const tracers = useMemo(() => Array.from({ length: TRACERS }, () => ({ mesh: new THREE.Mesh(tracerGeo, tracerMat), a: new THREE.Vector3(), b: new THREE.Vector3(), t: 0, len: 0, live: false })), [tracerGeo, tracerMat])
  const flashTex = useMemo(() => softTexture('rgba(255,235,180,1)', 'rgba(255,140,30,0)'), [])
  const cloudTex = useMemo(() => [cloudTexture(1), cloudTexture(2), cloudTexture(3)], [])
  const bombModel = useMemo(() => buildGun('c4', { shadows: true }), [])
  const smokeState = useRef(new Map())
  const dropModels = useRef(new Map())
  const nadeModels = useRef(new Map())
  const tracerNext = useRef(0)
  const flashNext = useRef(0)

  useEffect(() => {
    const g = tracerGroup.current
    for (const t of tracers) { t.mesh.visible = false; t.mesh.frustumCulled = false; g.add(t.mesh) }
  }, [tracers])

  // ------------------------------------------------------------ events --
  useEffect(() => {
    const offs = []
    const isLocal = a => a === game.local
    offs.push(on('shot', ({ shooter, weapon, origin, end }) => {
      const local = isLocal(shooter)
      sfx.gunshot(W[weapon]?.sound || weapon, origin, local)
      // tracer: most bullets for bots (so you can read where fire comes from), every third for you
      shooter.tracerN = (shooter.tracerN || 0) + 1
      const w = W[weapon]
      if (end && (!local || shooter.tracerN % 3 === 0 || w?.type === 'sniper')) {
        const t = tracers[tracerNext.current++ % TRACERS]
        if (local) localMuzzle(shooter, t.a)
        else t.a.copy(shooter.muzzleWorld || origin)
        t.b.copy(end)
        t.len = t.a.distanceTo(t.b)
        t.t = 0
        t.live = true
      }
      // muzzle light
      if (!w?.silenced) {
        const i = flashNext.current++ % 3
        const L = flashLights.current[i], S = flashSprites.current[i]
        const p = local ? localMuzzle(shooter, new THREE.Vector3()) : (shooter.muzzleWorld || origin)
        if (L) { L.position.copy(p); L.userData.t = 0.05 }
        if (S) { S.position.copy(p); S.userData.t = local ? 0 : 0.05; S.material.rotation = Math.random() * 6 }
      }
    }))
    offs.push(on('dryfire', ({ agent }) => { if (isLocal(agent)) sfx.dryFire() }))
    offs.push(on('reload', ({ agent, weapon }) => sfx.reloadSound(W[weapon].reload, agent.pos, isLocal(agent))))
    offs.push(on('deploy', ({ agent }) => sfx.deploySound(isLocal(agent))))
    offs.push(on('footstep', ({ agent }) => sfx.footstep(agent.pos, isLocal(agent))))
    offs.push(on('land', ({ agent }) => sfx.landSound(agent.pos, isLocal(agent))))
    offs.push(on('bulletHit', ({ victim, group, point, shooter }) => {
      const helmet = group === 'head' && victim.helmet && victim.armor > 0
      sfx.hitSound(helmet ? 'helmet' : group === 'head' ? 'head' : 'body', point, isLocal(victim) || isLocal(shooter))
      if (isLocal(shooter)) { game.hitConfirm = game.time; game.hitKill = !victim.alive || group === 'head' }
    }))
    offs.push(on('knifeSwing', ({ agent, heavy }) => { if (!isLocal(agent)) sfx.swoosh(heavy ? 1.3 : 1, agent.pos) }))
    offs.push(on('knifeHit', ({ point, attacker, victim }) => {
      sfx.thud(point)
      if (isLocal(attacker)) { game.hitConfirm = game.time; game.hitKill = !victim.alive }
    }))
    offs.push(on('knifeWall', ({ point }) => { sfx.thud(point); sfx.clack(0.7, 0.1) }))
    offs.push(on('explode', ({ pos, type }) => sfx.explosion(pos, type)))
    offs.push(on('grenadeBounce', ({ pos }) => sfx.grenadeBounce(pos)))
    offs.push(on('flashed', ({ amount, dur }) => { if (amount > 0.4) sfx.flashRing(dur) }))
    offs.push(on('bombBeep', ({ pos }) => sfx.bombBeep(pos)))
    offs.push(on('plantStart', ({ agent }) => sfx.keypad(agent.pos, isLocal(agent))))
    offs.push(on('defuseStart', ({ agent }) => sfx.defuseSound(agent.pos, isLocal(agent))))
    offs.push(on('pickup', ({ agent }) => { if (isLocal(agent)) sfx.uiClick(true) }))
    offs.push(on('buy', ({ agent }) => { if (isLocal(agent)) sfx.uiClick(true) }))
    offs.push(on('bombPlanted', () => sfx.announce('Bomb has been planted.')))
    offs.push(on('bombDefused', () => sfx.announce('Bomb has been defused.')))
    offs.push(on('roundEnd', ({ winner }) => {
      setTimeout(() => sfx.announce(winner === 'T' ? 'Terrorists win.' : 'Counter-terrorists win.'), game.roundReason === 'bomb' ? 900 : 200)
    }))
    offs.push(on('roundLive', () => {
      const me = game.local
      sfx.announce(me?.team === 'CT' ? "Let's move out." : "Let's go.")
    }))
    offs.push(on('damage', ({ victim, attacker }) => {
      if (victim !== game.local || !attacker) return
      const dx = attacker.pos.x - victim.pos.x, dz = attacker.pos.z - victim.pos.z
      game.damageDirs.push({ angle: Math.atan2(-dx, -dz), until: game.time + 1.2 })
      if (game.damageDirs.length > 6) game.damageDirs.shift()
    }))
    return () => offs.forEach(f => f())
  }, [tracers])

  // ------------------------------------------------------------- frame --
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    sfx.updateListener(state.camera)

    // tracers
    for (const t of tracers) {
      if (!t.live) { t.mesh.visible = false; continue }
      t.t += dt
      const speed = 420
      const head = t.t * speed
      const segLen = Math.min(3.2, t.len * 0.5)
      if (head - segLen > t.len) { t.live = false; t.mesh.visible = false; continue }
      const h = Math.min(head, t.len), tail = Math.max(0, head - segLen)
      const len = Math.max(0.01, h - tail)
      _dir.subVectors(t.b, t.a).normalize()
      t.mesh.position.copy(t.a).addScaledVector(_dir, (h + tail) / 2)
      t.mesh.lookAt(t.b)
      t.mesh.scale.set(1, 1, len)
      t.mesh.visible = true
    }

    // muzzle flashes
    for (const L of flashLights.current) {
      if (!L) continue
      L.userData.t = (L.userData.t || 0) - dt
      L.intensity = L.userData.t > 0 ? 6 : 0
    }
    for (const S of flashSprites.current) {
      if (!S) continue
      S.userData.t = (S.userData.t || 0) - dt
      S.visible = S.userData.t > 0
      if (S.visible) S.scale.setScalar(0.35 + Math.random() * 0.2)
    }

    // smoke clouds: puffs bloom out from the grenade, settle into a dome, drift and thin
    const sg = smokeGroup.current
    const live = new Set()
    let fog = 0
    const cam = state.camera.position
    for (const s of game.smokes) {
      live.add(s.id)
      let st = smokeState.current.get(s.id)
      if (!st) {
        st = { puffs: [] }
        for (let i = 0; i < 64; i++) {
          const mat = new THREE.SpriteMaterial({ map: cloudTex[i % 3], transparent: true, depthWrite: false, opacity: 0, fog: true })
          const sp = new THREE.Sprite(mat)
          // a squat dome: dense near the floor, rounded on top
          const ang = Math.random() * Math.PI * 2
          const rr = Math.sqrt(Math.random())
          const h = Math.pow(Math.random(), 1.3)
          sp.userData = {
            ox: Math.cos(ang) * rr, oz: Math.sin(ang) * rr, oy: h * (1 - rr * 0.45),
            delay: Math.random() * 1.1, size: 0.55 + Math.random() * 0.5,
            spin: (Math.random() - 0.5) * 0.25, phase: Math.random() * 6.28,
            tone: 0.72 + Math.random() * 0.12,
          }
          sp.material.rotation = Math.random() * 6.28
          sg.add(sp)
          st.puffs.push(sp)
        }
        smokeState.current.set(s.id, st)
      }
      const age = game.time - s.start
      const R = 144 * 0.0254                                   // CS:GO smoke radius
      const fade = THREE.MathUtils.clamp((s.end - game.time) / 3, 0, 1)
      for (const sp of st.puffs) {
        const u = sp.userData
        const grow = THREE.MathUtils.clamp((age - u.delay * 0.6) / 1.6, 0, 1)
        const e = 1 - Math.pow(1 - grow, 3)
        const drift = Math.sin(game.time * 0.35 + u.phase) * 0.18
        const rise = (1 - fade) * 0.8
        sp.position.set(
          s.pos.x + u.ox * R * e + drift,
          s.pos.y + 0.35 + u.oy * R * 0.95 * e + rise,
          s.pos.z + u.oz * R * e + Math.cos(game.time * 0.3 + u.phase) * 0.18,
        )
        const sc = (0.6 + e * 1.9) * u.size * 1.6
        sp.scale.set(sc, sc, 1)
        // lower puffs sit in their own shadow
        const light = u.tone + u.oy * 0.18
        sp.material.color.setRGB(light, light * 0.98, light * 0.95)
        sp.material.opacity = Math.min(1, grow * 4) * 0.62 * fade
        sp.material.rotation += u.spin * dt
      }
      // standing inside it greys the screen out, like the game
      const dx = cam.x - s.pos.x, dy = cam.y - (s.pos.y + 1.2), dz = cam.z - s.pos.z
      const d = Math.sqrt(dx * dx + dy * dy * 1.6 + dz * dz)
      const inside = THREE.MathUtils.clamp(1 - d / (R * Math.min(1, age / 1.5 + 0.01)), 0, 1)
      fog = Math.max(fog, Math.min(1, inside * 2.2) * fade)
    }
    game.smokeFog = fog
    for (const [id, st] of smokeState.current) {
      if (!live.has(id)) { for (const sp of st.puffs) { sg.remove(sp); sp.material.dispose() } smokeState.current.delete(id) }
    }

    // dropped weapons
    const dg = dropGroup.current
    const seen = new Set()
    for (const d of game.drops) {
      seen.add(d.key)
      let m = dropModels.current.get(d.key)
      if (!m) {
        const gun = buildGun(d.inst.id, { shadows: true })
        if (!gun) continue
        m = gun.group
        dg.add(m)
        dropModels.current.set(d.key, m)
      }
      m.position.copy(d.pos)
      m.rotation.set(0, d.rotY, Math.PI / 2, 'YXZ')
      if (d.inst.id === 'c4' || W[d.inst.id]?.type === 'grenade') m.rotation.set(0, d.rotY, 0)
    }
    for (const [k, m] of dropModels.current) if (!seen.has(k)) { dg.remove(m); dropModels.current.delete(k) }

    // grenades in flight
    const ng = nadeGroup.current
    const nseen = new Set()
    for (const g of game.grenades) {
      nseen.add(g.id)
      let m = nadeModels.current.get(g.id)
      if (!m) { m = buildGun(g.type, { shadows: true }).group; ng.add(m); nadeModels.current.set(g.id, m) }
      m.position.copy(g.pos)
      m.rotation.copy(g.rot)
    }
    for (const [k, m] of nadeModels.current) if (!nseen.has(k)) { ng.remove(m); nadeModels.current.delete(k) }

    // planted bomb with its blinking LED
    const b = game.bomb
    const planted = b && (b.state === 'planted' || b.state === 'defused')
    if (bombRef.current) {
      bombRef.current.visible = !!planted
      if (planted) {
        bombRef.current.position.set(b.pos.x, b.pos.y + 0.035, b.pos.z)
        const left = b.plantedAt + RULES.mp_c4timer - game.time
        const blink = b.state === 'planted' && (game.time - (b.nextBeep - Math.max(0.12, Math.min(1, left / 40)))) < 0.08
        if (bombLight.current) bombLight.current.intensity = blink ? 3 : 0
      }
    }
  })

  return (
    <group>
      <group ref={tracerGroup} />
      <group ref={smokeGroup} />
      <group ref={dropGroup} />
      <group ref={nadeGroup} />
      <group ref={bombRef} visible={false}>
        <primitive object={bombModel.group} />
        <pointLight ref={bombLight} position={[0.03, 0.08, 0]} color="#ff2a1a" distance={2} intensity={0} />
      </group>
      {[0, 1, 2].map(i => (
        <pointLight key={i} ref={el => { flashLights.current[i] = el }} color="#ffc070" distance={7} intensity={0} decay={1.6} />
      ))}
      {[0, 1, 2].map(i => (
        <sprite key={'s' + i} ref={el => { flashSprites.current[i] = el }} visible={false}>
          <spriteMaterial map={flashTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}
