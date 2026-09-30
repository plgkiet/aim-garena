import * as THREE from 'three'
import { paintMeshes } from '../skins/apply'

/* Procedural weapon models, built from boxes and cylinders at real-world scale.

   Gun space: the pistol grip's centre is the origin, the barrel runs down -Z,
   up is +Y, the ejection port is on +X (right). Every model also reports the
   anchors the arms and effects need:
     gripR  where the firing hand closes, and the line the grip runs along
     gripL  where the support hand closes, and the line it holds along
     muzzle / eject   effect origins
     mag    the magazine object, animated by the reload                       */

let MATS = null
function mats() {
  if (MATS) return MATS
  const std = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: 0.9, ...extra })
  MATS = {
    black: std('#1d1e20', 0.55, 0.42),
    steel: std('#4d5157', 0.85, 0.32),
    dark: std('#2b2d31', 0.7, 0.38),
    polymer: std('#232427', 0.05, 0.72),
    wood: std('#6b3a1f', 0.0, 0.55),
    woodLight: std('#8a5230', 0.0, 0.5),
    tan: std('#9c8563', 0.05, 0.7),
    olive: std('#4a5236', 0.1, 0.65),
    green: std('#3d5a3c', 0.25, 0.5),
    brass: std('#c9a24a', 0.9, 0.3),
    chrome: std('#b9bcc2', 1, 0.18),
    orange: std('#9a4a1c', 0.1, 0.55),
    glass: std('#0d1a24', 0.2, 0.05, { emissive: '#08202c', emissiveIntensity: 0.4 }),
    red: std('#7a1d18', 0.1, 0.6),
    c4: std('#6f6a4b', 0.05, 0.8),
    screen: std('#15301a', 0.1, 0.3, { emissive: '#3cff6a', emissiveIntensity: 0.35 }),
    rubber: std('#141516', 0.0, 0.9),
  }
  return MATS
}

const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2)   // along Z
const CYLY = new THREE.CylinderGeometry(1, 1, 1, 14)
const SPHERE = new THREE.SphereGeometry(1, 16, 12)

function box(parent, mat, [w, h, d], [x, y, z], [rx = 0, ry = 0, rz = 0] = []) {
  const m = new THREE.Mesh(BOX, mat)
  m.scale.set(w, h, d)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  parent.add(m)
  return m
}
function cyl(parent, mat, r, len, [x, y, z], [rx = 0, ry = 0, rz = 0] = [], ry2 = r) {
  const m = new THREE.Mesh(CYL, mat)
  m.scale.set(r, ry2, len)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  parent.add(m)
  return m
}
function cylY(parent, mat, r, h, [x, y, z], rot = []) {
  const m = new THREE.Mesh(CYLY, mat)
  m.scale.set(r, h, r)
  m.position.set(x, y, z)
  m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0)
  parent.add(m)
  return m
}
function ball(parent, mat, r, [x, y, z], s = [1, 1, 1]) {
  const m = new THREE.Mesh(SPHERE, mat)
  m.scale.set(r * s[0], r * s[1], r * s[2])
  m.position.set(x, y, z)
  parent.add(m)
  return m
}

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const RAKE = 0.32

/** A pistol grip, raked forward at the top. Returns the grip anchor. */
function pistolGrip(g, mat, { h = 0.105, w = 0.03, d = 0.046, rake = RAKE, y = -0.03, z = 0.012 } = {}) {
  box(g, mat, [w, h, d], [0, y, z], [-rake, 0, 0])
  return { pos: V(0, y + 0.005, z), dir: V(0, Math.cos(rake), -Math.sin(rake)) }
}
function triggerGuard(g, mat, z = -0.045, y = -0.002) {
  box(g, mat, [0.008, 0.006, 0.06], [0, y - 0.018, z - 0.004])
  box(g, mat, [0.008, 0.03, 0.006], [0, y - 0.004, z - 0.034])
  box(g, mat, [0.004, 0.018, 0.004], [0, y + 0.002, z + 0.004], [0.3, 0, 0])   // trigger
}

/** A cone along Z: radius `rFront` at the -Z end, `rBack` at the +Z end. */
function cone(parent, mat, rFront, rBack, len, [x, y, z]) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rBack, rFront, len, 18).rotateX(Math.PI / 2), mat)
  m.position.set(x, y, z)
  parent.add(m)
  return m
}

