import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildGun } from '../view/guns'
import { buildKnifeModel } from './knives'
import { KNIVES } from '../lib/knives'
import { normalizeKnife, keepOnly } from '../lib/knifeSetup'

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

const loader = new GLTFLoader()
function modelKnife(key) {
  const cfg = KNIVES[key]
  return loader.loadAsync(cfg.file).then(gltf => {
    const m = gltf.scene.clone(true)
    if (cfg.pick) keepOnly(m, cfg.pick)
    normalizeKnife(m, cfg)
    return m
  })
}

/** PNG data URL for an item (async; cached). */
export function thumbnail(item) {
  if (cache.has(item.id)) return Promise.resolve(cache.get(item.id))
  if (pending.has(item.id)) return pending.get(item.id)
  const job = (async () => {
    setup()
    let model
    if (item.kind === 'gun') {
      model = buildGun(item.weapon, { skin: item }).group
    } else {
      model = item.model ? await modelKnife(item.knife) : buildKnifeModel(item.knife, item)
      // knives stand blade-up with the flat on Z: turn the flat to the camera,
      // then lay the blade across the picture, tip up and to the right
      model.rotation.y = Math.PI / 2
      const wrap = new THREE.Group(); wrap.add(model); wrap.rotation.x = -1.05
      model = wrap
    }
    const url = shoot(model)
    cache.set(item.id, url)
    pending.delete(item.id)
    return url
  })()
  pending.set(item.id, job)
  return job
}

export const cachedThumb = id => cache.get(id) || null
