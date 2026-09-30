import * as THREE from 'three'

/* Sketchfab models arrive in arbitrary orientation, scale and pivot. Rather than
   hand-tuning magic numbers per file we run a small PCA over the vertices:
   longest axis -> +Y (tip up), widest axis -> +X (blade plane = XY),
   thinnest axis -> +Z (blade normal). Then we scale to a viewmodel-sized knife
   and move the origin onto the grip, so every trick rotates around the hand. */

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