/** A side profile (points as [z, y], optional holes) extruded across X, `w` wide. */
function profile(parent, mat, pts, w, holes = []) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)))
  for (const h of holes) shape.holes.push(h)
  const bevel = 0.004
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: w - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 18,
  })
  // shape x -> gun z, extrusion -> gun x, centred on the bore line
  geo.translate(0, 0, -(w - bevel * 2) / 2)
  geo.rotateY(-Math.PI / 2)
  const m = new THREE.Mesh(geo, mat)
  parent.add(m)
  return m
}

/* ------------------------------------------------------------- rifles ---- */

/* The AWP (Accuracy International Arctic Warfare): one-piece chassis with a
   thumbhole stock and raised cheek piece, straight box magazine, long heavy
   barrel with a muzzle brake, folded bipod, and a big scope with a flared
   objective and eyepiece. Same grip, support hand and muzzle as before, so
   the viewmodel poses still fit. */
function awp(g, M) {
  const body = M.green
  const rake = 0.45
  const gripR = { pos: V(0, -0.025, 0.012), dir: V(0, Math.cos(rake), -Math.sin(rake)) }
  // thumbhole: the hand's gap between the grip and the stock
  const hole = new THREE.Path()
  hole.absellipse(0.098, -0.035, 0.05, 0.04, 0, Math.PI * 2, false)
  profile(g, body, [
    [-0.46, 0.047], [-0.12, 0.05], [0.07, 0.05],          // forend and action bed, flat along the top
    [0.14, 0.086], [0.3, 0.092], [0.34, 0.088],           // cheek piece
    [0.352, 0.075], [0.352, -0.07],                       // butt (the pad goes on behind)
    [0.3, -0.08], [0.07, -0.102], [0.03, -0.102],         // straight lower line to the grip foot
    [-0.02, 0.0], [-0.09, 0.0],                           // grip front, trigger opening
    [-0.14, 0.004], [-0.46, 0.012],                       // forend underside, tapering slightly
  ], 0.05, [hole])
  box(g, M.rubber, [0.05, 0.16, 0.018], [0, 0.008, 0.361])                 // butt pad
  box(g, body, [0.03, 0.012, 0.13], [0, 0.098, 0.24])                      // cheek riser
  triggerGuard(g, M.black)
  // receiver and bolt
  cyl(g, M.steel, 0.02, 0.26, [0, 0.07, -0.05])
  box(g, M.black, [0.022, 0.008, 0.24], [0, 0.093, -0.06])                 // scope rail
  cyl(g, M.steel, 0.007, 0.06, [0.035, 0.07, 0.035], [0, Math.PI / 2, 0])
  ball(g, M.black, 0.013, [0.068, 0.068, 0.035])
  // barrel, muzzle brake, folded bipod
  const blen = 0.55
  cone(g, M.dark, 0.012, 0.016, blen, [0, 0.07, -0.2 - blen / 2])
  cyl(g, M.black, 0.019, 0.075, [0, 0.07, -0.2 - blen - 0.03])
  for (const dz of [-0.012, 0.012]) cyl(g, M.steel, 0.02, 0.006, [0, 0.07, -0.2 - blen - 0.03 + dz])
  box(g, M.steel, [0.03, 0.014, 0.03], [0, 0.0, -0.43])
  for (const dx of [-0.009, 0.009]) cyl(g, M.steel, 0.004, 0.2, [dx, -0.008, -0.33])
  // magazine: straight, ahead of the trigger
  const mag = new THREE.Group()
  mag.position.set(0, 0.0, -0.12)
  box(mag, M.dark, [0.032, 0.07, 0.08], [0, -0.035, 0])
  box(mag, M.black, [0.034, 0.008, 0.084], [0, -0.072, 0])
  g.add(mag)
  // scope: tube, flared objective and eyepiece, turrets, rings
  const sy = 0.135
  cyl(g, M.black, 0.017, 0.22, [0, sy, -0.07])
  cone(g, M.black, 0.031, 0.017, 0.05, [0, sy, -0.205])
  cyl(g, M.black, 0.031, 0.03, [0, sy, -0.245])
  cyl(g, M.glass, 0.027, 0.004, [0, sy, -0.261])
  cone(g, M.black, 0.017, 0.024, 0.035, [0, sy, 0.057])
  cyl(g, M.black, 0.024, 0.045, [0, sy, 0.097])
  cylY(g, M.steel, 0.012, 0.026, [0, sy + 0.026, -0.06])                    // elevation turret
  cylY(g, M.steel, 0.011, 0.024, [0.026, sy, -0.06], [0, 0, Math.PI / 2])  // windage turret
  for (const z of [-0.14, 0.0]) {
    box(g, M.steel, [0.026, 0.034, 0.016], [0, sy - 0.028, z])
    cyl(g, M.steel, 0.021, 0.016, [0, sy, z])
  }
  return {
    gripR, gripL: { pos: V(0, 0.0, -0.3), dir: V(0, 0, -1) },
    muzzle: V(0, 0.07, -0.2 - blen - 0.07), eject: V(0.028, 0.07, -0.02), mag, handguardR: 0.03, scope: true,
  }
}


