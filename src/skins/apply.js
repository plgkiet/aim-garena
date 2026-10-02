import * as THREE from 'three'
import { paintSkin, skinReady } from './patterns'

/* Put a skin on a built model.

   Each painted part gets its own copy of its geometry with UVs projected from
   its position on the whole weapon: along the length for u, across it for v,
   at the artwork's 2:1 aspect. So the painting is continuous from part to part
   and never stretched, whatever the part's own shape. */

const matCache = new Map()
export function skinMaterial(skin) {
  if (matCache.has(skin.id)) return matCache.get(skin.id)
  const tex = new THREE.CanvasTexture(paintSkin(skin))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  // photo finishes arrive a moment later: re-upload the canvas when they do
  if (skin.image) skinReady(skin).then(() => { tex.needsUpdate = true })
  const opts = { map: tex, metalness: skin.metal ?? 0.35, roughness: skin.rough ?? 0.45, envMapIntensity: 1.1 }
  // the stones: a lacquer coat and a thin-film sheen that shifts with the angle
  const m = skin.iridescent
    ? new THREE.MeshPhysicalMaterial({
      ...opts, envMapIntensity: 1.5, clearcoat: 1, clearcoatRoughness: 0.06,
      iridescence: 0.9, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 520],
    })
    : new THREE.MeshStandardMaterial(opts)
  matCache.set(skin.id, m)
  return m
}

const _p = new THREE.Vector3()
const _inv = new THREE.Matrix4()
const _m = new THREE.Matrix4()
const _n = new THREE.Vector3()
const _nm = new THREE.Matrix3()

/**
 * @param {THREE.Object3D} root   the weapon's own frame
 * @param {THREE.Mesh[]} meshes   the parts to paint
 * @param {object} skin
 * @param {'z'|'y'} long         the weapon's length axis (guns run down -Z, knives up +Y)
 * @param {THREE.Matrix4} [frame] the frame to project in, when it is not the
 *                                root's own (a model knife's alignment lives in its matrix)
 */
export function paintMeshes(root, meshes, skin, long = 'z', frame = null, primary = null) {
  if (!meshes.length) return
  root.updateMatrixWorld(true)
  _inv.copy(frame ?? root.matrixWorld).invert()
  const across = long === 'z' ? 'y' : 'x'
  const rel = new Map()
  for (const m of [...meshes, ...(primary ?? [])]) rel.set(m, new THREE.Matrix4().multiplyMatrices(_inv, m.matrixWorld))
  const each = (list, fn) => {
    for (const m of list) {
      const M = rel.get(m), pos = m.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) fn(_p.fromBufferAttribute(pos, i).applyMatrix4(M))
    }
  }
  // `primary` (the blade meshes): the artwork is laid along THEIR own long
  // axis, found from their points, rather than the weapon's, so a banner
  // finish follows a blade that sits at an angle (the Butterfly's) and its
  // extent is the blade's, not blade plus fittings
  let cs = 1, sn = 0, mx = 0, my = 0
  const ref = primary?.length ? primary : meshes
  // (only when the skin asks: `alignBlade`; a lug or a guard on the blade
  // piece would tilt the answer)
  if (primary?.length && skin.alignBlade) {
    let n = 0
    each(ref, p => { mx += p[long]; my += p[across]; n++ })
    mx /= n; my /= n
    // the direction in which the blade is narrowest across: unlike a
    // least-squares axis it is not pulled about by where the vertices are
    // dense (serrations, a clip point)
    const pts = []
    each(ref, p => pts.push(p[long] - mx, p[across] - my))
    let best = Infinity, th = 0
    for (let deg = -50; deg <= 50; deg += 1) {
      const c = Math.cos(deg * Math.PI / 180), s2 = Math.sin(deg * Math.PI / 180)
      let lo = Infinity, hi = -Infinity
      for (let i = 0; i < pts.length; i += 2) { const a = -pts[i] * s2 + pts[i + 1] * c; if (a < lo) lo = a; if (a > hi) hi = a }
      if (hi - lo < best) { best = hi - lo; th = deg * Math.PI / 180 }
    }
    cs = Math.cos(th); sn = Math.sin(th)
    if (cs < 0) { cs = -cs; sn = -sn }
  }
  const L = p => (p[long] - mx) * cs + (p[across] - my) * sn
  const A = p => -(p[long] - mx) * sn + (p[across] - my) * cs

  // extent of the painted parts along the weapon
  let lo = Infinity, hi = -Infinity, lo2 = Infinity, hi2 = -Infinity
  each(ref, p => { const l = L(p), a = A(p); lo = Math.min(lo, l); hi = Math.max(hi, l); lo2 = Math.min(lo2, a); hi2 = Math.max(hi2, a) })
  const len = Math.max(0.05, hi - lo)
  // `polarBlade`: a crescent blade. A circle is fitted to its points; u is
  // the angle round it (along the blade), v the radius (across it)
  let polar = null
  if (skin.polarBlade) {
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0
    each(ref, p => { const x = L(p), y = A(p), z = x * x + y * y; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z })
    // least squares for x^2 + y^2 + D x + E y + F = 0
    const M3 = new THREE.Matrix3().set(sxx, sxy, sx, sxy, syy, sy, sx, sy, n).invert()
    const v3 = new THREE.Vector3(-sxz, -syz, -sz).applyMatrix3(M3)
    const cx = -v3.x / 2, cy = -v3.y / 2
    const mid = Math.atan2(sy / n - cy, sx / n - cx)
    const ang = (x, y) => { let t = Math.atan2(y - cy, x - cx) - mid; while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI; return t }
    let t0 = Infinity, t1 = -Infinity, r0 = Infinity, r1 = -Infinity
    each(ref, p => { const x = L(p), y = A(p), t = ang(x, y), r = Math.hypot(x - cx, y - cy); t0 = Math.min(t0, t); t1 = Math.max(t1, t); r0 = Math.min(r0, r); r1 = Math.max(r1, r) })
    polar = p => { const x = L(p), y = A(p); return [(ang(x, y) - t0) / (t1 - t0), (Math.hypot(x - cx, y - cy) - r0) / (r1 - r0)] }
  }
  const mat = skinMaterial(skin)
  // a two-sided finish: faces looking out to the right take the top half of
  // the artwork, faces looking left the bottom half
  const two = !!skin.back
  const side = long === 'z' ? 'x' : 'z'
  for (const m of meshes) {
    const g = m.geometry.clone()
    const pos = g.attributes.position
    const nrm = g.attributes.normal
    const uv = new Float32Array(pos.count * 2)
    _m.copy(rel.get(m))
    if (two) _nm.getNormalMatrix(_m)
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(_m)
      uv[i * 2] = (L(_p) - lo) / len
      // `vSpan` squeezes a tall, short weapon (a pistol) to fit the artwork's height
      // `bladeFit`: the artwork is the blade's own picture, stretched to its width
      let v = skin.bladeFit ? (A(_p) - lo2) / Math.max(1e-4, hi2 - lo2) : (A(_p) - lo2) / (len * 0.5 * (skin.vSpan ?? 1))
      if (two && nrm) v = _n.fromBufferAttribute(nrm, i).applyMatrix3(_nm)[side] >= 0 ? 0.5 + v * 0.5 : v * 0.5
      uv[i * 2 + 1] = v
      if (polar) { const q = polar(_p); uv[i * 2] = q[0]; uv[i * 2 + 1] = q[1] }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    m.geometry = g
    m.material = mat
  }
}
