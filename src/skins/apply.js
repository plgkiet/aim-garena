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

/**
 * @param {THREE.Object3D} root   the weapon's own frame
 * @param {THREE.Mesh[]} meshes   the parts to paint
 * @param {object} skin
 * @param {'z'|'y'} long         the weapon's length axis (guns run down -Z, knives up +Y)
 * @param {THREE.Matrix4} [frame] the frame to project in, when it is not the
 *                                root's own (a model knife's alignment lives in its matrix)
 */
export function paintMeshes(root, meshes, skin, long = 'z', frame = null) {
  if (!meshes.length) return
  root.updateMatrixWorld(true)
  _inv.copy(frame ?? root.matrixWorld).invert()
  const across = long === 'z' ? 'y' : 'x'

  // extent of the painted parts along the weapon
  let lo = Infinity, hi = -Infinity, lo2 = Infinity
  const rel = new Map()
  for (const m of meshes) {
    const M = new THREE.Matrix4().multiplyMatrices(_inv, m.matrixWorld)
    rel.set(m, M)
    const pos = m.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(M)
      lo = Math.min(lo, _p[long]); hi = Math.max(hi, _p[long]); lo2 = Math.min(lo2, _p[across])
    }
  }
  const len = Math.max(0.05, hi - lo)
  const mat = skinMaterial(skin)
  for (const m of meshes) {
    const g = m.geometry.clone()
    const pos = g.attributes.position
    const uv = new Float32Array(pos.count * 2)
    _m.copy(rel.get(m))
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(_m)
      uv[i * 2] = (_p[long] - lo) / len
      // `vSpan` squeezes a tall, short weapon (a pistol) to fit the artwork's height
      uv[i * 2 + 1] = (_p[across] - lo2) / (len * 0.5 * (skin.vSpan ?? 1))
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    m.geometry = g
    m.material = mat
  }
}
