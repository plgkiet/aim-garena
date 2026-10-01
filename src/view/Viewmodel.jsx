import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { KNIVES, KNIFE_ORDER } from '../lib/knives'
import { normalizeKnife, rigButterfly, dressMaterials, applyPhoto } from '../lib/knifeSetup'
import { MOVES, CUES } from '../lib/moves'
import { sample, EMPTY } from '../lib/anim'
import { knife, notify } from '../lib/knifeController'
import { makeEnvMap } from '../lib/textures'
import { swoosh, clack } from '../lib/audio'
import { VM, viewmodelVFov, applyViewmodel } from '../lib/viewmodel'
import { Trail } from './Trail'
import { buildGun } from './guns'
import { buildKnifeModel, paintModelBlade, silverParts } from '../skins/knives'
import { inventory } from '../skins/inventory'
import { buildHand } from './HandRig'
import { game, on, activeWeapon } from '../game/state'
import { W } from '../game/weapons'
import { RECOIL } from '../game/constants'

const SFX = { swoosh, clack }
const WING_ANGLE = 2.35   // how far the balisong handles fan out at open = 1

/* The wrist follows small motions one for one but saturates on the flourishes:
   a helicopter turns the blade between the fingers, it does not wind the arm
   through three revolutions. tanh gives that with no clamping kink. */
const WRIST = 0.55
const wrist = a => WRIST * Math.tanh(a / WRIST)

const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const ONE = new THREE.Vector3(1, 1, 1)

/* Where each forearm runs once it leaves the wrist, in view space. +Z is back
   toward the eye, so these point down and *behind* the hands: both arms come up
   out of the player's own chest and reach forward into the frame. See the
   knife notes in knives.js — SHOULDER.right is solved together with HAFT_LAY in
   Arms.jsx and against the blade angle in POSE. */
const SHOULDER = {
  right: new THREE.Vector3(0.22, -0.93, 0.28).normalize(),  // forearm runs straight down off the bottom edge
  left: new THREE.Vector3(-0.15, -0.92, 0.36).normalize(),
}

/* The same idea for a gun: the firing arm leaves the pistol grip back and down
   toward the right shoulder, the support arm leaves the handguard down and back
   toward the chest. */
const GUN_SHOULDER = {
  right: new THREE.Vector3(0.55, -0.45, 0.7).normalize(),
  left: new THREE.Vector3(-0.5, -0.7, 0.5).normalize(),
  pistolLeft: new THREE.Vector3(-0.35, -0.6, 0.72).normalize(),
}

/* Where the back of the open off hand faces, in view space: mostly at the lens
   and tipped up, so you see gloved knuckles rather than a row of fingertips. */
// the open off hand: back of the glove turned out to the left, palm toward the knife
const PALM_OUT = new THREE.Vector3(-0.5, 0.2, 0.84).normalize()
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const _d = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _q0 = new THREE.Quaternion()
const _q1 = new THREE.Quaternion()
const _toGrip = new THREE.Quaternion()
const _toArm = new THREE.Quaternion()
const _b2 = new THREE.Vector3()

/**
 * Place an arm from its bind-pose axes.
 *   grip   the haft line inside the fist goes on the parent's +Y, and the roll
 *          left over about it swings the forearm toward `aim`.
 *   reach  the forearm goes on `aim` outright, and the spin left over about it
 *          turns the back of the hand toward `PALM_OUT`.
 */
function placeArm(arm, p, r, aim, frame, mode = 'grip', back = null) {
  if (!arm?.group) return
  _d.copy(aim).applyQuaternion(frame).normalize()

  let primary, secondary, spinAxis, spinTarget
  if (mode === 'grip') {
    primary = arm.haftAxis; secondary = arm.armAxis
    spinAxis = Y_AXIS; spinTarget = _d
    // optionally choose the roll by where the back of the hand should face;
    // the forearm then gets to the shoulder by bending at the wrist
    if (back) spinTarget = _b2.copy(back).applyQuaternion(frame).cross(Y_AXIS).normalize()
  } else {
    primary = arm.armAxis; secondary = arm.palmAxis
    spinAxis = _d
    spinTarget = _c.copy(PALM_OUT).applyQuaternion(frame).normalize()
  }
  _q0.setFromUnitVectors(primary, mode === 'grip' ? Y_AXIS : _d)

  _a.copy(secondary).applyQuaternion(_q0)
  _a.addScaledVector(spinAxis, -_a.dot(spinAxis))
  _b.copy(spinTarget).addScaledVector(spinAxis, -spinTarget.dot(spinAxis))
  if (_a.lengthSq() > 1e-5 && _b.lengthSq() > 1e-5) {
    _a.normalize(); _b.normalize()
    const angle = Math.atan2(_a.clone().cross(_b).dot(spinAxis), _a.dot(_b))
    _q1.setFromAxisAngle(spinAxis, angle)
  } else _q1.identity()

  _e.set(r[0], r[1], r[2], 'ZYX')
  _q.setFromEuler(_e).multiply(_q1).multiply(_q0)

  const anchor = mode === 'grip' ? arm.gripPos : arm.handPos
  _v.copy(anchor).applyQuaternion(_q).negate().add(_v2.set(p[0], p[1], p[2]))
  arm.group.matrix.compose(_v, _q, ONE)
  arm.group.matrixWorldNeedsUpdate = true
  // procedural hands bend at the wrist toward the shoulder
  if (arm.orientForearm) arm.orientForearm(_c.copy(_d).applyQuaternion(_q1.copy(_q).invert()))
}

