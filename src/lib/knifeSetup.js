import * as THREE from 'three'

/* Sketchfab models arrive in arbitrary orientation, scale and pivot. Rather than
   hand-tuning magic numbers per file we run a small PCA over the vertices:
   longest axis -> +Y (tip up), widest axis -> +X (blade plane = XY),
   thinnest axis -> +Z (blade normal). Then we scale to a viewmodel-sized knife
   and move the origin onto the grip, so every trick rotates around the hand. */

/** Freeze skinned meshes (knives ripped from CS viewmodels ship rigged) into
    plain meshes in their bound pose: their vertices only land in place through
    the bones, so measuring or repainting them as-is reads garbage. */
export function bakeSkins(root) {
  root.updateMatrixWorld(true)
  const skinned = []
  root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o) })
  const v = new THREE.Vector3()
  for (const sm of skinned) {
    const g = sm.geometry.clone()
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { sm.getVertexPosition(i, v); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight')
    g.deleteAttribute('normal'); g.computeVertexNormals()
    g.computeBoundingBox(); g.computeBoundingSphere()
    const m = new THREE.Mesh(g, sm.material)
    m.name = sm.name
    m.position.copy(sm.position); m.quaternion.copy(sm.quaternion); m.scale.copy(sm.scale)
    sm.parent.add(m)
    sm.parent.remove(sm)
  }
  return skinned.length
}

/** Cut a one-piece knife into blade and handle at a height (in the normalised
    knife frame, blade up): triangles above `y` go to a new mesh named
    `blade_split`, so a finish can go on the blade alone. The frame is the
    root's parent's, where normalizeKnife left the knife standing. */
export function splitBladeAt(root, y) {
  root.updateMatrixWorld(true)
  const toRoot = root.parent ? new THREE.Matrix4().copy(root.parent.matrixWorld).invert() : new THREE.Matrix4()
  const meshes = []
  root.traverse(o => { if (o.isMesh && !o.name.startsWith('blade_split')) meshes.push(o) })
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position
    const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i)
    const M = new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld)
    const up = [], down = []
    for (let t = 0; t < idx.length; t += 3) {
      a.fromBufferAttribute(pos, idx[t]).applyMatrix4(M)
      b.fromBufferAttribute(pos, idx[t + 1]).applyMatrix4(M)
      c.fromBufferAttribute(pos, idx[t + 2]).applyMatrix4(M)
      ;((a.y + b.y + c.y) / 3 > y ? up : down).push(idx[t], idx[t + 1], idx[t + 2])
    }
    if (!up.length) continue
    const bg = g.clone(); bg.setIndex(up)
    const hg = g.clone(); hg.setIndex(down)
    mesh.geometry = hg
    const bm = new THREE.Mesh(bg, mesh.material)
    bm.name = 'blade_split'
    bm.position.copy(mesh.position); bm.quaternion.copy(mesh.quaternion); bm.scale.copy(mesh.scale)
    mesh.parent.add(bm)
  }
}

function collectPoints(root, stride = 3) {
  const pts = []
  const v = new THREE.Vector3()
  root.updateMatrixWorld(true)
  root.traverse(o => {
    if (!o.isMesh) return
    const pos = o.geometry.attributes.position
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
      pts.push(v.x, v.y, v.z)
    }
  })
  return pts
}

