import * as THREE from 'three'
import { game, activeWeapon } from '../game/state'
import { buildGun } from './guns'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

/* Procedural animation for the third-person soldier: IK, stride, crouch,
   lean, aim pitch, death fall, and hitbox reporting. Kept out of the React
   component so it can be driven headless too. */

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3()
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion()

function wpos(o, out) { return out.setFromMatrixPosition(o.matrixWorld) }

/** Swing `bone` (about its own origin) so that `child` lands on the line to `target`. */
function aimBone(bone, child, target) {
  wpos(bone, _a); wpos(child, _b)
  const cur = _b.sub(_a).normalize()
  const want = _c.copy(target).sub(_a).normalize()
  if (cur.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return
  _q.setFromUnitVectors(cur, want)
  bone.getWorldQuaternion(_q2)
  _q.multiply(_q2)                                   // new world rotation
  bone.parent.getWorldQuaternion(_q3).invert()
  bone.quaternion.copy(_q3.multiply(_q))
  bone.updateWorldMatrix(false, true)
}

/** Analytic two-bone IK: root -> mid -> end reaches `target`, bending toward `pole`. */
function twoBone(root, mid, end, target, pole, lenA, lenB) {
  wpos(root, _a)
  const toT = new THREE.Vector3().copy(target).sub(_a)
  let d = toT.length()
  d = THREE.MathUtils.clamp(d, Math.abs(lenA - lenB) + 1e-3, lenA + lenB - 1e-3)
  const u = toT.normalize()
  const cosA = (lenA * lenA + d * d - lenB * lenB) / (2 * lenA * d)
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
  const p = new THREE.Vector3().copy(pole).addScaledVector(u, -pole.dot(u)).normalize()
  const elbow = new THREE.Vector3().copy(_a).addScaledVector(u, lenA * cosA).addScaledVector(p, lenA * sinA)
  const reach = new THREE.Vector3().copy(_a).addScaledVector(u, d)
  aimBone(root, mid, elbow)
  aimBone(mid, end, reach)
}

/* The two agent models (Phoenix for T, CS2's SAS for CT) share Valve's bone
   layout but not its naming — `arm_upper_R_024` against `arm_upper_r_045` —
   so bones are found by pattern, skipping the twist and end helpers. */
const BONE = {
  pelvis: /^pelvis_\d+$/i,
  spine: [/^spine_0_\d+$/i, /^spine_1_\d+$/i, /^spine_2_\d+$/i, /^spine_3_\d+$/i],
  neck: /^neck_0_\d+$/i, head: /^head_0_\d+$/i,
  legR: [/^leg_upper_r_\d+$/i, /^leg_lower_r_\d+$/i, /^ankle_r_\d+$/i, /^ball_r_\d+$/i],
  legL: [/^leg_upper_l_\d+$/i, /^leg_lower_l_\d+$/i, /^ankle_l_\d+$/i, /^ball_l_\d+$/i],
  armR: [/^arm_upper_r_\d+$/i, /^arm_lower_r_\d+$/i, /^hand_r_\d+$/i],
  armL: [/^arm_upper_l_\d+$/i, /^arm_lower_l_\d+$/i, /^hand_l_\d+$/i],
}
function findBone(root, re) {
  let hit = null
  root.traverse(o => { if (!hit && re.test(o.name || '')) hit = o })
  return hit
}
const STAND_HEAD = 1.70          // head centre above the feet, standing

/** Measure a model once: its scale, its facing, and where its feet are. */
export function prepareTemplate(gltf) {
  const probe = cloneSkeleton(gltf.scene)
  const holder = new THREE.Group()
  holder.add(probe)
  holder.updateMatrixWorld(true)
  const head = wpos(findBone(probe, BONE.head), new THREE.Vector3())
  const ball = wpos(findBone(probe, BONE.legR[3]), new THREE.Vector3())
  const ankle = wpos(findBone(probe, BONE.legR[2]), new THREE.Vector3())
  const ballL = wpos(findBone(probe, BONE.legL[3]), new THREE.Vector3())
  // lowest skinned vertex is the sole
  let minY = Infinity
  probe.traverse(o => {
    if (o.isSkinnedMesh) { o.computeBoundingBox(); const bb = o.boundingBox.clone().applyMatrix4(o.matrixWorld); minY = Math.min(minY, bb.min.y) }
  })
  const fwd = new THREE.Vector3().subVectors(ball, ankle).setY(0).normalize()
  const scale = STAND_HEAD / (head.y - minY)
  const yawFix = Math.atan2(fwd.x, fwd.z) - Math.PI      // turn the model's forward onto -Z
  const mid = ball.clone().add(ballL).multiplyScalar(0.5)
  return { scale, yawFix, minY, center: new THREE.Vector3(mid.x, 0, mid.z) }
}

export function buildCharacter(gltf, tpl, team) {
  const rig = cloneSkeleton(gltf.scene)
  const inner = new THREE.Group()               // model -> metres, facing -Z, feet at 0
  inner.add(rig)
  inner.scale.setScalar(tpl.scale)
  inner.rotation.y = tpl.yawFix
  // put the feet, not the export's origin, on the agent position
  const c = tpl.center, cs = Math.cos(tpl.yawFix), sn = Math.sin(tpl.yawFix)
  inner.position.set(-(c.x * cs + c.z * sn) * tpl.scale, -tpl.minY * tpl.scale, -(-c.x * sn + c.z * cs) * tpl.scale)
  const root = new THREE.Group()                // agent space: follows pos + yaw
  root.add(inner)
  const aim = new THREE.Group()                 // gun frame: yaw + aim pitch at the chest
  root.add(aim)

  const defuserMeshes = []
  rig.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return
    o.castShadow = true
    o.receiveShadow = true
    o.frustumCulled = false
    const name = `${o.name} ${o.material?.name || ''}`
    if (/defuse/i.test(name)) defuserMeshes.push(o)    // the SAS model wears a kit: only show it when bought
  })
  const bone = re => findBone(rig, re)
  const bones = {
    pelvis: bone(BONE.pelvis), spine: BONE.spine.map(bone), neck: bone(BONE.neck), head: bone(BONE.head),
    legR: BONE.legR.map(bone), legL: BONE.legL.map(bone), armR: BONE.armR.map(bone), armL: BONE.armL.map(bone),
  }
  const all = new Set([bones.pelvis, ...bones.spine, bones.neck, bones.head, ...bones.legR, ...bones.legL, ...bones.armR, ...bones.armL])
  const bind = new Map()
  for (const b of all) if (b) bind.set(b, { q: b.quaternion.clone(), p: b.position.clone() })

  root.updateMatrixWorld(true)
  const len = (a, b) => wpos(a, new THREE.Vector3()).distanceTo(wpos(b, new THREE.Vector3()))
  const lengths = {
    legR: [len(bones.legR[0], bones.legR[1]), len(bones.legR[1], bones.legR[2])],
    legL: [len(bones.legL[0], bones.legL[1]), len(bones.legL[1], bones.legL[2])],
    armR: [len(bones.armR[0], bones.armR[1]), len(bones.armR[1], bones.armR[2])],
    armL: [len(bones.armL[0], bones.armL[1]), len(bones.armL[1], bones.armL[2])],
  }
  // bind-pose feet in root space
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const footR = wpos(bones.legR[2], new THREE.Vector3()).applyMatrix4(toRoot)
  const footL = wpos(bones.legL[2], new THREE.Vector3()).applyMatrix4(toRoot)
  const pelvisY = wpos(bones.pelvis, new THREE.Vector3()).applyMatrix4(toRoot).y
  const chest = wpos(bones.spine[3], new THREE.Vector3()).applyMatrix4(toRoot)
  return { root, inner, rig, aim, bones, bind, lengths, footR, footL, pelvisY, chest, team, defuserMeshes, gun: null, gunId: null }
}

