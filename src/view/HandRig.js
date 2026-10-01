import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { gloveMaterials } from '../skins/gloves'

/* A procedural first-person arm: sleeve, fingerless glove, and fingers with
   three real joints each, built for the viewmodel rather than borrowed from a
   character. Everything a gun animation needs is an explicit joint: curl a
   finger, pull the trigger, open the hand, bend the wrist.

   Hand space (right hand, "handshake" pose): the wrist is the origin, the
   fingers run down -Z, the thumb is up (+Y), the palm faces -X. Closing the
   fist curls the fingers toward -X, so a handle held in it runs along +Y —
   index finger on top. That +Y line is `haftAxis`, the forearm leaves along +Z
   (`armAxis`), the back of the hand looks out along +X (`palmAxis`). These
   match what the viewmodel's placeArm() expects. The left hand is the same
   build mirrored in X.

   With a glove item equipped (`glove`) the same rig wears it: full fingers,
   its back panel, pads and wrist strap. `bare` leaves the sleeve off, for
   showing a pair of gloves on their own. */

const SEG = {
  //        base y, base z, lengths (proximal, middle, distal), radius
  index: { y: 0.027, z: -0.088, len: [0.041, 0.025, 0.021], r: 0.0088 },
  middle: { y: 0.009, z: -0.091, len: [0.045, 0.028, 0.022], r: 0.0092 },
  ring: { y: -0.009, z: -0.089, len: [0.042, 0.026, 0.021], r: 0.0088 },
  pinky: { y: -0.026, z: -0.083, len: [0.033, 0.02, 0.018], r: 0.0078 },
}
const FINGERS = Object.keys(SEG)
const PALM = { w: 0.03, h: 0.078, l: 0.092 }       // thickness (x), width (y), length (z)
const FOREARM = 0.72     // long enough that its far end never reaches the frame
const MAX_WRIST = 1.05                                // radians the wrist will bend (viewmodels cheat a little)

let MATS = null
function mats(team) {
  if (!MATS) {
    const std = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
    MATS = {
      glove: std('#26282a', 0.78),
      pad: std('#2f312d', 0.75),
      skin: std('#b98a6c', 0.62),
      cuff: std('#171819', 0.8),
      sleeveT: std('#6f5b3c', 0.92),
      sleeveCT: std('#2f3d55', 0.9),
      watch: std('#0e0f10', 0.35, 0.6),
    }
  }
  return { ...MATS, tip: MATS.skin, sleeve: team === 'CT' ? MATS.sleeveCT : MATS.sleeveT }
}

function capsule(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2 * 0.6), 4, 10)
  g.rotateX(Math.PI / 2)                // along Z
  g.translate(0, 0, -len / 2)           // from the joint forward along -Z
  const m = new THREE.Mesh(g, mat)
  return m
}

/**
 * @param {object} o
 * @param {'left'|'right'} o.side
 * @param {'T'|'CT'} o.team
 * @param {number} o.haft  radius of the handle this hand closes on
 */