function principalAxes(pts) {
  const n = pts.length / 3
  const mean = new THREE.Vector3()
  for (let i = 0; i < n; i++) mean.x += pts[i * 3], mean.y += pts[i * 3 + 1], mean.z += pts[i * 3 + 2]
  mean.divideScalar(n)
  const c = new Array(9).fill(0)
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3] - mean.x, y = pts[i * 3 + 1] - mean.y, z = pts[i * 3 + 2] - mean.z
    c[0] += x * x; c[1] += x * y; c[2] += x * z
    c[4] += y * y; c[5] += y * z; c[8] += z * z
  }
  c[3] = c[1]; c[6] = c[2]; c[7] = c[5]
  for (let i = 0; i < 9; i++) c[i] /= n
  const M = new THREE.Matrix3().fromArray([c[0], c[3], c[6], c[1], c[4], c[7], c[2], c[5], c[8]])

  const power = (m, seed) => {
    let v = seed.clone().normalize()
    for (let i = 0; i < 64; i++) {
      v.applyMatrix3(m)
      if (v.lengthSq() < 1e-20) return seed.clone().normalize()
      v.normalize()
    }
    return v
  }
  const a1 = power(M, new THREE.Vector3(0.37, 0.61, 0.7))
  // deflate: M' = M - λ v vᵀ
  const Mv = a1.clone().applyMatrix3(M)
  const lambda = Mv.dot(a1)
  const e = M.elements.slice()
  const d = [a1.x, a1.y, a1.z]
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) e[col * 3 + row] -= lambda * d[row] * d[col]
  const M2 = new THREE.Matrix3().fromArray(e)
  let a2 = power(M2, new THREE.Vector3(0.8, -0.2, 0.55))
  a2.sub(a1.clone().multiplyScalar(a1.dot(a2))).normalize()
  const a3 = new THREE.Vector3().crossVectors(a1, a2).normalize()
  return { mean, a1, a2, a3 }
}

/**
 * @param {THREE.Object3D} model  raw gltf.scene (will be mutated)
 * @param {{length:number, gripAt:number, flip?:boolean, roll?:number}} cfg
 */
export function normalizeKnife(model, cfg) {
  const { length: targetLen, gripAt = 0.2, flip = false, roll = 0, pick = null } = cfg
  if (pick) keepOnly(model, pick)
  bakeSkins(model)
  const pts = collectPoints(model)
  const { mean, a1, a2, a3 } = principalAxes(pts)

  // Project onto the PCA frame to learn extents + which end is the grip.
  let minL = Infinity, maxL = -Infinity
  let thickNeg = 0, thickPos = 0, cntNeg = 0, cntPos = 0
  const p = new THREE.Vector3()
  for (let i = 0; i < pts.length; i += 3) {
    p.set(pts[i] - mean.x, pts[i + 1] - mean.y, pts[i + 2] - mean.z)
    const l = p.dot(a1), t = Math.abs(p.dot(a3))
    if (l < minL) minL = l
    if (l > maxL) maxL = l
    if (l < 0) { thickNeg += t; cntNeg++ } else { thickPos += t; cntPos++ }
  }
  // The handle end is the chunkier one; make it point down (-Y).
  const negIsHandle = thickNeg / Math.max(1, cntNeg) > thickPos / Math.max(1, cntPos)
  let up = a1.clone()
  if (!negIsHandle) up.negate()
  if (flip) up.negate()

  const len = maxL - minL
  const scale = targetLen / len
  const side = new THREE.Vector3().copy(a2)
  const normal = new THREE.Vector3().crossVectors(side, up).normalize()
  side.crossVectors(up, normal).normalize()

  // world -> aligned (rows of the basis), then scale, then drop the grip on the origin
  const basis = new THREE.Matrix4().makeBasis(side, up, normal)
  const R = new THREE.Matrix4().copy(basis).invert()
  const M = new THREE.Matrix4()
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .multiply(R)
    .multiply(new THREE.Matrix4().makeTranslation(-mean.x, -mean.y, -mean.z))

  model.applyMatrix4(M)
  model.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(model)
  const grip = box.min.y + (box.max.y - box.min.y) * gripAt
  model.applyMatrix4(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -grip, -(box.min.z + box.max.z) / 2))
  model.updateMatrixWorld(true)
  // one-piece knives: cut the blade off at the guard so it can take a finish
  if (cfg.bladeSplit != null) splitBladeAt(model, cfg.bladeSplit)
  if (roll) model.applyMatrix4(new THREE.Matrix4().makeRotationY(roll))
  model.updateMatrixWorld(true)

  return { box: new THREE.Box3().setFromObject(model) }
}

