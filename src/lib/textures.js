import * as THREE from 'three'

/* ---------- tiny deterministic value-noise ---------- */
const hash = (x, y, s) => {
  let n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return n - Math.floor(n)
}
const smooth = t => t * t * (3 - 2 * t)
function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = smooth(x - xi), yf = smooth(y - yi)
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s)
  const c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s)
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf
}
function fbm(x, y, oct = 5, s = 1) {
  let v = 0, amp = 0.5, f = 1
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f, s + i); f *= 2; amp *= 0.5 }
  return v
}

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

/** Build a normal map out of a height callback (tiles seamlessly enough for our use). */
function normalFromHeight(size, heightAt, strength = 2.2) {
  const c = canvas(size), ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = heightAt(x, y)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)]
      const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x]
      const nx = (l - r) * strength, ny = (u - d) * strength, nz = 1
      const len = Math.hypot(nx, ny, nz)
      const i = (y * size + x) * 4
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function texFromCanvas(c, srgb = true) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

const mix = (a, b, t) => a + (b - a) * t
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`

/* ---------- desert sand ---------- */
export function makeSand(size = 512) {
  const c = canvas(size), ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 34, y / 34, 5, 3)
      const grain = hash(x, y, 9) * 0.16
      const v = n * 0.55 + grain
      const i = (y * size + x) * 4
      img.data[i] = mix(168, 214, v)
      img.data[i + 1] = mix(140, 186, v)
      img.data[i + 2] = mix(96, 132, v)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  // scattered pebbles
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = Math.random() * 1.8 + 0.4
    ctx.fillStyle = `rgba(${110 + Math.random() * 60 | 0},${95 + Math.random() * 50 | 0},70,${0.25 + Math.random() * 0.3})`
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill()
  }
  const normal = normalFromHeight(size, (x, y) => fbm(x / 20, y / 20, 4, 3) * 0.8 + hash(x, y, 9) * 0.2, 1.4)
  return { map: texFromCanvas(c), normalMap: normal }
}

/* ---------- sandstone brick wall ---------- */
export function makeWall(size = 512) {
  const c = canvas(size), ctx = c.getContext('2d')
  ctx.fillStyle = rgb(150, 126, 92); ctx.fillRect(0, 0, size, size)
  const rows = 8, bh = size / rows
  const brickH = (x, y) => {
    const row = Math.floor(y / bh)
    const off = (row % 2) * bh
    const bw = size / 4
    const bx = (x + off) % bw, by = y % bh
    const edge = Math.min(bx, bw - bx, by, bh - by)
    return edge < 4 ? 0.15 : 0.75 + fbm(x / 12, y / 12, 4, 5) * 0.25
  }
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * (size / 8)
    for (let col = -1; col < 5; col++) {
      const bw = size / 4
      const x = col * bw + off, y = row * bh
      const t = fbm(col * 3.1, row * 7.3, 2, 11)
      ctx.fillStyle = rgb(mix(148, 196, t), mix(124, 168, t), mix(88, 122, t))
      ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6)
      // weathering
      for (let i = 0; i < 40; i++) {
        const px = x + Math.random() * bw, py = y + Math.random() * bh
        ctx.fillStyle = `rgba(${90 + Math.random() * 80 | 0},${80 + Math.random() * 60 | 0},60,0.10)`
        ctx.fillRect(px, py, Math.random() * 22, Math.random() * 5)
      }
    }
  }
  return { map: texFromCanvas(c), normalMap: normalFromHeight(size, brickH, 2.6) }
}

/* ---------- wooden crate ---------- */
export function makeWood(size = 512) {
  const c = canvas(size), ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ring = Math.sin((y / 9) + fbm(x / 60, y / 12, 4, 21) * 7) * 0.5 + 0.5
      const v = ring * 0.5 + fbm(x / 8, y / 3, 3, 17) * 0.5
      const plank = Math.floor(y / (size / 6))
      const shade = 0.85 + (plank % 2) * 0.12
      const gap = (y % (size / 6)) < 4 ? 0.35 : 1
      const i = (y * size + x) * 4
      img.data[i] = mix(96, 176, v) * shade * gap
      img.data[i + 1] = mix(62, 126, v) * shade * gap
      img.data[i + 2] = mix(34, 74, v) * shade * gap
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const h = (x, y) => ((y % (size / 6)) < 4 ? 0.1 : 0.8) + fbm(x / 8, y / 4, 3, 17) * 0.2
  return { map: texFromCanvas(c), normalMap: normalFromHeight(size, h, 2.0) }
}

/* ---------- scratched painted metal (barrels) ---------- */
export function makeMetal(size = 512, base = [120, 60, 44]) {
  const c = canvas(size), ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rust = Math.max(0, fbm(x / 40, y / 40, 5, 31) - 0.45) * 2
      const v = 0.7 + fbm(x / 6, y / 6, 3, 33) * 0.5
      const i = (y * size + x) * 4
      img.data[i] = mix(base[0] * v, 132, rust)
      img.data[i + 1] = mix(base[1] * v, 86, rust)
      img.data[i + 2] = mix(base[2] * v, 52, rust)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  ctx.strokeStyle = 'rgba(30,22,18,0.5)'
  for (let i = 0; i < 3; i++) { ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, size * (0.25 + i * 0.25)); ctx.lineTo(size, size * (0.25 + i * 0.25)); ctx.stroke() }
  return { map: texFromCanvas(c), normalMap: normalFromHeight(size, (x, y) => fbm(x / 30, y / 30, 4, 31), 1.2) }
}

/** Procedural PMREM environment: warm desert sky + soft studio cards for metal highlights. */
export function makeEnvMap(gl) {
  const scene = new THREE.Scene()
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float h = d.y * 0.5 + 0.5;
          vec3 ground = vec3(0.36, 0.29, 0.20);
          vec3 horizon = vec3(0.95, 0.74, 0.45);
          vec3 zenith  = vec3(0.24, 0.42, 0.72);
          vec3 col = h < 0.5 ? mix(ground, horizon, smoothstep(0.32, 0.5, h))
                             : mix(horizon, zenith, smoothstep(0.5, 0.92, h));
          float sun = pow(max(0.0, dot(d, normalize(vec3(0.55, 0.42, -0.72)))), 90.0);
          col += vec3(1.0, 0.86, 0.62) * sun * 6.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  )
  scene.add(sky)
  const card = (x, y, z, sx, sy, intensity, color) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sy),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    )
    m.position.set(x, y, z); m.lookAt(0, 0, 0); scene.add(m)
  }
  card(3, 4, -4, 8, 8, 3.2, '#fff0d8')   // key
  card(-5, 2, 3, 7, 5, 1.1, '#9fc4ff')   // cool fill
  card(0, -4, 2, 9, 6, 0.5, '#b98f5c')   // bounce
  card(-1, 3, 6, 3, 9, 1.6, '#ffffff')   // rim streak — makes the blade read as metal

  const pmrem = new THREE.PMREMGenerator(gl)
  pmrem.compileEquirectangularShader()
  const rt = pmrem.fromScene(scene, 0.03)
  pmrem.dispose()
  sky.geometry.dispose(); sky.material.dispose()
  return rt.texture
}