const _t = new THREE.Vector3(), _pole = new THREE.Vector3(), _fwd = new THREE.Vector3(), _right = new THREE.Vector3()
const _m = new THREE.Matrix4()

export function pose(ch, a, dt) {
  const { bones, bind, root } = ch
  for (const m of ch.defuserMeshes || []) m.visible = !!a.defuser
  for (const [b, v] of bind) { b.quaternion.copy(v.q); b.position.copy(v.p) }

  const dead = !a.alive
  const tDead = dead ? game.time - a.deathTime : 0
  root.position.copy(a.pos)
  root.rotation.set(0, a.yaw, 0, 'YXZ')

  if (dead) {
    // fall over backwards, pivoting at the feet
    const f = Math.min(1, tDead / 0.55)
    const e = f * f
    root.rotation.x = e * 1.45
    root.position.y = a.pos.y + e * 0.18
    ch.aim.visible = false
    root.updateMatrixWorld(true)
    a.headFromModel = false
    return
  }

  const speed = Math.hypot(a.vel.x, a.vel.z)
  // stride: phase from distance travelled
  a.stepPhase = (a.stepPhase || 0) + (speed * dt) / 0.72 * Math.PI
  const move = Math.min(1, speed / 4)
  const duck = a.duck

  // pelvis drop for the crouch and a small bounce in the stride
  const drop = duck * 0.42 + Math.abs(Math.sin(a.stepPhase)) * 0.03 * move
  root.updateMatrixWorld(true)
  if (drop > 0.001) {
    _t.set(0, -drop, 0)
    // move the pelvis in world space: express the offset in its parent's frame
    _m.copy(bones.pelvis.parent.matrixWorld).invert()
    const p0 = wpos(bones.pelvis, new THREE.Vector3())
    const p1 = p0.clone().add(_t).applyMatrix4(_m)
    bones.pelvis.position.copy(p1)
    bones.pelvis.updateWorldMatrix(false, true)
  }

  // spine follows the aim pitch, spread over the vertebrae; lean forward in a crouch
  const pitch = a.pitch
  _right.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw))
  const bend = -pitch * 0.55 + duck * 0.25 + move * 0.08
  for (let i = 1; i < 4; i++) {
    const s = bones.spine[i]
    if (!s) continue
    _q.setFromAxisAngle(_right, bend / 3)
    s.getWorldQuaternion(_q2)
    _q.multiply(_q2)
    s.parent.getWorldQuaternion(_q3).invert()
    s.quaternion.copy(_q3.multiply(_q))
    s.updateWorldMatrix(false, true)
  }
  // lean: the spine tips sideways about the facing direction
  if (a.lean) {
    _fwd.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw))
    for (let i = 1; i < 4; i++) {
      const s = bones.spine[i]
      if (!s) continue
      _q.setFromAxisAngle(_fwd, a.lean * 0.15)
      s.getWorldQuaternion(_q2)
      _q.multiply(_q2)
      s.parent.getWorldQuaternion(_q3).invert()
      s.quaternion.copy(_q3.multiply(_q))
      s.updateWorldMatrix(false, true)
    }
  }
  if (bones.head) {
    _q.setFromAxisAngle(_right, -pitch * 0.45)
    bones.head.getWorldQuaternion(_q2)
    _q.multiply(_q2)
    bones.head.parent.getWorldQuaternion(_q3).invert()
    bones.head.quaternion.copy(_q3.multiply(_q))
    bones.head.updateWorldMatrix(false, true)
  }

  // --- legs: plant the feet ---
  _fwd.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw))
  // move direction relative to facing, so strafing steps sideways
  const vx = speed > 0.05 ? a.vel.x / speed : 0, vz = speed > 0.05 ? a.vel.z / speed : 0
  for (const side of ['R', 'L']) {
    const leg = side === 'R' ? bones.legR : bones.legL
    const L = ch.lengths['leg' + side]
    const foot = side === 'R' ? ch.footR : ch.footL
    const ph = a.stepPhase + (side === 'R' ? 0 : Math.PI)
    const stride = Math.sin(ph) * 0.26 * move
    const lift = Math.max(0, Math.cos(ph)) * 0.12 * move
    _t.copy(foot).applyMatrix4(root.matrixWorld)
    _t.x += vx * stride; _t.z += vz * stride
    _t.y = a.pos.y + foot.y + lift + (duck > 0.3 ? 0.02 : 0)
    // spread the knees a touch when crouched
    _t.addScaledVector(_right, (side === 'R' ? 1 : -1) * duck * 0.08)
    _pole.copy(_fwd).multiplyScalar(1).addScaledVector(_right, (side === 'R' ? 0.3 : -0.3))
    twoBone(leg[0], leg[1], leg[2], _t, _pole, L[0], L[1])
  }

  // --- the gun, carried at the chest along the aim ---
  const inst = activeWeapon(a)
  const id = inst?.id
  // `gunSkin`: the lobby agent shows the gun in the skin you have equipped
  const key = `${id}|${a.gunSkin?.id || ''}`
  if (ch.gunId !== key) {
    if (ch.gun) ch.aim.remove(ch.gun.group)
    ch.gun = id && id !== 'knife' ? buildGun(id, { shadows: true, skin: a.gunSkin || null }) : null
    if (ch.gun) ch.aim.add(ch.gun.group)
    ch.gunId = key
  }
  ch.aim.visible = true
  const chestW = wpos(bones.spine[3], new THREE.Vector3())
  ch.aim.position.copy(chestW).sub(root.position)
  ch.aim.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -a.yaw)
  ch.aim.rotation.set(pitch, 0, 0, 'YXZ')
  if (ch.gun && a.gunHold) {
    // a set hold in the chest frame (the lobby agent carries the gun across its body)
    ch.gun.group.position.copy(a.gunHold.pos)
    ch.gun.group.quaternion.copy(a.gunHold.quat)
  } else if (ch.gun) {
    const small = inst && /glock|usp|p250|deagle|he|flash|smoke|c4/.test(id)
    ch.gun.group.position.set(0.1, small ? -0.02 : -0.07, small ? -0.42 : -0.3)
    ch.gun.group.rotation.set(0, 0, 0)
  }
  root.updateMatrixWorld(true)

  // --- arms onto the grips ---
  const reach = (arm, L, anchorPos, poleDir) => {
    _t.copy(anchorPos).applyMatrix4(ch.gun ? ch.gun.group.matrixWorld : ch.aim.matrixWorld)
    twoBone(arm[0], arm[1], arm[2], _t, poleDir, L[0], L[1])
  }
  if (ch.gun) {
    _pole.set(0, -1, 0).addScaledVector(_right, 0.6)
    reach(bones.armR, ch.lengths.armR, ch.gun.gripR.pos, _pole.clone())
    const left = ch.gun.gripL?.pos ?? ch.gun.gripR.pos.clone().add(new THREE.Vector3(-0.03, -0.02, 0.02))
    _pole.set(0, -1, 0).addScaledVector(_right, -0.8)
    reach(bones.armL, ch.lengths.armL, left, _pole.clone())
  } else {
    // knife: right hand forward at the hip, left hand relaxed
    _t.set(0.22, -0.25, -0.35)
    _pole.set(0, -1, 0).addScaledVector(_right, 0.6)
    twoBone(bones.armR[0], bones.armR[1], bones.armR[2], _t.applyMatrix4(ch.aim.matrixWorld).clone(), _pole.clone(), ...ch.lengths.armR)
    _t.set(-0.22, -0.4, -0.1)
    _pole.set(0, -1, 0).addScaledVector(_right, -0.8)
    twoBone(bones.armL[0], bones.armL[1], bones.armL[2], _t.applyMatrix4(ch.aim.matrixWorld).clone(), _pole.clone(), ...ch.lengths.armL)
  }

  // report the rendered body as the hitboxes: head sphere and torso centres
  wpos(bones.head, a.headPos)
  a.headPos.y += 0.08
  a.headFromModel = true
  const pv = wpos(bones.pelvis, _a), ch3 = wpos(bones.spine[3], _b)
  a.hitPelvis = [pv.x, pv.z]
  a.hitChest = [ch3.x, ch3.z]
  if (ch.gun) a.muzzleWorld = (a.muzzleWorld || new THREE.Vector3()).copy(ch.gun.muzzle).applyMatrix4(ch.gun.group.matrixWorld)
}