/* The AK-47: stamped receiver with its ribbed dust cover, fixed wooden stock
   that flares to the butt, wood lower and upper handguards around the gas
   tube, front sight tower, slant brake, cleaning rod, and the one-piece
   banana magazine. Grip, support hand, muzzle and sights sit where they
   always did, so the viewmodel poses still fit. */
function ak47Detailed(g, M) {
  const wood = M.wood, woodDark = M.woodLight
  const gripR = pistolGrip(g, woodDark)
  triggerGuard(g, M.dark)
  // receiver, dust cover, rear sight
  box(g, M.dark, [0.046, 0.066, 0.36], [0, 0.052, -0.07])
  cyl(g, M.black, 0.023, 0.3, [0, 0.083, -0.07], [], 0.012)
  for (let i = 0; i < 5; i++) box(g, M.black, [0.047, 0.004, 0.012], [0, 0.093, 0.04 + i * 0.012])  // cover ribs
  box(g, M.dark, [0.03, 0.02, 0.05], [0, 0.098, -0.205])
  box(g, M.black, [0.012, 0.012, 0.03], [0, 0.11, -0.19])
  box(g, M.steel, [0.004, 0.012, 0.09], [0.025, 0.066, -0.02])              // selector lever
  box(g, M.steel, [0.02, 0.012, 0.012], [0.034, 0.078, 0.06])               // charging handle
  // wooden stock: thin at the wrist, dropping and widening to the butt
  profile(g, wood, [
    [0.105, 0.078], [0.2, 0.072], [0.37, 0.058],
    [0.372, -0.066], [0.3, -0.05], [0.18, 0.004], [0.105, 0.022],
  ], 0.042)
  box(g, M.dark, [0.044, 0.13, 0.014], [0, -0.004, 0.378])                   // butt plate
  // lower handguard, gas tube and its upper wooden cover
  profile(g, wood, [[-0.25, 0.076], [-0.415, 0.072], [-0.425, 0.03], [-0.25, 0.022]], 0.052)
  box(g, M.dark, [0.056, 0.058, 0.012], [0, 0.05, -0.43])                    // handguard retainer
  cyl(g, woodDark, 0.018, 0.16, [0, 0.093, -0.33], [], 0.013)
  cyl(g, M.dark, 0.009, 0.08, [0, 0.093, -0.45])
  box(g, M.dark, [0.026, 0.05, 0.03], [0, 0.074, -0.47])                     // gas block
  // barrel, front sight, slant brake, cleaning rod
  cyl(g, M.dark, 0.0105, 0.37, [0, 0.058, -0.435])
  cyl(g, M.dark, 0.014, 0.03, [0, 0.058, -0.585])
  box(g, M.dark, [0.012, 0.034, 0.02], [0, 0.083, -0.585])
  for (const dx of [-0.009, 0.009]) box(g, M.dark, [0.004, 0.026, 0.016], [dx, 0.088, -0.585])
  cyl(g, M.black, 0.013, 0.05, [0, 0.058, -0.64])
  cyl(g, M.steel, 0.003, 0.2, [0, 0.036, -0.52])
  // the banana magazine, one curved piece, with a floor plate
  const mag = new THREE.Group()
  mag.position.set(0, 0.022, -0.105)
  const m = new THREE.Shape()
  m.moveTo(0.034, 0); m.lineTo(-0.036, 0)
  m.quadraticCurveTo(-0.048, -0.11, -0.112, -0.19)
  m.lineTo(-0.058, -0.218)
  m.quadraticCurveTo(0.012, -0.12, 0.034, 0)
  const mg = new THREE.ExtrudeGeometry(m, { depth: 0.022, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 })
  mg.translate(0, 0, -0.011); mg.rotateY(-Math.PI / 2)
  mag.add(new THREE.Mesh(mg, M.orange))
  // reinforcing ribs along the spine
  for (let i = 0; i < 4; i++) {
    const t = 0.2 + i * 0.2
    box(mag, M.orange, [0.03, 0.006, 0.012], [0, -0.03 - t * 0.17, 0.02 - t * t * 0.075], [0.25 + t * 0.55, 0, 0])
  }
  box(mag, M.dark, [0.032, 0.008, 0.062], [0, -0.206, -0.085], [0.45, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.028, -0.33), dir: V(0, 0, -1) },
    muzzle: V(0, 0.058, -0.69), eject: V(0.026, 0.07, -0.02), mag, handguardR: 0.026,
    sight: { rear: V(0, 0.112, -0.19), front: V(0, 0.1, -0.585) },
  }
}

