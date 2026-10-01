import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshBVH } from 'three-mesh-bvh'
import { buildAimArena } from './maps/aimArena'

/* de_dust2, from a baked-lighting export of the real map.

   The file keeps Source's own coordinates (x east, y north, z up, 1 unit = 1
   inch), which is the best thing about it: every position in mapData.js is a
   real Hammer coordinate. Geometry is baked once into metres, Y-up:
     world = (x * U, z * U, -y * U)
   The same triangles feed the renderer and a BVH that every collision query,
   bullet, line of sight and nav bake runs against. */

export const MAP_FILE = '/models/de_dust2.glb'
const U = 0.0254

/** Source coordinates -> world metres. */
export const src = (x, y, z = 0) => new THREE.Vector3(x * U, z * U, -y * U)
/* The export's own node transforms already turn Source's Z-up into Y-up, but
   scale 1 unit to 1.719 * 0.0254 * 0.3937 m, and the meshopt pass quantises
   positions behind further node scales. So: take each mesh's full world
   matrix (which undoes the quantisation too), then rescale to 1 unit = 1 inch. */
const EXPORT_SCALE = 1.719419240951538 * 0.0254 * 0.3937007874015748
const TO_INCHES = new THREE.Matrix4().makeScale(U / EXPORT_SCALE, U / EXPORT_SCALE, U / EXPORT_SCALE)

export const level = {
  id: null,             // 'dust2' | 'aim'
  ready: false,
  version: 0,           // bumps on every map change
  meshes: [],           // { geometry, material } in world space, for rendering
  bvh: null,            // collision
  geometry: null,       // merged collision geometry
  bounds: new THREE.Box3(),
  listeners: new Set(),
}

/** Called once, when the current (or next) level is ready. */
export function onLevelReady(fn) {
  if (level.ready) fn(level)
  else level.listeners.add(fn)
}
/** Called on every level change from now on. Returns an unsubscribe. */
const changeListeners = new Set()
export function onLevelChange(fn) {
  changeListeners.add(fn)
  if (level.ready) fn(level)
  return () => changeListeners.delete(fn)
}

export function install(id, meshes, collision) {
  level.id = id
  level.meshes = meshes
  level.geometry = collision
  level.bvh = new MeshBVH(collision)
  collision.computeBoundingBox()
  level.bounds.copy(collision.boundingBox)
  level.ready = true
  level.version++
  for (const fn of level.listeners) fn(level)
  level.listeners.clear()
  for (const fn of changeListeners) fn(level)
}

const cache = {}

function loadDust2() {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  return loader.loadAsync(MAP_FILE).then(gltf => {
    const meshes = []
    const parts = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse(o => {
      if (!o.isMesh) return
      // quantised (normalised int) attributes would clip when transformed:
      // expand them to plain floats first
      const g = new THREE.BufferGeometry()
      for (const name of ['position', 'uv']) {
        const a = o.geometry.attributes[name]
        if (!a) continue
        const out = new Float32Array(a.count * a.itemSize)
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c)
        g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize))
      }
      if (o.geometry.index) g.setIndex(Array.from(o.geometry.index.array))
      g.applyMatrix4(o.matrixWorld)
      g.applyMatrix4(TO_INCHES)
      g.computeVertexNormals()
      const src = o.material
      const mat = new THREE.MeshBasicMaterial({
        map: src.map, side: THREE.DoubleSide, toneMapped: false,
      })
      if (mat.map) mat.map.anisotropy = 8
      meshes.push({ geometry: g, material: mat })
      const c = new THREE.BufferGeometry()
      c.setAttribute('position', g.attributes.position.clone())
      c.setIndex(g.index ? g.index.clone() : null)
      parts.push(c)
    })
    return { meshes, collision: mergeGeometries(parts, false) }
  })
}

/* Warehouse (Arena, from Standoff 2): an ordinary textured model (no baked light), so
   it is drawn lit like the Aim Garena boxes. The export's units are scaled
   to metres by ARENA_SCALE, and its see-through decal layers (grime) are
   drawn but kept out of the collision; the anniversary posters are dropped. */
export const ARENA_FILE = '/models/arena_standoff.glb'
export const ARENA_SCALE = 82

function loadArena() {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  return loader.loadAsync(ARENA_FILE).then(gltf => {
    const meshes = []
    const parts = []
    const scale = new THREE.Matrix4().makeScale(ARENA_SCALE, ARENA_SCALE, ARENA_SCALE)
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse(o => {
      if (!o.isMesh) return
      const g = new THREE.BufferGeometry()
      for (const name of ['position', 'uv']) {
        const a = o.geometry.attributes[name]
        if (!a) continue
        const out = new Float32Array(a.count * a.itemSize)
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c)
        g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize))
      }
      if (o.geometry.index) g.setIndex(Array.from(o.geometry.index.array))
      g.applyMatrix4(o.matrixWorld)
      g.applyMatrix4(scale)
      g.computeVertexNormals()
      const src = o.material
      // the game's anniversary posters and big painted "2"s: left out
      if (/2yearDecal/i.test(src.name || '')) return
      const decal = src.transparent || src.alphaTest > 0
      const mat = new THREE.MeshStandardMaterial({
        map: src.map, roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
        transparent: decal, depthWrite: !decal, polygonOffset: decal, polygonOffsetFactor: -2,
      })
      if (mat.map) mat.map.anisotropy = 8
      meshes.push({ geometry: g, material: mat, lit: true })
      if (decal) return
      const c = new THREE.BufferGeometry()
      c.setAttribute('position', g.attributes.position.clone())
      c.setIndex(g.index ? g.index.clone() : null)
      parts.push(c)
    })
    return { meshes, collision: mergeGeometries(parts, false) }
  })
}

/** Switch to a map ('dust2', 'aim' or 'arena'), loading it the first time. */
export function loadLevel(id = 'dust2') {
  if (level.id === id && level.ready) return Promise.resolve(level)
  level.ready = false
  if (!cache[id]) {
    cache[id] = id === 'aim'
      ? Promise.resolve().then(() => { const a = buildAimArena(); return { meshes: a.meshes, collision: a.collision } })
      : id === 'arena' ? loadArena() : loadDust2()
  }
  return cache[id].then(m => { install(id, m.meshes, m.collision); return level })
}

loadLevel('dust2')
