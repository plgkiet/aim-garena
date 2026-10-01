import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { buildGun } from '../view/guns'
import { buildKnifeModel, paintModelBlade, silverParts } from './knives'
import { KNIVES } from '../lib/knives'
import { normalizeKnife, keepOnly, applyPhoto } from '../lib/knifeSetup'
import { skinReady } from './patterns'

/* Item pictures, rendered from the real models rather than drawn: one small
   offscreen renderer lays each weapon on its side, lit by a studio
   environment, and keeps the PNG. The case reel, the winner card and the
   inventory all show exactly what you will hold in game. */

const W = 360, H = 220
let renderer = null, scene = null, camera = null
const cache = new Map()
const pending = new Map()

function setup() {
  if (renderer) return
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(W, H, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a3f48', 1.2))
  const key = new THREE.DirectionalLight('#ffffff', 2.2)
  key.position.set(3, 4, 2)
  scene.add(key)
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50)
}

/** Frame the model: side-on, filling the picture with a margin. */
function shoot(model) {
  const holder = new THREE.Group()
  holder.add(model)
  scene.add(holder)
  holder.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(holder)
  const c = box.getCenter(new THREE.Vector3())
  holder.position.sub(c)
  holder.updateMatrixWorld(true)
  const size = box.getSize(new THREE.Vector3())
  // looking from +X at the gun's right side: the muzzle points right
  const half = Math.max(size.z / 2 / (W / H), size.y / 2) * 1.12
  camera.left = -half * (W / H); camera.right = half * (W / H); camera.top = half; camera.bottom = -half
  camera.position.set(5, 0.4, 0)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  renderer.setClearColor(0x000000, 0)
  renderer.render(scene, camera)
  scene.remove(holder)
  return renderer.domElement.toDataURL('image/png')
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
function modelKnife(key, finish = null) {
  const cfg = KNIVES[key]
  return loader.loadAsync(cfg.file).then(async gltf => {
    const m = cloneSkeleton(gltf.scene)
    if (cfg.pick) keepOnly(m, cfg.pick)
    if (cfg.photo) await applyPhoto(m, cfg.photo)
    normalizeKnife(m, cfg)
    // a finish paints the blade and its accents; without one the file's own look stays, bolts in steel
    if (finish) paintModelBlade(m, finish, cfg.blade, cfg.roll, cfg.accent)
    else silverParts(m, cfg.silver)
    return m
  })
}

/** The item's model, lying on its side for a camera at +X: guns muzzle to
    the right, knives laid across tip up and to the right. Shared by the
    thumbnails and the inspect screen. */
export async function buildItemModel(item) {
  if (item.image) await skinReady(item)   // don't show a photo finish before its picture has loaded
  if (item.kind === 'gun') return buildGun(item.weapon, { skin: item }).group
  const model = item.model ? await modelKnife(item.knife, item.finish ? item : null) : buildKnifeModel(item.knife, item)
  // knives stand blade-up with the flat on Z: turn the flat to the camera,
  // then lay the blade across the picture, tip up and to the right
  // (a model knife carries its alignment in its own matrix: turn a holder
  // around it instead, taking the in-hand roll back out)
  const cfg = item.model ? KNIVES[item.knife] : null
  // a figure (the Bearbrick) stands upright, face to the camera
  if (cfg?.upright) {
    const stand = new THREE.Group(); stand.add(model)
    stand.rotation.y = Math.PI / 2 - (cfg.roll || 0) + (cfg.face ?? 0)
    const wrap = new THREE.Group(); wrap.add(stand)
    return wrap
  }
  const turn = new THREE.Group()
  // a knife held reversed (Karambit: its ring is the stance's "tip") is turned
  // end over end, so the picture still shows the blade up
  if (item.model && KNIVES[item.knife]?.reverse) {
    const over = new THREE.Group(); over.rotation.z = Math.PI; over.add(model); turn.add(over)
  } else turn.add(model)
  turn.rotation.y = Math.PI / 2 - ((item.model && KNIVES[item.knife]?.roll) || 0)
  const wrap = new THREE.Group(); wrap.add(turn); wrap.rotation.x = -1.05
  return wrap
}

/* Pictures are made one at a time, each in an idle moment between frames,
   so opening a screen full of items never locks the page up. Callers give a
   priority: what is on screen now goes first, warming the case strip last. */
const queue = []
let busy = false
function pump() {
  if (busy || !queue.length) return
  busy = true
  queue.sort((a, b) => b.priority - a.priority)
  const job = queue.shift()
  ;(async () => {
    try {
      setup()
      const url = shoot(await buildItemModel(job.item))
      cache.set(job.item.id, url)
      job.resolve(url)
    } catch (e) {
      job.reject(e)
    } finally {
      pending.delete(job.item.id)
      busy = false
      schedule()
    }
  })()
}
function schedule() {
  if (!queue.length) return
  if (window.requestIdleCallback) window.requestIdleCallback(pump, { timeout: 120 })
  else setTimeout(pump, 16)
}

/** PNG data URL for an item (async; cached; queued by `priority`, higher first). */
export function thumbnail(item, { priority = 1 } = {}) {
  if (cache.has(item.id)) return Promise.resolve(cache.get(item.id))
  const waiting = pending.get(item.id)
  if (waiting) {
    waiting.job.priority = Math.max(waiting.job.priority, priority)
    return waiting.promise
  }
  const job = { item, priority }
  const promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject })
  pending.set(item.id, { job, promise })
  queue.push(job)
  schedule()
  return promise
}

export const cachedThumb = id => cache.get(id) || null