function ak47(g, M, variant = 'ak') {
  const body = variant === 'galil' ? M.polymer : M.dark
  const furniture = variant === 'galil' ? M.polymer : M.wood
  const gripR = pistolGrip(g, variant === 'galil' ? M.polymer : M.woodLight)
  triggerGuard(g, M.black)
  box(g, body, [0.046, 0.066, 0.36], [0, 0.052, -0.07])                  // receiver
  box(g, M.black, [0.044, 0.02, 0.3], [0, 0.092, -0.07])                 // dust cover
  cyl(g, M.black, 0.022, 0.3, [0, 0.083, -0.07], [], 0.012)
  box(g, M.black, [0.012, 0.018, 0.03], [0, 0.103, -0.19])               // rear sight
  // stock
  box(g, furniture, [0.04, 0.062, 0.24], [0, 0.03, 0.22], [0.12, 0, 0])
  box(g, furniture, [0.042, 0.11, 0.03], [0, 0.0, 0.34], [0.12, 0, 0])
  // handguard + gas tube
  box(g, furniture, [0.052, 0.046, 0.19], [0, 0.048, -0.33])
  box(g, variant === 'galil' ? M.polymer : M.woodLight, [0.034, 0.028, 0.17], [0, 0.093, -0.33])
  // barrel, front sight, brake
  cyl(g, M.steel, 0.0105, 0.26, [0, 0.058, -0.53])
  cyl(g, M.black, 0.008, 0.13, [0, 0.085, -0.47])
  box(g, M.black, [0.012, 0.034, 0.02], [0, 0.083, -0.585])
  cyl(g, M.black, 0.015, 0.05, [0, 0.058, -0.66])
  // magazine: the AK's curve, in segments
  const mag = new THREE.Group()
  mag.position.set(0, 0.022, -0.105)
  const n = variant === 'galil' ? 3 : 4
  for (let i = 0; i < n; i++) {
    const a = (variant === 'galil' ? 0.12 : 0.2) * i
    box(mag, variant === 'ak' ? M.orange : M.black, [0.028, 0.06, 0.068],
      [0, -0.03 - i * 0.052, -0.008 - i * i * (variant === 'galil' ? 0.004 : 0.0075)], [a, 0, 0])
  }
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.028, -0.33), dir: V(0, 0, -1) },
    muzzle: V(0, 0.058, -0.69), eject: V(0.026, 0.07, -0.02), mag, handguardR: 0.026,
    sight: { rear: V(0, 0.112, -0.19), front: V(0, 0.1, -0.585) },
  }
}

/* The M4 (A4 and A1-S): flat-top upper with a Picatinny rail and flip-up rear
   sight, forward assist and ejection port, flared magwell, round ribbed
   handguard, A-frame front sight, birdcage or suppressor, buffer tube and a
   CTR-style stock, and a gently curved STANAG magazine. Anchors unchanged. */