/** Some Sketchfab files ship several knives in one scene — drop everything
    outside the requested subtree so each entry is a single weapon. */
export function keepOnly(model, tokens) {
  const keep = findByTokens(model, tokens)
  if (!keep) return false
  const inside = new Set()
  keep.traverse(o => inside.add(o))
  const doomed = []
  model.traverse(o => { if (o.isMesh && !inside.has(o)) doomed.push(o) })
  for (const o of doomed) o.parent?.remove(o)
  return true
}

/** Find a descendant whose name contains every token (case-insensitive). */
export function findByTokens(root, tokens) {
  let hit = null
  const want = tokens.map(t => t.toLowerCase())
  root.traverse(o => {
    if (hit) return
    const n = o.name.toLowerCase()
    if (want.every(t => n.includes(t))) hit = o
  })
  return hit
}

export function centerOf(obj) {
  const b = new THREE.Box3().setFromObject(obj)
  return b.getCenter(new THREE.Vector3())
}

/**
 * Re-parent the butterfly handles onto pivot groups sitting on their blade bolts,
 * so `open` can actually fan them the way a real balisong does.
 * Returns [{group, sign}] or [] when the model has no separable handles.
 */
export function rigButterfly(model, spec) {
  if (!spec) return []
  if (spec.split) return rigButterflySplit(model, spec)
  const wings = []
  model.updateMatrixWorld(true)
  for (const w of spec) {
    const parts = w.parts.map(tokens => findByTokens(model, tokens)).filter(Boolean)
    const boltObj = findByTokens(model, w.bolt)
    if (!parts.length || !boltObj) continue
    const pivotWorld = centerOf(boltObj)
    const g = new THREE.Group()
    g.name = 'wingPivot'
    model.add(g)
    g.position.copy(model.worldToLocal(pivotWorld.clone()))
    g.updateMatrixWorld(true)
    for (const p of parts) g.attach(p)
    wings.push({ group: g, sign: w.sign, rest: g.rotation.z })
  }
  return wings
}

/** Split a mesh into its connected pieces (welded by position so UV seams
    don't cut a piece apart). Each piece shares the original vertex buffers
    and keeps only its own triangles. */