export function buildHand({ side = 'right', team = 'T', haft = 0.018, size = 0.88, maxWrist = MAX_WRIST, glove = null, bare = false } = {}) {
  const M = glove ? { ...mats(team), ...gloveMaterials(glove) } : mats(team)
  const group = new THREE.Group()                    // placed by the viewmodel
  const mirror = new THREE.Group()                   // left = right reflected in X
  // `size` scales the whole arm; the grip solve below runs in unscaled hand units
  mirror.scale.set(side === 'left' ? -size : size, size, size)
  haft /= size
  group.add(mirror)

  // --- palm ---
  const palmGeo = new RoundedBoxGeometry(PALM.w, PALM.h, PALM.l, 4, 0.013)
  {
    // taper toward the wrist and bow the back of the hand, so it reads as a hand, not a brick
    const pos = palmGeo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) / PALM.l + 0.5            // 0 at the knuckles .. 1 at the wrist
      pos.setY(i, pos.getY(i) * (1 - 0.3 * z * z))
      pos.setX(i, pos.getX(i) * (1 - 0.25 * z))
      const y = pos.getY(i) / (PALM.h / 2)
      if (pos.getX(i) > 0) pos.setX(i, pos.getX(i) + 0.004 * (1 - y * y))
    }
    palmGeo.computeVertexNormals()
  }
  const palm = new THREE.Mesh(palmGeo, M.panel ?? M.glove)
  palm.position.set(0, 0, -PALM.l / 2 + 0.004)
  mirror.add(palm)
  const pad = new THREE.Mesh(new RoundedBoxGeometry(0.006, PALM.h * 0.86, 0.026, 2, 0.003), M.pad)
  pad.position.set(PALM.w / 2, 0, -PALM.l + 0.018)   // knuckle guard on the back of the hand
  mirror.add(pad)
  // knuckle heads on the back of the hand
  for (const name of Object.keys(SEG)) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(SEG[name].r * 1.15, 10, 8), M.pad)
    k.position.set(0.004, SEG[name].y, SEG[name].z + 0.004)
    mirror.add(k)
  }

  // --- fingers: joint groups, each rotating about Y (the knuckle line) ---
  const fingers = {}
  for (const name of FINGERS) {
    const S = SEG[name]
    const joints = []
    let parent = mirror
    for (let i = 0; i < 3; i++) {
      const j = new THREE.Group()
      if (i === 0) j.position.set(-0.002, S.y, S.z)
      else j.position.set(0, 0, -S.len[i - 1])
      parent.add(j)
      const r = S.r * (1 - i * 0.08)
      j.add(capsule(r, S.len[i] + r * 0.4, i === 2 ? M.tip : M.glove))
      joints.push(j)
      parent = j
    }
    fingers[name] = joints
  }

  // --- thumb: its own chain off the heel of the palm ---
  const thumbBase = new THREE.Group()
  thumbBase.position.set(-0.012, 0.03, -0.02)
  mirror.add(thumbBase)
  const thumb = []
  {
    const lens = [0.036, 0.027, 0.022]
    let parent = thumbBase
    for (let i = 0; i < 3; i++) {
      const j = new THREE.Group()
      if (i > 0) j.position.set(0, 0, -lens[i - 1])
      parent.add(j)
      j.add(capsule(0.0105 - i * 0.001, lens[i] + 0.004, i === 2 ? M.tip : M.glove))
      thumb.push(j)
      parent = j
    }
  }

  // --- forearm: pivots at the wrist so the wrist can bend ---
  const forearm = new THREE.Group()
  mirror.add(forearm)
  {
    if (!bare) {
      const g = new THREE.CylinderGeometry(0.03, 0.041, FOREARM, 14, 1, true)
      g.rotateX(Math.PI / 2); g.translate(0, 0, FOREARM / 2 + 0.03)
      forearm.add(new THREE.Mesh(g, M.sleeve))
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 14).rotateX(Math.PI / 2), M.sleeve)
      cap.position.z = 0.03
      forearm.add(cap)
    }
    // a glove's wrist strap is longer and stands a little proud of the sleeve
    const cuff = glove ? new THREE.CylinderGeometry(0.029, 0.031, 0.05, 18) : new THREE.CylinderGeometry(0.0255, 0.028, 0.034, 14)
    cuff.rotateX(Math.PI / 2); cuff.translate(0, 0, glove ? 0.02 : 0.012)
    forearm.add(new THREE.Mesh(cuff, M.cuff))
    const wristG = new THREE.SphereGeometry(0.024, 12, 10)
    wristG.scale(0.7, 1, 1)
    forearm.add(new THREE.Mesh(wristG, M.glove))
  }

  group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false } })

  /* --- grip solve: where a haft of radius `haft` sits in the closed fist,
     and how far each finger closes to touch it. Measured once. --- */
  const sx = side === 'left' ? -1 : 1
  const channel = new THREE.Vector3(-(PALM.w / 2 + haft + 0.001), 0, -0.07)
  const tmp = new THREE.Vector3()
  const setCurl = (joints, t, weights = [1, 1.25, 0.9]) => joints.forEach((j, i) => { j.rotation.set(0, t * weights[i], 0) })
  const curl = {}
  mirror.updateMatrixWorld(true)
  const toMirror = new THREE.Matrix4()
  for (const name of FINGERS) {
    const joints = fingers[name]
    const r = SEG[name].r
    let best = 1.7
    for (let t = 0.4; t <= 1.7; t += 0.02) {
      setCurl(joints, t)
      mirror.updateMatrixWorld(true)
      toMirror.copy(mirror.matrixWorld).invert()
      // middle of the middle phalanx
      tmp.set(0, 0, -SEG[name].len[1] / 2).applyMatrix4(joints[1].matrixWorld).applyMatrix4(toMirror)
      const d = Math.hypot(tmp.x - channel.x, tmp.z - channel.z)
      if (d <= haft + r * 1.05) { best = t; break }
    }
    curl[name] = best
    setCurl(joints, 0)
  }

  const poses = {
    // closed on the handle; thumb wrapped over the index
    wrap: { fingers: curl, index: curl.index, thumb: [0.95, 0.08, 0.55, 0.45] },
    // gun grip: index off on the trigger, thumb along the side
    trigger: { fingers: curl, index: curl.index * 0.55, thumb: [0.7, 0.28, 0.3, 0.2] },
    // support hand under a handguard: fingers curl up the far side
    support: { fingers: Object.fromEntries(FINGERS.map(f => [f, curl[f] * 0.9])), index: curl.index * 0.85, thumb: [0.55, 0.15, 0.45, 0.35] },
    open: { fingers: { index: 0.18, middle: 0.22, ring: 0.28, pinky: 0.34 }, index: 0.16, thumb: [0.25, 0.35, 0.1, 0.05] },
  }

  /** Blend-free pose set. `amount` 0 = open hand, 1 = the named pose. */
  function setPose(name, amount = 1) {
    const P = poses[name] || poses.wrap
    const O = poses.open
    for (const f of FINGERS) {
      const target = f === 'index' ? P.index : P.fingers[f]
      const t = O.fingers[f] + (target - O.fingers[f]) * amount
      setCurl(fingers[f], t)
    }
    const [spread, lift, c1, c2] = P.thumb.map((v, i) => O.thumb[i] + (v - O.thumb[i]) * amount)
    // spread swings the thumb across the palm, lift tilts it up toward the index
    thumbBase.rotation.set(lift, spread, 0, 'YXZ')
    thumb[1].rotation.set(0, c1, 0)
    thumb[2].rotation.set(0, c2, 0)
  }
  setPose('wrap')

  /** Trigger squeeze on top of the current pose (0..1). */
  function squeeze(k) {
    const base = poses.trigger.index
    setCurl(fingers.index, base + k * 0.35)
  }

  /* Bend the wrist toward where the arm should run, in hand space (the
     viewmodel passes the shoulder direction), clamped to a believable range.
     This is what lets a hand sit square on a grip while the forearm still
     leaves toward the player's body. */
  const Z = new THREE.Vector3(0, 0, 1)
  const want = new THREE.Vector3()
  function orientForearm(dirHand) {
    want.copy(dirHand)
    if (side === 'left') want.x = -want.x          // into the mirrored frame
    want.normalize()
    const ang = Z.angleTo(want)
    if (ang > maxWrist) {
      const axis = new THREE.Vector3().crossVectors(Z, want)
      if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0)
      want.copy(Z).applyAxisAngle(axis.normalize(), maxWrist)
    }
    forearm.quaternion.setFromUnitVectors(Z, want)
  }

  return {
    group, side, fingers, thumb, forearm,
    setPose, squeeze, orientForearm,
    handPos: new THREE.Vector3(0, 0, 0),
    gripPos: new THREE.Vector3(channel.x * sx * size, 0, channel.z * size),
    haftAxis: new THREE.Vector3(0, 1, 0),
    gripAxis: new THREE.Vector3(0, 1, 0),
    armAxis: new THREE.Vector3(0, 0, 1),
    palmAxis: new THREE.Vector3(sx, 0, 0),
  }
}