function m4(g, M, silenced) {
  const gripR = pistolGrip(g, M.polymer)
  triggerGuard(g, M.black)
  // lower receiver and magwell
  box(g, M.black, [0.044, 0.045, 0.24], [0, 0.043, -0.04])
  profile(g, M.black, [[-0.165, 0.035], [-0.065, 0.035], [-0.072, -0.008], [-0.158, -0.008]], 0.042)
  // upper receiver, rail, rear sight, charging handle, forward assist, port
  box(g, M.black, [0.042, 0.046, 0.26], [0, 0.088, -0.07])
  box(g, M.dark, [0.024, 0.01, 0.28], [0, 0.116, -0.08])
  for (let i = 0; i < 12; i++) box(g, M.black, [0.027, 0.005, 0.009], [0, 0.123, 0.05 - i * 0.022])
  box(g, M.black, [0.02, 0.03, 0.025], [0, 0.135, 0.02])
  box(g, M.black, [0.03, 0.01, 0.02], [0, 0.1, 0.075])
  cyl(g, M.black, 0.009, 0.04, [0.025, 0.094, 0.03], [0, 0.2, 0])
  box(g, M.dark, [0.004, 0.018, 0.06], [0.022, 0.09, -0.03])
  // handguard
  if (silenced) {
    cyl(g, M.black, 0.024, 0.22, [0, 0.086, -0.33])
    for (let i = 0; i < 4; i++) box(g, M.dark, [0.05, 0.008, 0.03], [0, 0.086, -0.26 - i * 0.045])
  } else {
    cyl(g, M.dark, 0.027, 0.22, [0, 0.086, -0.33])
    for (let i = 0; i < 7; i++) cyl(g, M.black, 0.0285, 0.006, [0, 0.086, -0.235 - i * 0.032])
    box(g, M.black, [0.024, 0.01, 0.22], [0, 0.116, -0.33])
  }
  cyl(g, M.black, 0.03, 0.014, [0, 0.086, -0.215])                         // delta ring
  // A-frame front sight on the gas block
  box(g, M.black, [0.026, 0.022, 0.03], [0, 0.096, -0.45])
  for (const s of [-1, 1]) box(g, M.black, [0.004, 0.04, 0.014], [s * 0.009, 0.126, -0.45], [0, 0, -s * 0.22])
  box(g, M.black, [0.005, 0.03, 0.005], [0, 0.132, -0.45])
  box(g, M.black, [0.024, 0.006, 0.014], [0, 0.146, -0.45])
  // barrel and muzzle
  cyl(g, M.dark, 0.009, 0.14, [0, 0.086, -0.51])
  if (silenced) cyl(g, M.dark, 0.019, 0.2, [0, 0.086, -0.66])
  else {
    cyl(g, M.black, 0.012, 0.05, [0, 0.086, -0.585])
    for (let i = 0; i < 3; i++) box(g, M.dark, [0.026, 0.004, 0.03], [0, 0.086, -0.585], [0, 0, i * Math.PI / 3])
  }
  // buffer tube and stock
  cyl(g, M.black, 0.015, 0.2, [0, 0.075, 0.16])
  profile(g, M.polymer, [
    [0.17, 0.103], [0.3, 0.106], [0.345, 0.1],
    [0.35, -0.025], [0.325, -0.035], [0.3, -0.005], [0.235, 0.042], [0.17, 0.046],
  ], 0.045)
  box(g, M.rubber, [0.047, 0.14, 0.012], [0, 0.036, 0.356])
  // STANAG magazine, gently curved
  const mag = new THREE.Group()
  mag.position.set(0, 0.02, -0.1)
  const m = new THREE.Shape()
  m.moveTo(0.03, 0); m.lineTo(-0.03, 0)
  m.quadraticCurveTo(-0.038, -0.08, -0.054, -0.15)
  m.lineTo(0.008, -0.156)
  m.quadraticCurveTo(0.02, -0.08, 0.03, 0)
  const mg = new THREE.ExtrudeGeometry(m, { depth: 0.02, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 12 })
  mg.translate(0, 0, -0.01); mg.rotateY(-Math.PI / 2)
  mag.add(new THREE.Mesh(mg, M.dark))
  box(mag, M.black, [0.03, 0.008, 0.066], [0, -0.155, -0.023], [0.12, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.058, -0.33), dir: V(0, 0, -1) },
    muzzle: V(0, 0.086, silenced ? -0.77 : -0.61), eject: V(0.026, 0.09, -0.04), mag, handguardR: 0.027,
    sight: { rear: V(0, 0.15, 0.02), front: V(0, 0.15, -0.45) },
  }
}

function famas(g, M) {
  const gripR = pistolGrip(g, M.polymer)
  triggerGuard(g, M.black)
  box(g, M.polymer, [0.05, 0.1, 0.56], [0, 0.058, 0.04])                   // bullpup body
  box(g, M.black, [0.03, 0.03, 0.44], [0, 0.155, -0.02])                   // carry handle
  box(g, M.black, [0.02, 0.05, 0.03], [0, 0.125, -0.22])
  box(g, M.black, [0.02, 0.05, 0.03], [0, 0.125, 0.18])
  box(g, M.polymer, [0.044, 0.05, 0.16], [0, 0.04, -0.3])                  // fore
  cyl(g, M.steel, 0.01, 0.2, [0, 0.06, -0.44])
  cyl(g, M.black, 0.014, 0.05, [0, 0.06, -0.55])
  const mag = new THREE.Group()
  mag.position.set(0, 0.01, 0.14)
  box(mag, M.dark, [0.026, 0.1, 0.06], [0, -0.05, 0], [0.12, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.02, -0.3), dir: V(0, 0, -1) },
    muzzle: V(0, 0.06, -0.58), eject: V(0.028, 0.08, 0.12), mag, handguardR: 0.026,
    sight: { rear: V(0, 0.172, 0.15), front: V(0, 0.172, -0.2) },
  }
}

