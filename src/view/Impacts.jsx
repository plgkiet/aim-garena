import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { impactQueue } from '../lib/impacts'
import { raycast } from '../world/collision'

const DECALS = 24
const HOLES = 180
const SPARKS = 700
const DUST = 700
const DROPS = 500
const SPLATS = 60

/* What each surface throws back, in the spirit of CS:GO's material system:
   metal is nearly all sparks, sand is nearly all dust, brick is both. */
const SURFACE = {
  wall: { spark: 12, dust: 10, dustColor: '#c9b193', decal: 0.11, gouge: 0.9 },
  wood: { spark: 5, dust: 11, dustColor: '#8d6a42', decal: 0.10, gouge: 1.0 },
  metal: { spark: 30, dust: 4, dustColor: '#9aa4b0', decal: 0.08, gouge: 0.7 },
  sand: { spark: 3, dust: 14, dustColor: '#d3bb92', decal: 0.14, gouge: 0.8 },
  flesh: { spark: 0, dust: 16, dustColor: '#8a0f0f', decal: 0, gouge: 0 },
}

/** Blood splat: an irregular blotch with droplets thrown off one side. */
function splatTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const blob = (x, y, r, a) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(95,6,6,${a})`)
    grad.addColorStop(0.7, `rgba(75,4,4,${a * 0.9})`)
    grad.addColorStop(1, 'rgba(60,2,2,0)')
    g.fillStyle = grad
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
  }
  for (let i = 0; i < 7; i++) blob(64 + (Math.random() - 0.5) * 30, 64 + (Math.random() - 0.5) * 30, 14 + Math.random() * 16, 0.9)
  for (let i = 0; i < 22; i++) {
    const a = -0.6 + Math.random() * 1.2, r = 30 + Math.random() * 30
    blob(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2 + Math.random() * 5, 0.85)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A bullet hole: dark core, a scorched ring, chipped edges. */
function holeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.22, 'rgba(10,8,6,0.95)')
  grad.addColorStop(0.4, 'rgba(40,30,22,0.55)')
  grad.addColorStop(1, 'rgba(60,45,30,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 12
    g.fillStyle = `rgba(20,15,10,${0.3 + Math.random() * 0.4})`
    g.beginPath(); g.arc(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 1 + Math.random() * 2.5, 0, 7); g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A gash: bright core fading out along a slightly curved stroke. */
function gashTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  for (const [w, a] of [[11, 0.4], [5, 0.8], [2, 1]]) {
    g.strokeStyle = `rgba(0,0,0,${a})`
    g.lineWidth = w
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(16, 88)
    g.quadraticCurveTo(64, 46, 112, 38)
    g.stroke()
  }
  // fray the ends so the mark does not read as a drawn line
  g.globalCompositeOperation = 'destination-out'
  const grad = g.createRadialGradient(64, 64, 26, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,1)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function blobTexture(inner, mid, outer) {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.4, mid)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

/** Shared pool bookkeeping for a Points cloud. */
function makePool(n) {
  return {
    next: 0,
    pos: new Float32Array(n * 3),
    vel: new Float32Array(n * 3),
    life: new Float32Array(n),
    span: new Float32Array(n),
    size: new Float32Array(n),
    color: new Float32Array(n * 3),
  }
}

/* uScale turns a world-space radius into pixels: viewportHeight / (2 tan(fov/2)),
   so a particle keeps its physical size whatever the window or FOV does. */
const VERT = `
  attribute float aLife; attribute float aSize; attribute vec3 aColor;
  varying float vL; varying vec3 vC;
  uniform float uScale;
  void main(){
    vL = aLife; vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / max(0.05, -mv.z);
  }`

/** Sparks, dust and blade gouges for knife hits. Lives in the world scene. */
export function Impacts() {
  const { size, camera } = useThree()
  const decalRef = useRef()
  const sparkRef = useRef()
  const dustRef = useRef()
  const flashRef = useRef()

  const gash = useMemo(() => gashTexture(), [])
  const sparkTex = useMemo(() => blobTexture('rgba(255,255,255,1)', 'rgba(255,214,140,0.9)', 'rgba(255,120,20,0)'), [])
  const dustTex = useMemo(() => blobTexture('rgba(255,255,255,0.75)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)'), [])

  const sparks = useMemo(() => makePool(SPARKS), [])
  const dust = useMemo(() => makePool(DUST), [])

  const buildGeo = (pool, n) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pool.pos, 3))
    g.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(n), 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(pool.size, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(pool.color, 3))
    return g
  }
  const sparkGeo = useMemo(() => buildGeo(sparks, SPARKS), [sparks])
  const dustGeo = useMemo(() => buildGeo(dust, DUST), [dust])

  const sparkMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: sparkTex }, uScale: { value: 500 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D uMap; varying float vL; varying vec3 vC;
      void main(){
        if (vL <= 0.0) discard;
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(t.rgb * vC, t.a * vL);
      }`,
  }), [sparkTex])

  const dustMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: { uMap: { value: dustTex }, uScale: { value: 500 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D uMap; varying float vL; varying vec3 vC;
      void main(){
        if (vL <= 0.0) discard;
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vC, t.a * vL * 0.42);
      }`,
  }), [dustTex])

  const decalGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const holeTex = useMemo(() => holeTexture(), [])
  const holeMat = useMemo(() => new THREE.MeshBasicMaterial({
    map: holeTex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  }), [holeTex])
  const holeRef = useRef()
  const holeNext = useRef(0)
  const splatTex = useMemo(() => splatTexture(), [])
  const splatMat = useMemo(() => new THREE.MeshBasicMaterial({
    map: splatTex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
  }), [splatTex])
  const splatRef = useRef()
  const splatNext = useRef(0)
  const drops = useMemo(() => makePool(DROPS), [])
  const dropGeo = useMemo(() => buildGeo(drops, DROPS), [drops])
  const dropMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMap: { value: dustTex }, uScale: { value: 500 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D uMap; varying float vL; varying vec3 vC;
      void main(){
        if (vL <= 0.0) discard;
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vC, min(1.0, t.a * 2.2) * min(1.0, vL * 2.0));
      }`,
  }), [dustTex])
  const dropRef = useRef()
  const decalMat = useMemo(() => new THREE.MeshBasicMaterial({
    map: gash, transparent: true, depthWrite: false, color: '#1a120b',
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  }), [gash])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const decalState = useRef({ next: 0, life: new Float32Array(DECALS), max: new Float32Array(DECALS) })
  const flashState = useRef({ t: 0, life: 0 })

  // instanced meshes start on the identity matrix — park every decal at zero
  // scale so the pool is invisible until something is actually hit
  useEffect(() => {
    const m = decalRef.current
    if (!m) return
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < DECALS; i++) m.setMatrixAt(i, zero)
    m.instanceMatrix.needsUpdate = true
    for (const [r, n] of [[holeRef, HOLES], [splatRef, SPLATS]]) {
      const h = r.current
      if (h) { for (let i = 0; i < n; i++) h.setMatrixAt(i, zero); h.instanceMatrix.needsUpdate = true }
    }
  }, [])

  const emit = (pool, n, hit, opts) => {
    const c = new THREE.Color(opts.color)
    for (let k = 0; k < n; k++) {
      const i = pool.next++ % pool.life.length
      pool.pos[i * 3] = hit.point.x + (Math.random() - 0.5) * opts.jitter
      pool.pos[i * 3 + 1] = hit.point.y + (Math.random() - 0.5) * opts.jitter
      pool.pos[i * 3 + 2] = hit.point.z + (Math.random() - 0.5) * opts.jitter
      const v = hit.normal.clone()
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(opts.spread))
        .normalize()
        .multiplyScalar(opts.speed * (0.4 + Math.random()))
      pool.vel[i * 3] = v.x; pool.vel[i * 3 + 1] = v.y; pool.vel[i * 3 + 2] = v.z
      pool.span[i] = pool.life[i] = opts.life * (0.6 + Math.random() * 0.8)
      pool.size[i] = opts.size * (0.6 + Math.random() * 0.9)
      const j = 1 - Math.random() * opts.vary
      pool.color[i * 3] = c.r * j; pool.color[i * 3 + 1] = c.g * j; pool.color[i * 3 + 2] = c.b * j
    }
  }

  const step = (pool, geo, gravity, drag, grow) => {
    const life = geo.attributes.aLife.array
    const size = geo.attributes.aSize.array
    let alive = false
    for (let i = 0; i < pool.life.length; i++) {
      if (pool.life[i] <= 0) { life[i] = 0; continue }
      alive = true
      pool.life[i] -= pool.dt
      pool.vel[i * 3 + 1] -= gravity * pool.dt
      const d = 1 - drag * pool.dt
      pool.vel[i * 3] *= d; pool.vel[i * 3 + 2] *= d
      pool.pos[i * 3] += pool.vel[i * 3] * pool.dt
      pool.pos[i * 3 + 1] += pool.vel[i * 3 + 1] * pool.dt
      pool.pos[i * 3 + 2] += pool.vel[i * 3 + 2] * pool.dt
      const u = Math.max(0, pool.life[i] / pool.span[i])
      life[i] = u
      size[i] = pool.size[i] * (1 + (1 - u) * grow)
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.aLife.needsUpdate = true
    geo.attributes.aSize.needsUpdate = true
    return alive
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    sparks.dt = dust.dt = dt
    const pxPerMetre = size.height / (2 * Math.tan((camera.fov * Math.PI / 180) / 2))
    sparkMat.uniforms.uScale.value = dustMat.uniforms.uScale.value = pxPerMetre
    const decals = decalRef.current, flash = flashRef.current

    // ---- drain new hits ----
    while (impactQueue.length) {
      const hit = impactQueue.shift()
      const S = SURFACE[hit.mat] || SURFACE.wall
      const heavy = hit.heavy ? 1.7 : 1

      if (hit.bullet) {
        const holes = holeRef.current
        if (holes && S.decal) {
          const i = holeNext.current++ % HOLES
          dummy.position.copy(hit.point).addScaledVector(hit.normal, 0.004)
          dummy.lookAt(hit.point.clone().add(hit.normal))
          dummy.rotateZ(Math.random() * Math.PI * 2)
          const s = 0.045 + Math.random() * 0.02
          dummy.scale.set(s, s, s)
          dummy.updateMatrix()
          holes.setMatrixAt(i, dummy.matrix)
          holes.instanceMatrix.needsUpdate = true
        }
        emit(sparks, Math.round(S.spark * 0.45), hit,
          { color: '#ffd79a', spread: 0.9, speed: 3.6, life: 0.18, size: 0.008, vary: 0.4, jitter: 0.01 })
        emit(dust, Math.round(S.dust * 0.7), hit,
          { color: S.dustColor, spread: 0.7, speed: 1.3, life: 0.55, size: 0.02, vary: 0.3, jitter: 0.03 })
        continue
      }
      if (hit.mat === 'flesh') {
        // no mist hanging in the air: droplets that fly out and fall, and
        // splats where they land (the wall behind, the floor underneath)
        const back = hit.normal.clone().negate()
        const spray = { point: hit.point, normal: back.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize() }
        emit(drops, Math.round(70 * heavy), spray,
          { color: '#6d0404', spread: 1.2, speed: 3.6, life: 1.1, size: 0.02, vary: 0.5, jitter: 0.04 })
        emit(drops, Math.round(24 * heavy), hit,
          { color: '#6d0404', spread: 1.3, speed: 1.6, life: 0.9, size: 0.016, vary: 0.5, jitter: 0.04 })
        const splats = splatRef.current
        if (splats) {
          const place = (h, dirHint) => {
            const i = splatNext.current++ % SPLATS
            const n = new THREE.Vector3(...h.normal)
            dummy.position.copy(h.p).addScaledVector(n, 0.005)
            dummy.lookAt(h.p.clone().add(n))
            // stretch along the spray direction on the surface
            dummy.rotateZ(Math.atan2(dirHint.y, dirHint.x) + (Math.random() - 0.5) * 0.6)
            const sc = (0.35 + Math.random() * 0.35) * heavy * h.k
            dummy.scale.set(sc, sc * 0.8, sc)
            dummy.updateMatrix()
            splats.setMatrixAt(i, dummy.matrix)
            splats.instanceMatrix.needsUpdate = true
          }
          // the wall behind the victim
          const wall = raycast(hit.point, back, 3.2)
          if (wall && wall.box) {
            const wp = hit.point.clone().addScaledVector(back, wall.t)
            place({ p: wp, normal: wall.normal, k: 1.3 - wall.t / 3.5 }, new THREE.Vector3(1, 0.2, 0))
            // a second, smaller one lower down, where it runs
            place({ p: wp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.25 - Math.random() * 0.2, (Math.random() - 0.5) * 0.3)), normal: wall.normal, k: 0.6 }, new THREE.Vector3(0, -1, 0))
          }
          // and the floor under them
          const floorOrigin = hit.point.clone().addScaledVector(back, 0.4)
          const down = raycast(floorOrigin, new THREE.Vector3(0, -1, 0), 2.5)
          if (down) {
            const fp = floorOrigin.clone().setY(floorOrigin.y - down.t)
            place({ p: fp, normal: down.normal, k: 1.1 }, new THREE.Vector3(back.x, back.z, 0))
            for (let k = 0; k < 2; k++) place({ p: fp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9 + back.x * 0.4, 0, (Math.random() - 0.5) * 0.9 + back.z * 0.4)), normal: down.normal, k: 0.5 }, new THREE.Vector3(back.x, back.z, 0))
          }
        }
        continue
      }

      if (decals) {
        const i = decalState.current.next++ % DECALS
        dummy.position.copy(hit.point).addScaledVector(hit.normal, 0.006)
        dummy.lookAt(hit.point.clone().add(hit.normal))
        dummy.rotateZ(Math.random() * Math.PI * 2)
        const s = S.decal * S.gouge * (0.8 + Math.random() * 0.5) * heavy
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        decals.setMatrixAt(i, dummy.matrix)
        decals.instanceMatrix.needsUpdate = true
        decalState.current.life[i] = 1
        decalState.current.max[i] = s
      }

      emit(sparks, Math.round(S.spark * heavy), hit,
        { color: '#ffcf8a', spread: 0.85, speed: 3.2, life: 0.28, size: 0.010, vary: 0.4, jitter: 0.02 })
      emit(dust, Math.round(S.dust * heavy), hit,
        { color: S.dustColor, spread: 1.1, speed: 0.85, life: 0.5, size: 0.014, vary: 0.3, jitter: 0.05 })

      if (flash && S.spark > 8) {
        flash.position.copy(hit.point).addScaledVector(hit.normal, 0.05)
        flashState.current.t = flashState.current.life = 0.1 * heavy
      }
    }

    if (sparkRef.current) sparkRef.current.visible = step(sparks, sparkGeo, 12, 2.4, 0)
    if (dustRef.current) dustRef.current.visible = step(dust, dustGeo, 1.4, 3.6, 1.1)
    drops.dt = dt
    dropMat.uniforms.uScale.value = pxPerMetre
    if (dropRef.current) dropRef.current.visible = step(drops, dropGeo, 9.8, 0.6, 0)

    // ---- impact flash ----
    if (flash) {
      const f = flashState.current
      f.t = Math.max(0, f.t - dt)
      flash.intensity = f.life > 0 ? 30 * (f.t / f.life) : 0
      flash.visible = flash.intensity > 0.01
    }

    // ---- gouges fade out over ~15 s ----
    if (decals) {
      let dirty = false
      for (let i = 0; i < DECALS; i++) {
        const l = decalState.current.life[i]
        if (l <= 0) continue
        const next = Math.max(0, l - dt * 0.07)
        decalState.current.life[i] = next
        if (next < 0.35) {
          decals.getMatrixAt(i, dummy.matrix)
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
          const s = decalState.current.max[i] * (next / 0.35)
          dummy.scale.set(s, s, s)
          dummy.updateMatrix()
          decals.setMatrixAt(i, dummy.matrix)
          dirty = true
        }
      }
      if (dirty) decals.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      <instancedMesh ref={decalRef} args={[decalGeo, decalMat, DECALS]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={holeRef} args={[decalGeo, holeMat, HOLES]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={splatRef} args={[decalGeo, splatMat, SPLATS]} frustumCulled={false} renderOrder={1} />
      <points ref={dropRef} geometry={dropGeo} material={dropMat} frustumCulled={false} renderOrder={2} />
      <points ref={dustRef} geometry={dustGeo} material={dustMat} frustumCulled={false} renderOrder={2} />
      <points ref={sparkRef} geometry={sparkGeo} material={sparkMat} frustumCulled={false} renderOrder={3} />
      <pointLight ref={flashRef} color="#ffd8a0" distance={2.6} intensity={0} />
    </group>
  )
}