/** A case knife built in code: already in the knife frame, no file to load. */
/* Built only once it is first held: there are dozens of case knives, and
   making every one (and painting its finish) up front stalls the match load. */
function ProcKnife(props) {
  const id = props.cfg.id
  const [wanted, setWanted] = useState(knife.knifeKey === id)
  useEffect(() => knife.subscribe(() => { if (knife.knifeKey === id) setWanted(true) }), [id])
  return wanted ? <ProcKnifeModel {...props} /> : null
}

function ProcKnifeModel({ cfg, envMap, api }) {
  // the finish can be swapped for another pattern of it before a match
  const [finish, setFinish] = useState(cfg.finish)
  useEffect(() => knife.subscribe(() => setFinish(cfg.finish)), [cfg])
  const built = useMemo(() => {
    const model = buildKnifeModel(cfg.build, finish)
    model.traverse(o => { if (o.isMesh && o.material?.isMeshStandardMaterial) { o.material.envMap = envMap; o.material.envMapIntensity = 1.6 } })
    const box = new THREE.Box3().setFromObject(model)
    const tip = new THREE.Object3D(); tip.position.set(0, box.max.y * 0.97, 0)
    const base = new THREE.Object3D(); base.position.set(0, box.max.y * 0.34, 0)
    return { model, wings: [], tip, base, box }
  }, [cfg, finish, envMap])
  useLayoutEffect(() => { api.current[cfg.id] = built }, [api, cfg.id, built])
  const groupRef = useRef()
  useFrame(() => { if (groupRef.current) groupRef.current.visible = knife.knifeKey === cfg.id })
  return (
    <group ref={groupRef}>
      <primitive object={built.model} />
      <primitive object={built.tip} />
      <primitive object={built.base} />
    </group>
  )
}

/** One knife: normalised, re-rigged, with tip/base anchors for the trail. */
function Knife({ cfg, envMap, api }) {
  const gltf = useGLTF(cfg.file)
  // a finish from the inventory (Butterfly | Emerald, ...) repaints the blade
  const [finish, setFinish] = useState(cfg.finish)
  useEffect(() => knife.subscribe(() => setFinish(cfg.finish)), [cfg])
  const built = useMemo(() => {
    const model = cloneSkeleton(gltf.scene)
    if (cfg.photo) applyPhoto(model, cfg.photo)
    normalizeKnife(model, cfg)
    // a finish paints the blade and its accents; without one the file's own look stays, bolts in steel
    if (finish) paintModelBlade(model, finish, cfg.blade, cfg.roll, cfg.accent)
    else silverParts(model, cfg.silver)
    const wings = rigButterfly(model, cfg.wings)
    dressMaterials(model, envMap, cfg.tint)
    const box = new THREE.Box3().setFromObject(model)
    const tip = new THREE.Object3D(); tip.position.set(0, box.max.y * 0.97, 0)
    const base = new THREE.Object3D(); base.position.set(0, box.max.y * 0.34, 0)
    return { model, wings, tip, base, box }
  }, [gltf, cfg, finish, envMap])

  useLayoutEffect(() => {
    api.current[cfg.id] = built
  }, [api, cfg.id, built])

  const groupRef = useRef()
  useFrame(() => { if (groupRef.current) groupRef.current.visible = knife.knifeKey === cfg.id })

  return (
    <group ref={groupRef}>
      <primitive object={built.model} />
      <primitive object={built.tip} />
      <primitive object={built.base} />
    </group>
  )
}

/* ------------------------------------------------------------ gun rig ---- */

const GUN_SCALE = 0.8

/* The hold: where the pistol grip sits in the frame and how the gun is turned.
   Offsets from the Source viewmodel origin (which already carries
   viewmodel_offset_x/y/z), in metres and radians. */