function sniper(g, M, awp, auto = null) {
  const body = awp ? M.green : auto === 'scar' ? M.tan : auto === 'g3' ? M.olive : M.dark
  const gripR = pistolGrip(g, body, { rake: 0.45 })
  triggerGuard(g, M.black)
  box(g, M.steel, [0.042, 0.05, 0.24], [0, 0.06, -0.05])                    // action
  box(g, body, [0.056, 0.06, awp ? 0.52 : 0.4], [0, 0.03, awp ? -0.2 : -0.15])   // chassis
  // thumbhole stock
  box(g, body, [0.05, 0.05, 0.28], [0, 0.07, 0.2])
  box(g, body, [0.052, 0.15, 0.06], [0, 0.0, 0.32])
  box(g, body, [0.05, 0.03, 0.18], [0, -0.06, 0.24], [-0.12, 0, 0])
  // bolt
  cyl(g, M.steel, 0.008, 0.06, [0.035, 0.07, 0.03], [0, Math.PI / 2, 0])
  ball(g, M.black, 0.013, [0.07, 0.07, 0.03])
  // barrel
  const blen = awp ? 0.55 : 0.46
  cyl(g, M.dark, awp ? 0.014 : 0.011, blen, [0, 0.07, -0.2 - blen / 2])
  if (awp) cyl(g, M.black, 0.021, 0.07, [0, 0.07, -0.2 - blen - 0.03])
  // scope
  const sy = awp ? 0.135 : 0.125
  cyl(g, M.black, awp ? 0.022 : 0.018, 0.2, [0, sy, -0.06])
  cyl(g, M.black, awp ? 0.03 : 0.024, 0.07, [0, sy, -0.2])
  cyl(g, M.glass, awp ? 0.026 : 0.02, 0.005, [0, sy, -0.236])
  cyl(g, M.black, awp ? 0.026 : 0.021, 0.05, [0, sy, 0.06])
  box(g, M.black, [0.02, 0.05, 0.02], [0, sy - 0.035, -0.12])
  box(g, M.black, [0.02, 0.05, 0.02], [0, sy - 0.035, 0.0])
  cylY(g, M.black, 0.009, 0.02, [0, sy + 0.028, -0.06])
  const mag = new THREE.Group()
  mag.position.set(0, 0.0, -0.1)
  // the autosnipers carry a 20-round box magazine
  box(mag, M.dark, auto ? [0.03, 0.13, 0.075] : [0.03, 0.06, 0.07], [0, auto ? -0.065 : -0.03, 0], [auto ? 0.1 : 0, 0, 0])
  g.add(mag)
  if (auto) {
    box(g, M.black, [0.03, 0.012, 0.3], [0, 0.1, -0.12])                       // top rail
    box(g, body, [0.05, 0.05, 0.2], [0, 0.03, -0.42])                          // long handguard
  }
  return {
    gripR, gripL: { pos: V(0, 0.0, -0.3), dir: V(0, 0, -1) },
    muzzle: V(0, 0.07, -0.2 - blen - 0.07), eject: V(0.028, 0.07, -0.02), mag, handguardR: 0.03, scope: true,
  }
}

/* ---------------------------------------------------------------- SMGs --- */

function mac10(g, M) {
  // the magazine sits inside the grip
  box(g, M.black, [0.03, 0.12, 0.042], [0, -0.04, 0.0], [-0.12, 0, 0])
  const gripR = { pos: V(0, -0.028, 0.0), dir: V(0, Math.cos(0.12), -Math.sin(0.12)) }
  triggerGuard(g, M.black)
  box(g, M.dark, [0.05, 0.08, 0.24], [0, 0.055, -0.05])
  box(g, M.black, [0.02, 0.02, 0.02], [0, 0.105, 0.04])
  cyl(g, M.steel, 0.012, 0.08, [0, 0.07, -0.21])
  cyl(g, M.black, 0.015, 0.04, [0, 0.07, -0.26])
  box(g, M.black, [0.03, 0.01, 0.2], [0.022, 0.02, 0.15])                   // folded wire stock
  const mag = new THREE.Group()
  mag.position.set(0, -0.1, 0.015)
  box(mag, M.dark, [0.026, 0.11, 0.036], [0, -0.03, 0], [-0.12, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.01, -0.12), dir: V(0, 0, -1) },
    muzzle: V(0, 0.07, -0.29), eject: V(0.028, 0.08, -0.04), mag, handguardR: 0.028,
    sight: { rear: V(0, 0.115, 0.04), front: V(0, 0.115, -0.2) },
  }
}

