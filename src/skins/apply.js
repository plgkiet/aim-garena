import * as THREE from 'three'
import { paintSkin } from './patterns'

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
  const m = new THREE.MeshStandardMaterial({
    map: tex, metalness: skin.metal ?? 0.35, roughness: skin.rough ?? 0.45, envMapIntensity: 1.1,
  })
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
 */
export function paintMeshes(root, meshes, skin, long = 'z') {
  if (!meshes.length) return
  root.updateMatrixWorld(true)
  _inv.copy(root.matrixWorld).invert()
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
      uv[i * 2 + 1] = (_p[across] - lo2) / (len * 0.5)
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    m.geometry = g
    m.material = mat
  }
}