function splitMesh(mesh) {
  const g = mesh.geometry
  const pos = g.attributes.position
  const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i)
  const weld = new Map(), rep = new Int32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`
    if (!weld.has(k)) weld.set(k, i)
    rep[i] = weld.get(k)
  }
  const up = Int32Array.from({ length: pos.count }, (_, i) => i)
  const find = x => { while (up[x] !== x) { up[x] = up[up[x]]; x = up[x] } return x }
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(rep[idx[t]]), b = find(rep[idx[t + 1]]), c = find(rep[idx[t + 2]])
    up[a] = c; up[b] = c
  }
  const pieces = new Map()
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(rep[idx[t]])
    if (!pieces.has(r)) pieces.set(r, [])
    pieces.get(r).push(idx[t], idx[t + 1], idx[t + 2])
  }
  return [...pieces.values()].map(tris => {
    const sub = g.clone()
    sub.setIndex(tris)
    const m = new THREE.Mesh(sub, mesh.material)
    m.name = mesh.name
    m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale)
    // centroid of just this piece, in the mesh's own space
    const c = new THREE.Vector3(), v = new THREE.Vector3()
    for (const i of tris) c.add(v.fromBufferAttribute(pos, i))
    m.userData.centroid = c.divideScalar(tris.length)
    return m
  })
}

/* Butterfly files often merge both handles into each mesh (one mesh for both
   frames, one for both grip inlays, one for every screw), so splitting the
   rig by mesh sends a frame one way and its own inlays and screws the other.
   Instead: break every handle mesh into its pieces, find the two frames (the
   two biggest pieces of the frame mesh), and give each piece to the handle
   on its side of the line between them. Each handle then turns on the blade
   bolt it wraps. */
function rigButterflySplit(model, spec) {
  model.updateMatrixWorld(true)
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert()
  const keep = spec.keep.map(t => t.toLowerCase())
  const targets = []
  model.traverse(o => { if (o.isMesh && !keep.some(t => o.name.toLowerCase().includes(t))) targets.push(o) })
  const pieces = []
  for (const mesh of targets) {
    const parent = mesh.parent
    for (const p of splitMesh(mesh)) {
      parent.add(p)
      p.updateMatrixWorld(true)
      p.userData.at = p.userData.centroid.clone().applyMatrix4(p.matrixWorld).applyMatrix4(toModel)
      p.userData.size = p.geometry.index.count
      p.userData.frame = mesh.name.toLowerCase().includes(spec.frame.toLowerCase())
      pieces.push(p)
    }
    parent.remove(mesh)
  }
  const frames = pieces.filter(p => p.userData.frame).sort((a, b) => b.userData.size - a.userData.size).slice(0, 2)
  if (frames.length < 2) return []
  const a = frames[0].userData.at, b = frames[1].userData.at
  // a piece goes to the handle whose frame it actually sits on: the nearest
  // frame surface, not the side of the midline (a screw near the middle of a
  // closed knife could land on the wrong side by that and be left floating
  // when the handles swing open)
  const cloud = f => {
    const pos = f.geometry.attributes.position, M = new THREE.Matrix4().multiplyMatrices(toModel, f.matrixWorld)
    const out = [], v = new THREE.Vector3(), idx = f.geometry.index.array
    const step = Math.max(3, Math.floor(idx.length / 1500) * 3)
    for (let i = 0; i < idx.length; i += step) out.push(v.fromBufferAttribute(pos, idx[i]).applyMatrix4(M).clone())
    return out
  }
  const clouds = [cloud(frames[0]), cloud(frames[1])]
  const dist = (pts, at) => { let m = Infinity; for (const q of pts) { const d = q.distanceToSquared(at); if (d < m) m = d } return m }
  const pieceNear = (p, pts) => {
    // the piece's own nearest point to the frame, not just its centre
    const pos = p.geometry.attributes.position, idx = p.geometry.index.array, v = new THREE.Vector3()
    const M = new THREE.Matrix4().multiplyMatrices(toModel, p.matrixWorld)
    let m = Infinity
    for (let i = 0; i < idx.length; i += Math.max(3, Math.floor(idx.length / 60) * 3)) m = Math.min(m, dist(pts, v.fromBufferAttribute(pos, idx[i]).applyMatrix4(M)))
    return m
  }
  const side = p => p === frames[0] ? 0 : p === frames[1] ? 1 : (pieceNear(p, clouds[0]) <= pieceNear(p, clouds[1]) ? 0 : 1)
  // each handle turns on the blade bolt nearest its frame
  const bolts = spec.bolts.map(w => {
    const o = findByTokens(model, w.bolt)
    return o && { ...w, at: centerOf(o).applyMatrix4(toModel) }
  }).filter(Boolean)
  if (bolts.length < 2) return []
  const dA0 = bolts[0].at.distanceTo(a) + bolts[1].at.distanceTo(b)
  const dA1 = bolts[1].at.distanceTo(a) + bolts[0].at.distanceTo(b)
  const bySide = dA0 <= dA1 ? [bolts[0], bolts[1]] : [bolts[1], bolts[0]]
  const wings = bySide.map(w => {
    const g = new THREE.Group()
    g.name = 'wingPivot'
    model.add(g)
    g.position.copy(w.at)
    g.updateMatrixWorld(true)
    return { group: g, sign: w.sign, rest: g.rotation.z }
  })
  for (const p of pieces) wings[side(p)].group.attach(p)
  return wings
}

/** Beef up the metal so the blade actually reads as a CS:GO skin. */
export function dressMaterials(model, envMap, tint) {
  model.traverse(o => {
    if (!o.isMesh) return
    o.castShadow = false
    o.receiveShadow = false
    o.frustumCulled = false
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of mats) {
      if (!m || !m.isMeshStandardMaterial) continue
      m.envMap = envMap
      m.envMapIntensity = 1.9
      if (m.metalness !== undefined && m.metalness < 0.25 && /blade|metal|steel|screw|bolt/i.test(m.name)) m.metalness = 0.95
      if (/blade|metal|steel|screw|bolt/i.test(m.name)) m.roughness = Math.min(m.roughness ?? 0.4, 0.28)
      if (tint && /blade/i.test(m.name)) m.color.lerp(new THREE.Color(tint), 0.25)
      m.needsUpdate = true
    }
  })
}

/* A photo projected onto a model straight from the front, for a figure whose
   file has no texture (the Bearbrick): each vertex takes the pixel of the
   photo at its place across and up the figure, `rect` being where the figure
   stands in the photo. The photo's flat background is keyed out to black, so
   the silhouette's edges never pick up the backdrop.

   Only the front wears the photo. The back gets the same regions as plain
   colour: every pixel goes to the nearest of the `palette` colours, and the
   front's details (`details`: rectangles/circles in photo pixels, plus any
   bright or yellow pixel) are filled in from the colour beside them, so the
   back of the head is plain face colour, the back of the coat plain black,
   and so on. The texture holds both: front on the left half, back on the right. */
const photoMats = new Map()
const near = (r, g, b, p) => (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2
function flatBack(src, W, H, photo) {
  const d = src.data
  const out = new Uint8ClampedArray(d.length)
  const pal = photo.palette
  const isDetail = new Uint8Array(W * H)
  const base = new Int16Array(W * H).fill(-1)
  const lab = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, i = k * 4, r = d[i], g = d[i + 1], b = d[i + 2]
    let hit = (r > 150 && g > 140 && b < 120) || (r > 205 && g > 205 && b > 205)
    for (const m of photo.details ?? []) {
      if (m.length === 4 ? x >= m[0] && x <= m[2] && y >= m[1] && y <= m[3] : (x - m[0]) ** 2 + (y - m[1]) ** 2 <= m[2] ** 2) hit = true
    }
    if (hit) { isDetail[k] = 1; continue }
    let best = 0, bd = Infinity
    pal.forEach((p, j) => { const dd = near(r, g, b, p); if (dd < bd) { bd = dd; best = j } })
    base[k] = best
  }
  // fill each detail from the nearest plain pixel along its row
  for (let y = 0; y < H; y++) {
    const left = new Int16Array(W), right = new Int16Array(W)
    let last = -1, lx = -1e9
    const dl = new Float32Array(W), dr = new Float32Array(W)
    for (let x = 0; x < W; x++) { const k = y * W + x; if (!isDetail[k]) { last = base[k]; lx = x } left[x] = last; dl[x] = x - lx }
    last = -1; lx = 1e9
    for (let x = W - 1; x >= 0; x--) { const k = y * W + x; if (!isDetail[k]) { last = base[k]; lx = x } right[x] = last; dr[x] = lx - x }
    for (let x = 0; x < W; x++) {
      const k = y * W + x
      const j = isDetail[k] ? (dl[x] <= dr[x] ? left[x] : right[x]) : base[k]
      lab[k] = j < 0 ? 0 : j
    }
  }
  // a couple of majority passes wipe out the specks (highlights, stitching)
  // that would show as stray dots of colour on the plain back
  const n = pal.length, cnt = new Int32Array(n)
  for (let pass = 0; pass < 2; pass++) {
    const src2 = lab.slice()
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      cnt.fill(0)
      for (let dy = -3; dy <= 3; dy++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy))
        for (let dx = -3; dx <= 3; dx++) cnt[src2[yy * W + Math.min(W - 1, Math.max(0, x + dx))]]++
      }
      let best = 0
      for (let j = 1; j < n; j++) if (cnt[j] > cnt[best]) best = j
      lab[y * W + x] = best
    }
  }
  for (let k = 0; k < W * H; k++) {
    const p = pal[lab[k]], i = k * 4
    out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; out[i + 3] = 255
  }
  return new ImageData(out, W, H)
}

function photoMaterial(photo) {
  if (photoMats.has(photo.src)) return photoMats.get(photo.src)
  const [W, H] = photo.size
  const mk = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return [c, t]
  }
  const [cf, front] = mk(), [cb, flat] = mk()
  const img = new Image()
  let done
  const ready = new Promise(res => { done = res })
  img.onerror = () => done()
  img.onload = () => {
    const g = cf.getContext('2d')
    g.drawImage(img, 0, 0, W, H)
    const im = g.getImageData(0, 0, W, H), d = im.data
    if (photo.key) {
      const [kr, kg, kb] = photo.key
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - kr) + Math.abs(d[i + 1] - kg) + Math.abs(d[i + 2] - kb) < 70) { d[i] = 18; d[i + 1] = 18; d[i + 2] = 20 }
      }
      g.putImageData(im, 0, 0)
    }
    cb.getContext('2d').putImageData(photo.palette ? flatBack(im, W, H, photo) : im, 0, 0)
    front.needsUpdate = true; flat.needsUpdate = true
    done()
  }
  img.src = photo.src
  // the photo on faces turned to the front, the flat colours elsewhere,
  // blended smoothly by a per-vertex `facing` so no seam or fringe shows
  const mat = new THREE.MeshStandardMaterial({ map: front, roughness: photo.roughness ?? 0.32, metalness: photo.metalness ?? 0.05 })
  mat.onBeforeCompile = sh => {
    sh.uniforms.flatMap = { value: flat }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float facing;\nattribute vec2 uvFlat;\nvarying float vFacing;\nvarying vec2 vUvFlat;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFacing = facing;\nvUvFlat = uvFlat;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D flatMap;\nvarying float vFacing;\nvarying vec2 vUvFlat;')
      .replace('#include <map_fragment>', `
        vec4 photoC = texture2D( map, vMapUv );
        vec4 flatC = texture2D( flatMap, vUvFlat );
        diffuseColor *= mix( flatC, photoC, smoothstep( 0.55, 0.85, vFacing ) );`)
  }
  mat.customProgramCacheKey = () => 'photo-blend'
  mat.userData.ready = ready
  photoMats.set(photo.src, mat)
  return mat
}

export function applyPhoto(root, photo) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const [x0, y0, x1, y1] = photo.rect, [W, H] = photo.size
  const mat = photoMaterial(photo)
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3()
  const dir = photo.front ?? 1        // which way (along world Z) the photo's face looks
  root.traverse(o => {
    if (!o.isMesh) return
    const g = o.geometry.clone()
    const pos = g.attributes.position, nrm = g.attributes.normal
    nm.getNormalMatrix(o.matrixWorld)
    const uv = new Float32Array(pos.count * 2), uvFlat = new Float32Array(pos.count * 2), facing = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
      facing[i] = nrm ? n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize().z * dir : 1
      let fx = (v.x - box.min.x) / (box.max.x - box.min.x)
      if (photo.mirror) fx = 1 - fx
      const fy = (v.y - box.min.y) / (box.max.y - box.min.y)
      const py = 1 - (y1 - fy * (y1 - y0)) / H
      uv[i * 2] = (x0 + fx * (x1 - x0)) / W; uv[i * 2 + 1] = py
      // the flat colours are read a little inside the silhouette, clear of its dark outline
      uvFlat[i * 2] = (x0 + (0.5 + (fx - 0.5) * 0.86) * (x1 - x0)) / W; uvFlat[i * 2 + 1] = py
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setAttribute('uvFlat', new THREE.BufferAttribute(uvFlat, 2))
    g.setAttribute('facing', new THREE.BufferAttribute(facing, 1))
    o.geometry = g
    o.material = mat
  })
  // resolves once the photo is painted in (the thumbnails wait for it)
  return mat.userData.ready
}