function mp9(g, M) {
  box(g, M.polymer, [0.03, 0.12, 0.044], [0, -0.04, 0.0], [-0.2, 0, 0])
  const gripR = { pos: V(0, -0.028, 0.0), dir: V(0, Math.cos(0.2), -Math.sin(0.2)) }
  triggerGuard(g, M.black)
  box(g, M.polymer, [0.044, 0.07, 0.24], [0, 0.05, -0.07])
  box(g, M.dark, [0.02, 0.012, 0.24], [0, 0.092, -0.07])
  // vertical fore grip
  box(g, M.polymer, [0.026, 0.07, 0.03], [0, -0.012, -0.15], [-0.1, 0, 0])
  cyl(g, M.steel, 0.01, 0.07, [0, 0.055, -0.22])
  const mag = new THREE.Group()
  mag.position.set(0, -0.1, 0.02)
  box(mag, M.dark, [0.024, 0.14, 0.034], [0, -0.04, 0], [-0.2, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, -0.02, -0.15), dir: V(0, Math.cos(0.1), -Math.sin(0.1)) }, gripLVertical: true,
    muzzle: V(0, 0.055, -0.26), eject: V(0.024, 0.07, -0.04), mag, handguardR: 0.02,
    sight: { rear: V(0, 0.1, 0.03), front: V(0, 0.1, -0.17) },
  }
}

function ump(g, M) {
  const gripR = pistolGrip(g, M.polymer)
  triggerGuard(g, M.black)
  box(g, M.polymer, [0.05, 0.08, 0.36], [0, 0.05, -0.1])
  box(g, M.dark, [0.02, 0.012, 0.3], [0, 0.095, -0.1])
  box(g, M.polymer, [0.02, 0.08, 0.2], [0.026, 0.03, 0.14])                 // folded stock
  cyl(g, M.steel, 0.011, 0.08, [0, 0.06, -0.31])
  const mag = new THREE.Group()
  mag.position.set(0, 0.012, -0.12)
  box(mag, M.dark, [0.028, 0.15, 0.05], [0, -0.07, -0.01], [0.08, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.018, -0.24), dir: V(0, 0, -1) },
    muzzle: V(0, 0.06, -0.36), eject: V(0.026, 0.07, -0.05), mag, handguardR: 0.028,
    sight: { rear: V(0, 0.102, 0), front: V(0, 0.102, -0.25) },
  }
}

/* ------------------------------------------------------------- pistols --- */

function pistol(g, M, kind) {
  const big = kind === 'deagle'
  const slideMat = kind === 'deagle' ? M.chrome : kind === 'p250' ? M.steel : M.black
  const frameMat = kind === 'usp' || kind === 'glock' ? M.polymer : M.black
  const len = big ? 0.25 : kind === 'usp' ? 0.19 : 0.18
  const h = big ? 0.045 : 0.033
  const gripR = pistolGrip(g, frameMat, { h: big ? 0.11 : 0.1, rake: 0.3, w: big ? 0.034 : 0.028 })
  triggerGuard(g, frameMat, -0.035, 0.008)
  box(g, frameMat, [0.026, 0.025, len * 0.8], [0, 0.028, -len * 0.4 + 0.02])     // frame
  const slide = new THREE.Group()
  box(slide, slideMat, [big ? 0.034 : 0.027, h, len], [0, 0.04 + h / 2 + 0.002, -len / 2 + 0.04])
  box(slide, M.black, [0.006, 0.008, 0.008], [0, 0.04 + h + 0.006, -len + 0.05])  // front sight
  box(slide, M.black, [0.016, 0.008, 0.008], [0, 0.04 + h + 0.006, 0.03])        // rear sight
  if (big) box(slide, M.dark, [0.02, 0.012, len], [0, 0.04 + h + 0.004, -len / 2 + 0.04])
  g.add(slide)
  if (kind === 'usp') cyl(g, M.dark, 0.016, 0.16, [0, 0.055, -len - 0.04])
  const mag = new THREE.Group()
  mag.position.set(0, -0.085, 0.03)
  box(mag, M.dark, [0.022, 0.03, 0.04], [0, 0, 0], [-0.3, 0, 0])
  g.add(mag)
  return {
    gripR,
    gripL: { pos: V(-0.016, -0.052, 0.004), dir: V(0, Math.cos(0.3), -Math.sin(0.3)) }, gripLSupport: true,
    muzzle: V(0, 0.055, kind === 'usp' ? -len - 0.13 : -len + 0.02), eject: V(0.02, 0.07, -0.02), mag, slide,
    sight: { rear: V(0, 0.04 + h + 0.01, 0.03), front: V(0, 0.04 + h + 0.01, -len + 0.05) },
    handguardR: 0.022,
  }
}