const HOLD = {
  rifle: { p: [0.075, -0.11, -0.3], r: [0.015, 0.06, 0.0] },
  sniper: { p: [0.075, -0.11, -0.3], r: [0.015, 0.05, 0.0] },
  smg: { p: [0.075, -0.1, -0.28], r: [0.015, 0.06, 0.0] },
  pistol: { p: [0.07, -0.095, -0.3], r: [0.02, 0.07, 0.0] },
  grenade: { p: [0.085, -0.09, -0.24], r: [0.3, 0.2, -0.2] },
  c4: { p: [0.04, -0.12, -0.26], r: [0.6, 0.15, 0] },
}
const holdOf = w => HOLD[w.type] || (w.type === 'grenade' ? HOLD.grenade : HOLD.rifle)

/* Reload and inspect curves, in normalised time. Channels are offsets on the
   hold (p*, r*), how far the magazine has dropped (mag) and whether the
   support hand is on the magazine rather than the handguard (lh). */
const RELOAD = [
  [0, {}],
  [0.12, { rz: 0.32, rx: 0.1, px: -0.012, py: 0.01 }],
  [0.22, { rz: 0.34, rx: 0.1, px: -0.012, py: 0.01, lh: 1 }],
  [0.32, { rz: 0.36, rx: 0.12, px: -0.012, py: 0.012, lh: 1, mag: 0.1 }],
  [0.45, { rz: 0.34, rx: 0.1, px: -0.012, py: 0.01, lh: 1, mag: 0.55 }],
  [0.58, { rz: 0.34, rx: 0.1, px: -0.012, py: 0.01, lh: 1, mag: 0.55 }],
  [0.7, { rz: 0.35, rx: 0.12, px: -0.012, py: 0.012, lh: 1, mag: 0.06 }],
  [0.76, { rz: 0.4, rx: 0.16, px: -0.012, py: 0.02, lh: 1, mag: 0 }],
  [0.88, { rz: 0.18, rx: 0.05, px: -0.006, py: 0.005, lh: 0 }],
  [1, {}],
]
const INSPECT = [
  [0, {}],
  [0.14, { ry: 0.55, rz: 0.55, rx: 0.12, px: -0.035, py: 0.03, pz: 0.01 }],
  [0.45, { ry: 0.6, rz: 0.5, rx: 0.14, px: -0.035, py: 0.03, pz: 0.01 }],
  [0.6, { ry: -0.25, rz: -0.35, rx: 0.22, px: 0.005, py: 0.02 }],
  [0.85, { ry: -0.28, rz: -0.32, rx: 0.2, px: 0.005, py: 0.02 }],
  [1, {}],
]
const CHANNELS = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'mag', 'lh']
const smooth = t => t * t * (3 - 2 * t)
function sampleKeys(keys, u, out) {
  for (const c of CHANNELS) out[c] = 0
  if (u <= 0 || u >= 1) return out
  let i = 0
  while (i < keys.length - 2 && keys[i + 1][0] <= u) i++
  const [ua, a] = keys[i], [ub, b] = keys[i + 1]
  const t = smooth((u - ua) / Math.max(1e-6, ub - ua))
  for (const c of CHANNELS) out[c] = (a[c] ?? 0) + ((b[c] ?? 0) - (a[c] ?? 0)) * t
  return out
}

function starTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,250,230,1)')
  grad.addColorStop(0.2, 'rgba(255,210,120,0.9)')
  grad.addColorStop(0.5, 'rgba(255,140,40,0.35)')
  grad.addColorStop(1, 'rgba(255,90,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  g.globalCompositeOperation = 'lighter'
  g.strokeStyle = 'rgba(255,220,150,0.8)'
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.random() * 0.3
    g.lineWidth = 3 + Math.random() * 4
    g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* The ADS hold for a gun: rotate so the rear->front sight line points down the
   view (-Z), then slide so the rear sight sits ADS_EYE in front of the lens. */
const ADS_EYE = { rifle: 0.16, smg: 0.17, pistol: 0.26 }
const adsCache = new Map()
const _r = new THREE.Vector3()
function adsPose(gun, w) {
  if (!gun?.sight) return { p: [0, -0.04, -0.2], r: [0, 0, 0] }
  const hit = adsCache.get(gun)
  if (hit) return hit
  const rear = gun.sight.rear.clone().multiplyScalar(GUN_SCALE)
  const front = gun.sight.front.clone().multiplyScalar(GUN_SCALE)
  const v = front.sub(rear)
  const pitch = Math.atan(v.y / v.z)
  _r.copy(rear).applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
  const d = ADS_EYE[w.type] ?? 0.18
  const out = { p: [-_r.x, -_r.y, -d - _r.z], r: [pitch, 0, 0] }
  adsCache.set(gun, out)
  return out
}

/* ------------------------------------------------------------ component -- */

export function Viewmodel() {
  const { gl, scene, camera, size } = useThree()
  const viewScene = useMemo(() => new THREE.Scene(), [])
  const viewCam = useMemo(() => new THREE.PerspectiveCamera(viewmodelVFov(), 1, 0.12, 6), [])
  const envMap = useMemo(() => makeEnvMap(gl), [gl])

  const armRef = useRef()     // Source viewmodel transform: bob, lag, lower, punch
  const knifeRoot = useRef()
  const moveRef = useRef()
  const poseRef = useRef()
  const spinRef = useRef()
  const handRef = useRef()
  const offRef = useRef()
  const knifeHandMount = useRef()    // the gripping hand rides the pose
  const knifeHandsTeam = useRef(null)
  // knife hands: the same procedural rig as the guns, closed on the haft / open
  function ensureKnifeHands(team) {
    if (knifeHandsTeam.current === team || !knifeHandMount.current || !knifeRoot.current) return
    handRef.current?.group.parent?.remove(handRef.current.group)
    offRef.current?.group.parent?.remove(offRef.current.group)
    // a straight wrist: the forearm carries on from the fist, no bend
    const right = buildHand({ side: 'right', team, haft: 0.0125, size: 0.72, maxWrist: 0.12 })
    right.setPose('wrap')
    const left = buildHand({ side: 'left', team, haft: 0.02, size: 0.72 })
    left.setPose('open')
    right.group.matrixAutoUpdate = false
    left.group.matrixAutoUpdate = false
    knifeHandMount.current.add(right.group)
    knifeRoot.current.add(left.group)
    handRef.current = right
    offRef.current = left
    knifeHandsTeam.current = team
  }
  const offTuck = useRef(0)
  const knives = useRef({})
  const trailStrength = useRef(0)
  const activeTipRef = useRef(null)
  const activeBaseRef = useRef(null)
  const cueIndex = useRef(0)
  const lastSeq = useRef(-1)
  const ch = useRef({ ...EMPTY })

  const gunRoot = useRef()
  const gunKick = useRef()
  const gunHold = useRef()
  const shellsRef = useRef()

  // gun arms: procedural hands, rebuilt only when the sleeves change side
  const gunArms = useMemo(() => ({ team: null, right: null, left: null }), [])
  function ensureGunArms(team) {
    if (gunArms.team === team) return
    for (const k of ['right', 'left']) gunArms[k]?.group.parent?.remove(gunArms[k].group)
    gunArms.right = buildHand({ side: 'right', team, haft: 0.017 })
    gunArms.left = buildHand({ side: 'left', team, haft: 0.02 })
    gunArms.right.setPose('trigger')
    gunArms.left.setPose('support')
    gunArms.right.group.matrixAutoUpdate = false
    gunArms.left.group.matrixAutoUpdate = false
    gunArms.team = team
    rig.current.key = '__remount'
  }
  const flashTex = useMemo(() => starTexture(), [])
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({
    map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }), [flashTex])

  // gun instances built lazily, cached by id
  const gunCache = useRef(new Map())
  const rig = useRef({
    id: null, gun: null, model: null, gripR: null, gripL: null, flash: null,
    seq: { fire: 0, reload: 0, deploy: 0, inspect: 0, throw: 0 },
    drawT: 10, reloadT: -1, reloadDur: 1, inspectT: -1,
    kick: { pz: 0, rx: 0, ry: 0, rz: 0, vpz: 0, vrx: 0, vry: 0, vrz: 0 },
    flashT: 0, slideT: 0, ads: 0,
    anim: {},
    shells: [],
  })

  useEffect(() => {
    scene.environment = envMap
    viewScene.environment = envMap
    return () => { scene.environment = null }
  }, [envMap, scene, viewScene])

  useEffect(() => {
    viewCam.aspect = size.width / size.height
    viewCam.fov = viewmodelVFov()
    viewCam.updateProjectionMatrix()
  }, [size, viewCam])

  // knife tricks on R
  useEffect(() => on('knifeTrick', ({ move }) => knife.play(move || 'inspect')), [])

  if (import.meta.env.DEV) {
    window.__vm = { viewScene, viewCam, knives: knives.current, knife, arm: armRef, rig, gunArms, HOLD, GUN_SHOULDER, SHOULDER, PALM_OUT, THREE, hands: { right: handRef, left: offRef } }
    window.VM = VM
  }

  function mountGun(id) {
    const R = rig.current
    const hold = gunHold.current
    // the equipped skin from the inventory is part of what is mounted
    const skin = id && id !== 'knife' ? inventory.equippedItem(id) : null
    const key = `${id}|${skin?.id || ''}`
    if (R.key === key) return
    if (R.model) hold.remove(R.model)
    if (R.anchors) hold.remove(R.anchors)
    R.id = id
    R.key = key
    if (!id || id === 'knife') { R.gun = null; R.model = null; R.anchors = null; return }
    let entry = gunCache.current.get(key)
    if (!entry) {
      const gun = buildGun(id, { skin })
      const model = new THREE.Group()
      model.scale.setScalar(GUN_SCALE)
      model.add(gun.group)
      const anchors = new THREE.Group()
      const frame = spec => {
        const f = new THREE.Group()
        f.position.copy(spec.pos).multiplyScalar(GUN_SCALE)
        f.quaternion.setFromUnitVectors(Y_AXIS, spec.dir.clone().normalize())
        anchors.add(f)
        return f
      }
      const gripR = frame(gun.gripR)
      const gripL = gun.gripL ? frame(gun.gripL) : null
      const flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flashMat)
      flash.position.copy(gun.muzzle).multiplyScalar(GUN_SCALE)
      flash.visible = false
      flash.renderOrder = 5
      anchors.add(flash)
      const eject = new THREE.Object3D()
      eject.position.copy(gun.eject).multiplyScalar(GUN_SCALE)
      anchors.add(eject)
      entry = { gun, model, anchors, gripR, gripL, flash, eject, gripLRest: gripL?.position.clone(), gripLQuat: gripL?.quaternion.clone() }
      gunCache.current.set(key, entry)
    }
    Object.assign(R, entry)
    hold.add(entry.model)
    hold.add(entry.anchors)
    entry.gripR.add(gunArms.right.group)
    if (entry.gripL) entry.gripL.add(gunArms.left.group)
    gunArms.left.group.visible = !!entry.gripL
    gunArms.right.group.matrixAutoUpdate = false
    gunArms.left.group.matrixAutoUpdate = false
  }

  function updateKnife(dt) {
    const arm = armRef.current, mv = moveRef.current, pose = poseRef.current, spin = spinRef.current
    if (!arm || !mv || !pose || !spin) return
    const cfg = KNIVES[knife.knifeKey]
    const cur = knives.current[knife.knifeKey]
    if (cur) { activeTipRef.current = cur.tip; activeBaseRef.current = cur.base }

    const c = ch.current
    if (knife.move) {
      if (lastSeq.current !== knife.seq) { cueIndex.current = 0; lastSeq.current = knife.seq }
      const move = MOVES[knife.move]
      const prevT = knife.t
      knife.t += dt
      const cues = CUES[knife.move] || []
      while (cueIndex.current < cues.length && cues[cueIndex.current].t <= knife.t) {
        const q = cues[cueIndex.current++]
        if (q.t > prevT - 0.001) SFX[q.s]?.(q.v ?? 1)
      }
      sample(move, knife.t, c)
      if (knife.t >= move.duration) {
        knife.move = null; knife.t = 0; notify()
        // a trick can end several turns round; take the equivalent angle so the
        // settle back to the stance does not visibly unwind every turn
        for (const ch of ['rx', 'ry', 'rz']) c[ch] = Math.atan2(Math.sin(c[ch]), Math.cos(c[ch]))
      }
    } else {
      for (const k in c) c[k] += (0 - c[k]) * Math.min(1, dt * 14)
    }

    const t = performance.now() / 1000
    const breath = Math.sin(t * 1.4) * 0.0035 + Math.sin(t * 0.53) * 0.0022
    mv.position.set(c.px, c.py + breath, c.pz)
    mv.rotation.set(breath * 1.6, 0, 0)

    const S = cfg.pose
    pose.position.set(S.p[0], S.p[1], S.p[2])
    pose.rotation.set(S.r[0], S.r[1], S.r[2])
    spin.rotation.set(c.rx, c.ry, c.rz, 'ZYX')

    pose.updateWorldMatrix(true, false)
    _toGrip.setFromRotationMatrix(pose.matrixWorld).invert()
    _toArm.setFromRotationMatrix(arm.matrixWorld).invert()

    const G = cfg.hand
    // the fingers ride the trick: they loosen while the blade spins or leaves
    // the hand and close again on the catch
    if (handRef.current?.setPose) {
      const airborne = THREE.MathUtils.clamp((c.py - 0.05) / 0.1, 0, 1)
      const loosen = Math.max(airborne, (c.blur ?? 0) * 0.45)
      const g = 1 - loosen * 0.7
      if (Math.abs(g - (handRef.current.gripNow ?? 1)) > 0.01) { handRef.current.setPose('wrap', g); handRef.current.gripNow = g }
    }
    placeArm(handRef.current, G.p, [
      G.r[0] + wrist(c.rx), G.r[1] + wrist(c.ry), G.r[2] + wrist(c.rz)],
      SHOULDER.right, _toGrip)

    const playing = knife.move ? MOVES[knife.move] : null
    const tuckTarget = Math.max(playing && !playing.keepOff ? 1 : 0, c.off ?? 0)
    offTuck.current += (tuckTarget - offTuck.current) * Math.min(1, dt * 12)
    const off = offRef.current
    if (off?.group) {
      const k = offTuck.current
      off.group.visible = k < 0.98
      if (off.group.visible) {
        const O = cfg.offhand
        placeArm(off, [O.p[0] - k * 0.05, O.p[1] - k * 0.26, O.p[2] + k * 0.07], O.r,
          SHOULDER.left, _toArm, 'reach')
      }
    }
    if (cur?.wings?.length) {
      // the hand keeps hold of one handle (as in CS2): only the other swings out
      const held = cfg.wings?.held ?? 0
      cur.wings.forEach((w, i) => { w.group.rotation.z = w.rest + (i === held ? 0 : c.open * WING_ANGLE * w.sign) })
    }
    trailStrength.current = THREE.MathUtils.clamp(
      (c.blur ?? 0) * 0.9 + Math.min(1, Math.abs(c.rz) + Math.abs(c.rx) + Math.abs(c.ry)) * 0.03, 0, 1)
  }

  function updateGun(dt, me, inst) {
    const R = rig.current
    const w = W[inst.id]
    const ws = me.w
    const now = game.time

    // --- events, detected from the agent's counters ---
    if (ws.deploySeq !== R.seq.deploy) { R.seq.deploy = ws.deploySeq; R.drawT = 0; R.reloadT = -1; R.inspectT = -1 }
    if (ws.fireSeq !== R.seq.fire) {
      const n = ws.fireSeq - R.seq.fire
      R.seq.fire = ws.fireSeq
      if (n > 0 && n < 5) {
        const heavy = (w.type === 'sniper' ? 2.4 : w.id === 'deagle' ? 2 : w.type === 'pistol' ? 1.2 : 1) * RECOIL.view_kick_scale
        R.kick.vpz += 0.9 * heavy
        R.kick.vrx += (2.2 + Math.random()) * heavy
        R.kick.vry += (Math.random() - 0.5) * 1.2 * heavy
        R.kick.vrz += (Math.random() - 0.5) * 1.6 * heavy
        R.flashT = w.silenced ? 0 : 0.05
        R.slideT = 0.07
        R.inspectT = -1
        spawnShell(R)
      }
    }
    if (ws.reloadSeq !== R.seq.reload) { R.seq.reload = ws.reloadSeq; R.reloadT = 0; R.reloadDur = w.reload; R.inspectT = -1 }
    if (ws.inspectSeq !== R.seq.inspect) { R.seq.inspect = ws.inspectSeq; if (R.reloadT < 0) R.inspectT = 0 }
    if (!ws.reloadEnd && R.reloadT >= 0 && R.reloadT < R.reloadDur - 0.05) R.reloadT = -1   // cancelled

    // --- springs for the fire kick ---
    const K = R.kick
    const spring = (x, v) => [v * dt, (-x * 260 - v * 24) * dt]
    for (const c of ['pz', 'rx', 'ry', 'rz']) {
      const vk = 'v' + c
      const [dx, dv] = spring(K[c], K[vk])
      K[c] += dx; K[vk] += dv
    }

    // --- curves ---
    const A = R.anim
    if (R.reloadT >= 0) {
      R.reloadT += dt
      sampleKeys(RELOAD, R.reloadT / R.reloadDur, A)
      if (R.reloadT >= R.reloadDur) R.reloadT = -1
    } else if (R.inspectT >= 0) {
      R.inspectT += dt
      sampleKeys(INSPECT, R.inspectT / 3.2, A)
      if (R.inspectT >= 3.2) R.inspectT = -1
    } else sampleKeys(RELOAD, 0, A)

    // draw: up from below the frame
    R.drawT += dt
    const drawDur = Math.min(0.9, (w.deploy ?? 1) * 0.7)
    const u = Math.min(1, R.drawT / drawDur)
    const e = 1 - Math.pow(1 - u, 3)
    const drawPy = -0.14 * (1 - e), drawRx = -0.8 * (1 - e), drawRz = 0.3 * (1 - e)

    // grenade wind-up / C4 plant
    let extraPy = 0, extraPz = 0, extraRx = 0
    if (w.type === 'grenade' && ws.throwing) { extraPy = 0.03; extraPz = 0.06; extraRx = -0.35 }
    if (w.type === 'c4' && me.planting > 0) { extraPy = -0.05; extraPz = -0.03; extraRx = 0.5 }

    const H = holdOf(w)
    // aim down the sights: blend the hold toward the pose that puts the iron
    // sights on the centre of the screen
    R.ads += ((ws.ads && R.reloadT < 0 ? 1 : 0) - R.ads) * Math.min(1, dt * 12)
    const S = adsPose(R.gun, w)
    const k = R.ads
    const bx = H.p[0] + (S.p[0] - H.p[0]) * k, by = H.p[1] + (S.p[1] - H.p[1]) * k, bz = H.p[2] + (S.p[2] - H.p[2]) * k
    const rx = H.r[0] + (S.r[0] - H.r[0]) * k, ry = H.r[1] * (1 - k), rz = H.r[2] * (1 - k)
    const kick = 1 - k * 0.45                       // shouldered: the kick drives back, less up
    const hold = gunHold.current
    hold.position.set(
      bx + A.px, by + A.py + drawPy + extraPy, bz + A.pz + K.pz * 0.012 * (1 + k) + extraPz)
    hold.rotation.set(
      rx + A.rx + drawRx + K.rx * 0.02 * kick + extraRx, ry + A.ry + K.ry * 0.02 * kick, rz + A.rz + drawRz + K.rz * 0.02 * kick, 'YXZ')

    // magazine drops out along its own length
    const g = R.gun
    if (g?.mag) {
      g.mag.position.copy(g.magRest.pos)
      g.mag.position.y -= A.mag
      g.mag.position.z += A.mag * 0.12
    }
    if (g?.slide) g.slide.position.z = R.slideT > 0 ? 0.018 : 0
    R.slideT -= dt

    // --- arms ---
    hold.updateWorldMatrix(true, true)
    if (R.gripR) {
      _toGrip.setFromRotationMatrix(R.gripR.matrixWorld).invert()
      placeArm(gunArms.right, [0, 0, 0], [0, 0, 0], GUN_SHOULDER.right, _toGrip)
    }
    if (R.gripL) {
      // support hand: handguard, or down onto the magazine during a reload
      R.gripL.position.copy(R.gripLRest)
      if (g?.mag && A.lh > 0) {
        _v.copy(g.mag.position).multiplyScalar(GUN_SCALE)
        _v.y -= 0.05
        R.gripL.position.lerp(_v, A.lh)
      }
      R.gripL.updateWorldMatrix(false, true)
      _toGrip.setFromRotationMatrix(R.gripL.matrixWorld).invert()
      const aim = g?.gripLSupport ? GUN_SHOULDER.pistolLeft : GUN_SHOULDER.left
      placeArm(gunArms.left, [0, 0, 0], [0, 0, 0], aim, _toGrip)
      gunArms.left.group.visible = true
    }

    // --- muzzle flash ---
    if (R.flash) {
      R.flashT -= dt
      R.flash.visible = R.flashT > 0
      if (R.flash.visible) {
        const s = (w.type === 'sniper' ? 0.2 : w.type === 'pistol' ? 0.1 : 0.14) * (0.8 + Math.random() * 0.5)
        R.flash.scale.set(s, s, s)
        R.flash.rotation.set(0, 0, Math.random() * Math.PI * 2)
      }
    }
    // hide the grenade once it has left the hand
    if (w.type === 'grenade' && R.model) R.model.visible = now - ws.lastThrow > 0.4 || !ws.lastThrow
  }

  function spawnShell(R) {
    const w = W[rig.current.id]
    if (!R.eject || !w || w.type === 'sniper' || w.type === 'grenade' || w.type === 'c4') return
    const group = shellsRef.current
    if (!group) return
    let s = R.shells.find(x => x.life <= 0)
    if (!s) {
      if (R.shells.length >= 20) s = R.shells[0]
      else {
        const m = new THREE.Mesh(SHELL_GEO, SHELL_MAT)
        group.add(m)
        s = { m, life: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() }
        R.shells.push(s)
      }
    }
    R.eject.updateWorldMatrix(true, false)
    s.m.position.setFromMatrixPosition(R.eject.matrixWorld)
    s.v.set(0.9 + Math.random() * 0.5, 0.9 + Math.random() * 0.4, 0.15 + Math.random() * 0.2)
    s.spin.set(Math.random() * 20, Math.random() * 20, Math.random() * 20)
    s.life = 0.55
    s.m.visible = true
  }

  function updateShells(dt) {
    for (const s of rig.current.shells) {
      if (s.life <= 0) continue
      s.life -= dt
      s.v.y -= 6 * dt
      s.m.position.addScaledVector(s.v, dt)
      s.m.rotation.x += s.spin.x * dt; s.m.rotation.y += s.spin.y * dt; s.m.rotation.z += s.spin.z * dt
      if (s.life <= 0) s.m.visible = false
    }
  }

  const lastKnifeSeq = useRef({ knife: 0, deploy: 0, inspect: 0 })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const me = game.local
    const arm = armRef.current

    // ---- world pass ----
    gl.autoClear = true
    gl.render(scene, camera)

    if (!me || !me.alive || game.phase === 'menu' || !arm) return
    const inst = activeWeapon(me)
    if (!inst) return
    const w = W[inst.id]
    // scoped: the viewmodel is hidden behind the scope overlay
    if (me.w.zoom > 0 && w?.zoom) return

    if (inst.id === 'knife') rig.current.ads = 0
    applyViewmodel(arm, dt)
    // on the sights the bob and sway mostly go away, or they would walk the sights off the target
    // (the position also carries viewmodel_offset_*, which has to go entirely
    // or the sights would sit off the crosshair)
    const ads = rig.current.ads || 0
    // on the sights the back of the gun comes within the 12 cm the view camera
    // normally cuts away, and would show sliced open: pull the near plane in
    const near = 0.12 - ads * 0.11
    if (Math.abs(viewCam.near - near) > 1e-4) { viewCam.near = near; viewCam.updateProjectionMatrix() }
    if (ads > 0) {
      const steady = 1 - ads * 0.85
      arm.position.multiplyScalar(1 - ads)
      arm.rotation.set(arm.rotation.x * steady, arm.rotation.y * steady, arm.rotation.z * steady, 'YXZ')
    }

    const isKnife = inst.id === 'knife'
    knifeRoot.current.visible = isKnife
    gunRoot.current.visible = !isKnife
    const S = lastKnifeSeq.current
    if (isKnife) {
      if (me.w.deploySeq !== S.deploy) { S.deploy = me.w.deploySeq; knife.play('deploy', { force: true }) }
      if (me.w.knifeSeq !== S.knife) { S.knife = me.w.knifeSeq; knife.play(me.w.knifeHeavy ? 'slash' : 'stab') }
      if (me.w.inspectSeq !== S.inspect) { S.inspect = me.w.inspectSeq; knife.play('inspect') }
      mountGun(null)
      ensureKnifeHands(me.team)
      updateKnife(dt)
    } else {
      S.deploy = me.w.deploySeq; S.knife = me.w.knifeSeq; S.inspect = me.w.inspectSeq
      ensureGunArms(me.team)
      mountGun(inst.id)
      updateGun(dt, me, inst)
      trailStrength.current = 0
    }
    updateShells(dt)

    // ---- viewmodel pass on a cleared depth buffer ----
    gl.autoClear = false
    gl.clearDepth()
    gl.render(viewScene, viewCam)
    gl.autoClear = true
  }, 1)

  return createPortal(
    <>
      <ambientLight intensity={0.55} color="#ffe6c8" />
      <directionalLight position={[0.6, 1.2, 0.8]} intensity={2.6} color="#fff1d8" />
      <directionalLight position={[-1.1, -0.3, 0.5]} intensity={0.9} color="#8fb6ff" />
      <pointLight position={[0.2, -0.2, 0.6]} intensity={0.5} color="#ffd0a0" distance={3} />
      <group ref={armRef}>
        <group ref={knifeRoot}>
          <group ref={moveRef}>
            <group ref={poseRef}>
              <group ref={knifeHandMount} />
              <group ref={spinRef}>
                {KNIFE_ORDER.map(id => (KNIVES[id].build
                  ? <ProcKnife key={id} cfg={KNIVES[id]} envMap={envMap} api={knives} />
                  : <Knife key={id} cfg={KNIVES[id]} envMap={envMap} api={knives} />))}
              </group>
            </group>
          </group>
        </group>
        <group ref={gunRoot} visible={false}>
          <group ref={gunKick}>
            <group ref={gunHold} />
          </group>
        </group>
      </group>
      <group ref={shellsRef} />
      <Trail tipRef={activeTipRef} baseRef={activeBaseRef} strengthRef={trailStrength} />
    </>,
    viewScene
  )
}

const SHELL_GEO = new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8).rotateZ(Math.PI / 2)
const SHELL_MAT = new THREE.MeshStandardMaterial({ color: '#d4a948', metalness: 0.9, roughness: 0.3 })

KNIFE_ORDER.forEach(id => KNIVES[id].file && useGLTF.preload(KNIVES[id].file))