/* ------------------------------------------------------------ utility ---- */

function grenade(g, M, kind) {
  if (kind === 'he') {
    ball(g, M.olive, 0.034, [0, 0.0, 0], [1, 1.12, 1])
    cylY(g, M.dark, 0.012, 0.03, [0, 0.045, 0])
    box(g, M.steel, [0.012, 0.07, 0.004], [0.028, 0.02, 0], [0, 0, 0.2])
    ball(g, M.steel, 0.012, [0, 0.07, 0.01], [1, 1, 0.2])
  } else {
    const mat = kind === 'flash' ? M.steel : M.green
    cylY(g, mat, 0.026, 0.11, [0, 0.0, 0])
    cylY(g, M.dark, 0.014, 0.03, [0, 0.07, 0])
    box(g, M.steel, [0.01, 0.08, 0.004], [0.024, 0.02, 0], [0, 0, 0.12])
    ball(g, M.steel, 0.012, [0, 0.09, 0.01], [1, 1, 0.2])
    if (kind === 'smoke') cylY(g, M.dark, 0.027, 0.012, [0, -0.03, 0])
  }
  return { gripR: { pos: V(0, -0.005, 0), dir: V(0, 1, 0) }, gripL: null, muzzle: V(0, 0, 0), eject: V(0, 0, 0), mag: null, handguardR: 0.03 }
}

function c4(g, M) {
  box(g, M.c4, [0.2, 0.065, 0.12], [0, 0, 0])
  box(g, M.dark, [0.08, 0.02, 0.07], [0.03, 0.04, 0])
  box(g, M.screen, [0.05, 0.004, 0.022], [0.03, 0.051, -0.018])
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box(g, M.black, [0.012, 0.004, 0.009], [0.012 + i * 0.016, 0.051, 0.006 + j * 0.011])
  for (const [c, x] of [[M.red, -0.05], [M.orange, -0.06], [M.steel, -0.07]]) cyl(g, c, 0.004, 0.12, [x, 0.036, 0])
  return { gripR: { pos: V(0, 0, 0.08), dir: V(1, 0, 0) }, gripL: null, muzzle: V(0, 0, 0), eject: V(0, 0, 0), mag: null, handguardR: 0.03 }
}

const BUILDERS = {
  ak47: ak47Detailed,
  galil: (g, M) => ak47(g, M, 'galil'),
  m4a4: (g, M) => m4(g, M, false),
  m4a1s: (g, M) => m4(g, M, true),
  famas,
  awp,
  ssg08: (g, M) => sniper(g, M, false),
  g3sg1: (g, M) => sniper(g, M, false, 'g3'),
  scar20: (g, M) => sniper(g, M, false, 'scar'),
  mac10, mp9, ump,
  glock: (g, M) => pistol(g, M, 'glock'),
  usp: (g, M) => pistol(g, M, 'usp'),
  p250: (g, M) => pistol(g, M, 'p250'),
  deagle: (g, M) => pistol(g, M, 'deagle'),
  he: (g, M) => grenade(g, M, 'he'),
  flash: (g, M) => grenade(g, M, 'flash'),
  smoke: (g, M) => grenade(g, M, 'smoke'),
  c4,
}

/** Build a weapon model. Returns { group, ...anchors }. */
/** Build a weapon model, optionally wearing a skin (see skins/catalog.js). */
export function buildGun(id, { shadows = false, skin = null } = {}) {
  const g = new THREE.Group()
  g.name = `gun_${id}`
  const build = BUILDERS[id]
  if (!build) return null
  const M = mats()
  const info = build(g, M)
  g.traverse(o => {
    if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = false }
  })
  if (skin) {
    // the skin goes on the body, furniture and polymer — steel, glass and
    // brass keep their own finish, as on a real skinned gun
    // (a metal-only finish like Case Hardened leaves the wood furniture alone)
    const paintable = new Set([M.black, M.dark, M.polymer, M.tan, M.olive, M.green, M.orange,
      ...(skin.metalOnly ? [] : [M.wood, M.woodLight]),
      // a painting covers the chrome too (the Deagle's slide)
      ...(skin.paintChrome ? [M.chrome] : [])])
    const parts = []
    g.traverse(o => { if (o.isMesh && paintable.has(o.material)) parts.push(o) })
    paintMeshes(g, parts, skin, 'z')
  }
  if (info.mag) info.magRest = { pos: info.mag.position.clone(), rot: info.mag.rotation.clone() }
  return { group: g, id, ...info }
}

export const GUN_IDS = Object.keys(BUILDERS)
