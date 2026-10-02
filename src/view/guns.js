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
  cyl(g, M.steel, 0.02, 0.3, [0, 0.07, -0.07])            // runs on into the barrel, no gap
  cyl(g, M.steel, 0.0175, 0.04, [0, 0.07, -0.225])        // barrel shank
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

/* The FAMAS: a bullpup, its whole length one polymer body (handguard out
   front with finger grooves, the action and magazine behind the grip, the
   butt at the back), the tall carry handle arching over it end to end with
   the sights in it, a full-hand trigger guard, a long barrel with a slotted
   flash hider, and a curved magazine behind the pistol grip. */
function famas(g, M) {
  const gripR = pistolGrip(g, M.polymer)
  box(g, M.black, [0.004, 0.018, 0.004], [0, -0.012, -0.04], [0.3, 0, 0])      // trigger (the big guard is below)
  // the body, nose to butt
  profile(g, M.polymer, [
    [0.335, -0.035], [0.335, 0.118], [0.2, 0.122], [-0.3, 0.114], [-0.352, 0.094],
    [-0.36, 0.045], [-0.34, 0.01], [-0.06, 0.008], [0.04, 0.008], [0.12, -0.012], [0.3, -0.035],
  ], 0.056)
  // finger grooves along the handguard
  for (let i = 0; i < 4; i++) for (const s2 of [-1, 1]) box(g, M.black, [0.004, 0.022, 0.03], [s2 * 0.0285, 0.028, -0.12 - i * 0.055])
  // the carry handle: front post, the long top bar, rear post
  box(g, M.polymer, [0.032, 0.085, 0.036], [0, 0.145, -0.22])
  box(g, M.polymer, [0.032, 0.026, 0.43], [0, 0.192, -0.02])
  box(g, M.polymer, [0.032, 0.07, 0.045], [0, 0.152, 0.175])
  // charging handle inside the arch, sights in the handle
  box(g, M.black, [0.012, 0.014, 0.04], [0, 0.124, -0.06])
  box(g, M.black, [0.012, 0.016, 0.014], [0, 0.212, 0.15])
  box(g, M.black, [0.006, 0.016, 0.01], [0, 0.212, -0.2])
  // full-hand trigger guard from the grip's foot to the handguard
  box(g, M.polymer, [0.014, 0.012, 0.12], [0, -0.084, -0.058])
  box(g, M.polymer, [0.014, 0.096, 0.014], [0, -0.038, -0.112])
  // barrel and flash hider
  cyl(g, M.steel, 0.0105, 0.22, [0, 0.06, -0.46])
  cyl(g, M.black, 0.0145, 0.055, [0, 0.06, -0.595])
  for (let i = 0; i < 3; i++) box(g, M.dark, [0.032, 0.004, 0.04], [0, 0.06, -0.6], [0, 0, i * Math.PI / 3])
  // butt pad
  box(g, M.rubber, [0.058, 0.155, 0.014], [0, 0.04, 0.342])
  // curved magazine behind the grip
  const mag = new THREE.Group()
  mag.position.set(0, -0.005, 0.15)
  box(mag, M.dark, [0.026, 0.13, 0.06], [0, -0.06, 0.006], [0.12, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.02, -0.3), dir: V(0, 0, -1) },
    muzzle: V(0, 0.06, -0.625), eject: V(0.028, 0.08, 0.12), mag, handguardR: 0.026,
    sight: { rear: V(0, 0.224, 0.15), front: V(0, 0.224, -0.2) },
  }
}


/* The SSG 08: a bolt-action in a dark skeleton chassis. A long slotted
   handguard with a rail on top, a thin free-floated barrel with a stubby
   brake, the bipod folded forward under the handguard, a short box
   magazine, the bolt handle out to the right, and a skeleton stock with a
   raised cheek piece and a monopod spike under the butt. */
function ssg08(g, M) {
  const body = M.polymer
  const gripR = pistolGrip(g, body, { rake: 0.32 })
  triggerGuard(g, M.black)
  // action and chassis
  cyl(g, M.dark, 0.018, 0.24, [0, 0.07, -0.05])
  box(g, body, [0.05, 0.048, 0.28], [0, 0.034, -0.05])
  box(g, M.black, [0.024, 0.008, 0.2], [0, 0.092, -0.06])               // scope rail
  // bolt: body, handle out to the right, knob
  cyl(g, M.steel, 0.0085, 0.07, [0, 0.07, 0.07])
  cyl(g, M.steel, 0.005, 0.05, [0.03, 0.065, 0.035], [0, Math.PI / 2, 0.35])
  ball(g, M.black, 0.011, [0.055, 0.056, 0.035])
  // handguard: slotted sides, a rail along the top
  box(g, body, [0.052, 0.054, 0.36], [0, 0.064, -0.37])
  for (let i = 0; i < 5; i++) for (const s2 of [-1, 1]) box(g, M.black, [0.004, 0.014, 0.04], [s2 * 0.0265, 0.064, -0.24 - i * 0.065])
  box(g, M.black, [0.024, 0.008, 0.34], [0, 0.095, -0.37])
  for (let i = 0; i < 14; i++) box(g, M.black, [0.026, 0.005, 0.01], [0, 0.101, -0.21 - i * 0.024])
  // barrel and brake
  cyl(g, M.dark, 0.011, 0.38, [0, 0.07, -0.74])
  cyl(g, M.black, 0.016, 0.065, [0, 0.07, -0.955])
  for (let i = 0; i < 3; i++) box(g, M.dark, [0.036, 0.005, 0.009], [0, 0.07, -0.94 - i * 0.017])
  // bipod folded forward under the handguard
  box(g, M.black, [0.03, 0.016, 0.03], [0, 0.03, -0.5])
  for (const s2 of [-1, 1]) {
    cyl(g, M.black, 0.006, 0.24, [s2 * 0.013, 0.026, -0.62])
    ball(g, M.rubber, 0.009, [s2 * 0.013, 0.026, -0.742])
  }
  // skeleton stock: cheek riser on top, a cut-out below, butt plate
  const hole = new THREE.Path()
  hole.moveTo(0.12, 0.075); hole.lineTo(0.3, 0.075); hole.lineTo(0.31, -0.03); hole.lineTo(0.17, 0.035)
  hole.closePath()
  profile(g, body, [
    [0.08, 0.04], [0.08, 0.1], [0.2, 0.1], [0.215, 0.128], [0.31, 0.128], [0.32, 0.1], [0.34, 0.1],
    [0.35, -0.07], [0.33, -0.08], [0.3, -0.04], [0.2, 0.025], [0.12, 0.03],
  ], 0.04, [hole])
  box(g, M.rubber, [0.044, 0.18, 0.014], [0, 0.015, 0.355])
  // monopod spike under the butt
  cylY(g, M.black, 0.008, 0.05, [0, -0.095, 0.325])
  ball(g, M.rubber, 0.011, [0, -0.122, 0.325])
  // scope on two rings
  const sy = 0.135
  cyl(g, M.black, 0.017, 0.24, [0, sy, -0.06])
  cyl(g, M.black, 0.028, 0.08, [0, sy, -0.21])
  cyl(g, M.glass, 0.024, 0.005, [0, sy, -0.252])
  cyl(g, M.black, 0.022, 0.06, [0, sy, 0.085])
  for (const z of [-0.13, 0.01]) box(g, M.black, [0.022, 0.04, 0.018], [0, sy - 0.025, z])
  cylY(g, M.black, 0.01, 0.024, [0, sy + 0.028, -0.06])
  cyl(g, M.black, 0.01, 0.022, [0.028, sy, -0.06], [0, Math.PI / 2, 0])
  // short box magazine
  const mag = new THREE.Group()
  mag.position.set(0, 0.008, -0.09)
  box(mag, M.dark, [0.03, 0.065, 0.075], [0, -0.032, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.03, -0.32), dir: V(0, 0, -1) },
    muzzle: V(0, 0.07, -0.99), eject: V(0.028, 0.075, -0.02), mag, handguardR: 0.03, scope: true,
  }
}

/* The G3SG/1: HK's long stamped receiver in olive, a drum rear sight at the
   back and the cocking tube running forward over the barrel, a slim
   handguard, the hooded front sight and a pronged flash hider, a straight
   20-round box, a fixed stock with a cheek pad, and the scope standing high
   on its claw mount. */
function g3sg1(g, M) {
  const body = M.olive
  const gripR = pistolGrip(g, body, { rake: 0.28 })
  triggerGuard(g, M.black)
  // receiver and trigger group
  box(g, body, [0.048, 0.068, 0.42], [0, 0.062, -0.08])
  box(g, M.black, [0.05, 0.008, 0.42], [0, 0.03, -0.08])                 // the receiver's seam
  box(g, body, [0.044, 0.034, 0.13], [0, 0.012, 0.0])
  cyl(g, M.black, 0.004, 0.05, [0, 0.03, 0.04], [0, Math.PI / 2, 0])    // selector
  // drum rear sight
  cyl(g, M.black, 0.017, 0.022, [0, 0.118, 0.11], [0, Math.PI / 2, 0])
  box(g, M.black, [0.02, 0.022, 0.03], [0, 0.1, 0.11])
  // cocking tube and handle
  cyl(g, M.dark, 0.012, 0.24, [0, 0.086, -0.41])
  box(g, M.black, [0.02, 0.01, 0.012], [-0.022, 0.086, -0.32])
  // handguard, slimmer toward the front
  box(g, body, [0.056, 0.05, 0.27], [0, 0.052, -0.43])
  for (let i = 0; i < 4; i++) for (const s2 of [-1, 1]) box(g, M.black, [0.004, 0.012, 0.035], [s2 * 0.0285, 0.05, -0.34 - i * 0.06])
  // barrel, hooded front sight, flash hider
  cyl(g, M.dark, 0.011, 0.32, [0, 0.062, -0.72])
  box(g, M.black, [0.03, 0.006, 0.026], [0, 0.124, -0.57])
  for (const s2 of [-1, 1]) box(g, M.black, [0.005, 0.05, 0.026], [s2 * 0.013, 0.1, -0.57])
  box(g, M.black, [0.004, 0.03, 0.006], [0, 0.1, -0.57])
  cyl(g, M.black, 0.016, 0.08, [0, 0.062, -0.92])
  for (let i = 0; i < 4; i++) box(g, M.dark, [0.036, 0.005, 0.06], [0, 0.062, -0.93], [0, 0, i * Math.PI / 4])
  // fixed stock with a cheek pad
  profile(g, body, [
    [0.13, 0.03], [0.13, 0.098], [0.3, 0.102], [0.37, 0.094],
    [0.385, -0.045], [0.34, -0.055], [0.22, -0.005], [0.13, 0.008],
  ], 0.048)
  box(g, M.black, [0.05, 0.02, 0.13], [0, 0.11, 0.26])
  box(g, M.rubber, [0.05, 0.145, 0.014], [0, 0.025, 0.388])
  // scope high on the claw mount
  box(g, M.black, [0.03, 0.06, 0.13], [0, 0.125, -0.05])
  const sy = 0.17
  cyl(g, M.black, 0.018, 0.24, [0, sy, -0.06])
  cyl(g, M.black, 0.027, 0.08, [0, sy, -0.21])
  cyl(g, M.glass, 0.023, 0.005, [0, sy, -0.252])
  cyl(g, M.black, 0.022, 0.06, [0, sy, 0.085])
  cylY(g, M.black, 0.01, 0.022, [0, sy + 0.028, -0.06])
  // magwell under the receiver, and the straight 20-round box seated in it
  box(g, body, [0.046, 0.03, 0.085], [0, 0.02, -0.12])
  const mag = new THREE.Group()
  mag.position.set(0, 0.02, -0.12)
  box(mag, M.dark, [0.03, 0.165, 0.072], [0, -0.07, 0], [0.04, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.026, -0.43), dir: V(0, 0, -1) },
    muzzle: V(0, 0.062, -0.965), eject: V(0.026, 0.075, -0.05), mag, handguardR: 0.03, scope: true,
  }
}

/* The SCAR-20 (FN SCAR-H PR): flat-sided tan upper with a full-length top
   rail, short black side rails on the handguard, a separate lower with a
   flared magwell and a straight 20-round box, side-folding stock with a
   raised cheek piece and a skeletonised lower, long free-floated barrel with
   a slotted brake, and the scope on the rail. */
function scar20(g, M) {
  const body = M.tan
  const gripR = pistolGrip(g, body, { rake: 0.38, h: 0.1 })
  triggerGuard(g, M.black)
  // upper receiver: one long slab from the stock hinge to past the gas block
  profile(g, body, [
    [0.085, 0.056], [0.085, 0.114], [-0.42, 0.114], [-0.44, 0.104], [-0.44, 0.05],
    [-0.25, 0.046], [-0.15, 0.054],
  ], 0.05)
  // full-length top rail with its slots
  box(g, M.black, [0.03, 0.008, 0.52], [0, 0.118, -0.17])
  for (let i = 0; i < 22; i++) box(g, M.black, [0.032, 0.005, 0.01], [0, 0.124, 0.07 - i * 0.022])
  // handguard side and bottom rails
  for (const s of [-1, 1]) {
    box(g, M.black, [0.008, 0.02, 0.12], [s * 0.027, 0.075, -0.33])
    for (let i = 0; i < 5; i++) box(g, M.black, [0.01, 0.022, 0.008], [s * 0.028, 0.075, -0.28 - i * 0.024])
  }
  box(g, M.black, [0.022, 0.008, 0.13], [0, 0.044, -0.34])
  // charging handle (left), ejection port and brass deflector (right)
  box(g, M.black, [0.012, 0.014, 0.03], [-0.031, 0.094, -0.2])
  box(g, M.dark, [0.004, 0.02, 0.07], [0.026, 0.088, -0.03])
  box(g, body, [0.01, 0.018, 0.016], [0.03, 0.09, 0.015])
  // folding iron sights on the rail
  box(g, M.black, [0.022, 0.016, 0.02], [0, 0.13, 0.06])
  box(g, M.black, [0.022, 0.018, 0.02], [0, 0.131, -0.4])
  // lower receiver with the flared magwell
  profile(g, body, [
    [0.075, 0.057], [-0.16, 0.057], [-0.16, 0.004], [-0.13, -0.012], [-0.06, -0.012],
    [-0.04, 0.004], [0.03, 0.004], [0.075, 0.03],
  ], 0.048)
  cyl(g, M.black, 0.004, 0.052, [0, 0.04, 0.05], [0, Math.PI / 2, 0])         // selector
  cyl(g, M.black, 0.004, 0.052, [0, 0.03, -0.14], [0, Math.PI / 2, 0])        // takedown pin
  // stock hinge and side-folding stock with a cheek riser
  box(g, M.black, [0.05, 0.05, 0.02], [0, 0.085, 0.095])
  const hole = new THREE.Path()
  hole.moveTo(0.18, 0.05); hole.lineTo(0.3, 0.05); hole.lineTo(0.31, 0.002); hole.lineTo(0.22, 0.026)
  hole.closePath()
  profile(g, body, [
    [0.1, 0.06], [0.1, 0.112], [0.19, 0.112], [0.22, 0.132], [0.33, 0.134], [0.36, 0.122],
    [0.37, -0.022], [0.352, -0.036], [0.322, -0.032], [0.27, 0.012], [0.19, 0.04], [0.1, 0.048],
  ], 0.046, [hole])
  box(g, M.rubber, [0.048, 0.155, 0.014], [0, 0.05, 0.374])
  // barrel, gas block and slotted muzzle brake
  cyl(g, M.dark, 0.011, 0.3, [0, 0.08, -0.59])
  cyl(g, M.black, 0.015, 0.03, [0, 0.08, -0.455])
  cyl(g, M.black, 0.017, 0.075, [0, 0.08, -0.775])
  for (let i = 0; i < 3; i++) box(g, M.dark, [0.036, 0.004, 0.008], [0, 0.08, -0.755 - i * 0.02])
  // scope on two rings
  const sy = 0.168
  cyl(g, M.black, 0.018, 0.22, [0, sy, -0.08])
  cyl(g, M.black, 0.025, 0.075, [0, sy, -0.225])
  cyl(g, M.glass, 0.021, 0.005, [0, sy, -0.264])
  cyl(g, M.black, 0.022, 0.055, [0, sy, 0.06])
  for (const z of [-0.14, 0.0]) box(g, M.black, [0.024, 0.04, 0.018], [0, sy - 0.026, z])
  cylY(g, M.black, 0.009, 0.022, [0, sy + 0.028, -0.07])
  cyl(g, M.black, 0.009, 0.02, [0.028, sy, -0.07], [0, Math.PI / 2, 0])
  // straight 20-round box, ribbed
  const mag = new THREE.Group()
  mag.position.set(0, 0.004, -0.1)
  box(mag, body, [0.028, 0.125, 0.072], [0, -0.062, 0], [0.06, 0, 0])
  for (let i = 0; i < 3; i++) box(mag, body, [0.031, 0.004, 0.074], [0, -0.03 - i * 0.03, 0.002 * i], [0.06, 0, 0])
  box(mag, M.black, [0.032, 0.01, 0.078], [0, -0.128, -0.008], [0.06, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.03, -0.32), dir: V(0, 0, -1) },
    muzzle: V(0, 0.08, -0.815), eject: V(0.028, 0.088, -0.03), mag, handguardR: 0.03, scope: true,
  }
}

/* ---------------------------------------------------------------- SMGs --- */

/* The MAC-10: a boxy stamped receiver with a ridge down the top, loop
   sights front and back, the cocking knob on top, a threaded barrel stub,
   the magazine up through the grip, a sling hanging from the front, and the
   wire stock folded short behind. */
function mac10(g, M) {
  // grip, the magazine inside it
  box(g, M.black, [0.03, 0.12, 0.042], [0, -0.04, 0.0], [-0.12, 0, 0])
  const gripR = { pos: V(0, -0.028, 0.0), dir: V(0, Math.cos(0.12), -Math.sin(0.12)) }
  triggerGuard(g, M.black)
  // receiver, its top ridge, the ejection port on the right
  box(g, M.dark, [0.05, 0.08, 0.24], [0, 0.055, -0.05])
  box(g, M.dark, [0.03, 0.01, 0.22], [0, 0.1, -0.05])
  box(g, M.black, [0.003, 0.02, 0.06], [0.026, 0.07, -0.06])
  for (const s2 of [-1, 1]) box(g, M.black, [0.002, 0.004, 0.2], [s2 * 0.0255, 0.035, -0.05])
  // cocking knob on top
  box(g, M.black, [0.014, 0.014, 0.02], [0, 0.112, -0.07])
  // loop sights, rear and front
  for (const z of [0.05, -0.15]) {
    for (const s2 of [-1, 1]) box(g, M.black, [0.004, 0.02, 0.012], [s2 * 0.009, 0.115, z])
    box(g, M.black, [0.022, 0.004, 0.012], [0, 0.126, z])
  }
  // threaded barrel stub and its cap
  cyl(g, M.steel, 0.012, 0.08, [0, 0.07, -0.21])
  cyl(g, M.black, 0.015, 0.035, [0, 0.07, -0.265])
  // sling loop at the front, the strap hanging from it
  box(g, M.black, [0.03, 0.012, 0.022], [0, 0.012, -0.16])
  // its top end at the loop, swinging back a little
  box(g, M.black, [0.005, 0.09, 0.022], [0, -0.027, -0.1446], [-0.35, 0, 0])
  // wire stock folded short behind: two rods and the butt plate
  for (const y of [0.025, 0.085]) box(g, M.black, [0.008, 0.008, 0.14], [0.022, y, 0.135])
  box(g, M.black, [0.05, 0.075, 0.01], [0, 0.055, 0.205])
  const mag = new THREE.Group()
  mag.position.set(0, -0.1, 0.015)
  box(mag, M.dark, [0.026, 0.11, 0.036], [0, -0.03, 0], [-0.12, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.01, -0.12), dir: V(0, 0, -1) },
    muzzle: V(0, 0.07, -0.285), eject: V(0.028, 0.08, -0.04), mag, handguardR: 0.028,
    sight: { rear: V(0, 0.13, 0.05), front: V(0, 0.13, -0.15) },
  }
}

/* The MP9: a compact polymer receiver, ribbed down the sides with a rail on
   top, the stubby barrel shroud out front, a ribbed vertical foregrip, the
   long magazine running up through the pistol grip, and the thin folding
   stock out behind with its narrow butt plate. */
function mp9(g, M) {
  // pistol grip with grooves; the magazine runs up through it
  box(g, M.polymer, [0.032, 0.12, 0.046], [0, -0.04, 0.0], [-0.2, 0, 0])
  for (let i = 0; i < 4; i++) box(g, M.black, [0.034, 0.005, 0.048], [0, -0.012 - i * 0.022, 0.006 - i * 0.0045], [-0.2, 0, 0])
  const gripR = { pos: V(0, -0.028, 0.0), dir: V(0, Math.cos(0.2), -Math.sin(0.2)) }
  // a big trigger guard joined to the foregrip
  box(g, M.polymer, [0.01, 0.008, 0.11], [0, -0.025, -0.07])
  box(g, M.polymer, [0.01, 0.034, 0.008], [0, -0.008, -0.03])
  box(g, M.black, [0.004, 0.018, 0.004], [0, 0.005, -0.04], [0.3, 0, 0])
  // receiver: one slab, its nose stepped down over the barrel shroud
  profile(g, M.polymer, [
    [0.07, 0.016], [0.07, 0.09], [0.055, 0.098], [-0.19, 0.098], [-0.2, 0.085],
    [-0.2, 0.03], [-0.17, 0.016],
  ], 0.046)
  for (let i = 0; i < 4; i++) for (const s2 of [-1, 1]) box(g, M.black, [0.003, 0.004, 0.17], [s2 * 0.024, 0.04 + i * 0.012, -0.07])
  // rail along the top
  box(g, M.black, [0.022, 0.008, 0.24], [0, 0.103, -0.07])
  for (let i = 0; i < 10; i++) box(g, M.black, [0.024, 0.005, 0.009], [0, 0.109, 0.04 - i * 0.022])
  // cocking handle at the back
  box(g, M.black, [0.03, 0.012, 0.02], [0, 0.1, 0.055])
  // ribbed vertical foregrip
  cylY(g, M.polymer, 0.016, 0.08, [0, -0.02, -0.15], [-0.1, 0, 0])
  for (let i = 0; i < 4; i++) cylY(g, M.black, 0.0168, 0.004, [0, -0.002 - i * 0.017, -0.148 + i * 0.0017], [-0.1, 0, 0])
  ball(g, M.polymer, 0.016, [0, -0.06, -0.146], [1, 0.5, 1])
  // barrel shroud and muzzle
  cyl(g, M.dark, 0.016, 0.05, [0, 0.055, -0.22])
  cyl(g, M.black, 0.012, 0.03, [0, 0.055, -0.255])
  // folding stock, extended: two thin bars back to a narrow butt plate
  for (const yy of [0.085, 0.04]) box(g, M.black, [0.012, 0.01, 0.26], [0, yy, 0.2])
  box(g, M.black, [0.02, 0.12, 0.014], [0, 0.04, 0.33], [-0.08, 0, 0])
  // the long magazine
  const mag = new THREE.Group()
  mag.position.set(0, -0.1, 0.02)
  box(mag, M.dark, [0.024, 0.14, 0.034], [0, -0.04, 0], [-0.2, 0, 0])
  for (let i = 0; i < 3; i++) box(mag, M.black, [0.026, 0.005, 0.036], [0, -0.02 - i * 0.03, 0.004 + i * 0.006], [-0.2, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, -0.02, -0.15), dir: V(0, Math.cos(0.1), -Math.sin(0.1)) }, gripLVertical: true,
    muzzle: V(0, 0.055, -0.27), eject: V(0.024, 0.07, -0.04), mag, handguardR: 0.02,
    sight: { rear: V(0, 0.115, 0.03), front: V(0, 0.115, -0.17) },
  }
}

/* The UMP-45: a long slab-sided polymer receiver with a rail along the top,
   the hooded front sight and the cocking tube at the front, short rails on
   the handguard with a vertical foregrip under it, a long straight 25-round
   box ahead of the trigger group, and the skeleton stock folded out. */
function ump(g, M) {
  const gripR = pistolGrip(g, M.polymer)
  triggerGuard(g, M.black)
  // receiver: one slab from the stock hinge to the front, stepped under the handguard
  profile(g, M.polymer, [
    [0.06, 0.004], [0.06, 0.1], [-0.35, 0.1], [-0.37, 0.088], [-0.37, 0.03],
    [-0.2, 0.018], [-0.16, 0.0], [-0.08, 0.0],
  ], 0.05)
  // trigger group and magwell
  box(g, M.polymer, [0.046, 0.026, 0.13], [0, -0.004, 0.0])
  box(g, M.polymer, [0.046, 0.028, 0.07], [0, -0.006, -0.12])
  cyl(g, M.black, 0.005, 0.05, [0, 0.03, 0.035], [0, Math.PI / 2, 0])        // selector
  cyl(g, M.black, 0.004, 0.052, [0, 0.012, -0.07], [0, Math.PI / 2, 0])      // pin
  // top rail with its slots, rear sight, hooded front sight
  box(g, M.black, [0.026, 0.008, 0.3], [0, 0.104, -0.13])
  for (let i = 0; i < 13; i++) box(g, M.black, [0.028, 0.005, 0.01], [0, 0.11, 0.0 - i * 0.022])
  box(g, M.black, [0.03, 0.022, 0.022], [0, 0.115, 0.035])
  box(g, M.black, [0.034, 0.035, 0.026], [0, 0.11, -0.355])
  // handguard side and bottom rails
  for (const s2 of [-1, 1]) {
    box(g, M.black, [0.006, 0.02, 0.11], [s2 * 0.027, 0.06, -0.29])
    for (let i = 0; i < 5; i++) box(g, M.black, [0.008, 0.022, 0.008], [s2 * 0.028, 0.06, -0.245 - i * 0.022])
  }
  // cocking tube and handle (left, at the front)
  cyl(g, M.black, 0.01, 0.06, [-0.02, 0.085, -0.33])
  box(g, M.black, [0.02, 0.01, 0.012], [-0.034, 0.085, -0.3])
  // vertical foregrip
  cylY(g, M.black, 0.014, 0.09, [0, -0.025, -0.28])
  for (let i = 0; i < 4; i++) cylY(g, M.dark, 0.0155, 0.006, [0, -0.005 - i * 0.02, -0.28])
  box(g, M.black, [0.022, 0.012, 0.04], [0, 0.022, -0.28])
  // barrel stub and muzzle
  cyl(g, M.steel, 0.011, 0.05, [0, 0.066, -0.395])
  cyl(g, M.black, 0.014, 0.02, [0, 0.066, -0.42])
  // skeleton stock, folded out
  const hole = new THREE.Path()
  hole.moveTo(0.14, 0.05); hole.lineTo(0.26, 0.045); hole.lineTo(0.27, -0.025); hole.lineTo(0.2, 0.0)
  hole.closePath()
  box(g, M.black, [0.05, 0.05, 0.02], [0, 0.07, 0.07])
  profile(g, M.polymer, [
    [0.08, 0.06], [0.08, 0.095], [0.29, 0.075], [0.3, -0.045], [0.28, -0.055],
    [0.26, -0.045], [0.16, 0.025], [0.08, 0.035],
  ], 0.03, [hole])
  box(g, M.rubber, [0.034, 0.13, 0.012], [0, 0.015, 0.302])
  // straight 25-round box
  const mag = new THREE.Group()
  mag.position.set(0, -0.01, -0.12)
  box(mag, M.dark, [0.026, 0.19, 0.05], [0, -0.095, -0.004], [0.05, 0, 0])
  box(mag, M.black, [0.03, 0.012, 0.056], [0, -0.19, -0.009], [0.05, 0, 0])
  g.add(mag)
  return {
    gripR, gripL: { pos: V(0, 0.018, -0.26), dir: V(0, 0, -1) },
    muzzle: V(0, 0.066, -0.43), eject: V(0.026, 0.075, -0.05), mag, handguardR: 0.028,
    sight: { rear: V(0, 0.126, 0.035), front: V(0, 0.128, -0.355) },
  }
}

/* The FN P90: a bullpup traced off a side photo. One polymer body with the
   support-hand hook and two openings (trigger and thumbhole), the clear
   magazine lying on top, and the sight housing arching over the front. */
function p90(g, M) {
  const k = 0.00052                                        // metres per photo pixel
  const P = (x, y) => [(x - 430) * k, (262 - y) * k]      // photo -> [z, y]
  const hole = (cx, cy, rx, ry) => {
    const [z, y] = P(cx, cy)
    const h = new THREE.Path(); h.absellipse(z, y, rx * k, ry * k, 0, Math.PI * 2, true)
    return h
  }
  profile(g, M.polymer, [
    P(125, 238), P(400, 238), P(412, 205), P(730, 205), P(746, 147), P(988, 145), P(1003, 168),
    P(1001, 352), P(772, 356), P(700, 336), P(630, 350), P(600, 396), P(470, 404), P(335, 410),
    P(262, 392), P(228, 350), P(210, 330), P(160, 332), P(128, 300),
  ], 0.056, [hole(322, 302, 40, 38), hole(548, 300, 74, 44)])
  box(g, M.dark, [0.057, 0.11, 0.009], [0, P(0, 250)[1], P(997, 0)[0]])  // butt plate
  box(g, M.black, [0.004, 0.012, 0.02], [0, P(0, 318)[1], P(372, 0)[0]], [0.3, 0, 0])  // trigger
  // the sight housing: an upright at the front and a bridge carrying the rail
  const [zf] = P(162, 0), [zb] = P(420, 0)
  box(g, M.black, [0.05, (240 - 45) * k, (195 - 130) * k], [0, P(0, 142)[1], zf])
  box(g, M.black, [0.05, (100 - 45) * k, (470 - 130) * k], [0, P(0, 72)[1], (zf + zb) / 2 + 0.01])
  for (let i = 0; i < 6; i++) box(g, M.dark, [0.03, 0.005, 0.012], [0, P(0, 44)[1], P(205 + i * 30, 0)[0]])
  // the housing's rear legs: thin plates either side of the magazine, not
  // a block through it (the clear magazine would show it inside)
  // long enough to sink into the bridge above and the body below, so no gap shows
  for (const sx of [-1, 1]) box(g, M.black, [0.005, 0.088, 0.02], [sx * 0.0265, P(0, 150)[1], P(425, 0)[0]], [-0.62, 0, 0])
  // the clear magazine on top, cartridges showing through, and its latch
  const clear = new THREE.MeshStandardMaterial({ color: '#4a3524', transparent: true, opacity: 0.72, metalness: 0.1, roughness: 0.12, depthWrite: false })
  box(g, clear, [0.046, (192 - 133) * k, (730 - 195) * k], [0, P(0, 162)[1], P(462, 0)[0]])
  box(g, M.orange, [0.02, 0.012, (700 - 230) * k], [0, P(0, 165)[1], P(465, 0)[0]])
  box(g, M.black, [0.03, 0.018, 0.028], [0, P(0, 170)[1], P(752, 0)[0]])
  // barrel collar, flash hider, charging handle
  const [zm, yb] = P(45, 213)
  cyl(g, M.dark, 0.0095, (135 - 95) * k, [0, yb, P(115, 0)[0]])
  cyl(g, M.black, 0.0068, (100 - 45) * k, [0, yb, P(72, 0)[0]])
  cyl(g, M.steel, 0.006, 0.02, [0.03, P(0, 222)[1], P(190, 0)[0]], [0, Math.PI / 2, 0])
  return {
    gripR: { pos: V(0, P(0, 330)[1], P(425, 0)[0]), dir: V(0, Math.cos(0.22), -Math.sin(0.22)) },
    gripL: { pos: V(0, P(0, 292)[1], P(232, 0)[0]), dir: V(0, 0, -1) },
    muzzle: V(0, yb, zm), eject: V(0, -0.05, 0.12), mag: null, handguardR: 0.028,
    // no iron sights to line up: look along the top of the rail
    sight: { rear: V(0, P(0, 36)[1], P(470, 0)[0]), front: V(0, P(0, 36)[1], P(150, 0)[0]) },
  }
}

/* ------------------------------------------------------------- pistols --- */

function pistol(g, M, kind) {
  const big = kind === 'deagle'
  const slideMat = kind === 'deagle' ? M.chrome : kind === 'p250' ? M.steel : M.black
  const frameMat = kind === 'usp' || kind === 'glock' ? M.polymer : M.black
  const len = big ? 0.25 : kind === 'usp' ? 0.19 : 0.18
  const h = big ? 0.045 : 0.033
  // frame and grip as one piece (a raked grip box under a frame box left its
  // corner poking into the trigger guard): dust cover, grip, beavertail
  const F = -len * 0.8 + 0.02, drop = big ? 0.01 : 0
  profile(g, frameMat, [
    [0.034, 0.0405], [F, 0.0405], [F, 0.016], [-0.026, 0.016],
    [0.0048, -0.0846 - drop], [0.0488, -0.071 - drop], [0.022, 0.018], [0.034, 0.026],
  ], big ? 0.034 : 0.028)
  const gripR = { pos: V(0, -0.025, 0.012), dir: V(0, Math.cos(0.3), -Math.sin(0.3)) }
  // trigger guard loop, joined to the frame in front and the grip behind
  box(g, frameMat, [0.008, 0.006, 0.058], [0, -0.012, -0.041])
  box(g, frameMat, [0.008, 0.03, 0.006], [0, 0.002, -0.069])
  box(g, M.black, [0.004, 0.02, 0.005], [0, 0.004, -0.04], [0.35, 0, 0])           // trigger
  const slide = new THREE.Group()
  box(slide, slideMat, [big ? 0.034 : 0.027, h, len], [0, 0.04 + h / 2 + 0.002, -len / 2 + 0.04])
  box(slide, M.black, [0.006, 0.008, 0.008], [0, 0.04 + h + 0.006, -len + 0.05])  // front sight
  box(slide, M.black, [0.016, 0.008, 0.008], [0, 0.04 + h + 0.006, 0.03])        // rear sight
  if (big) box(slide, M.dark, [0.02, 0.012, len], [0, 0.04 + h + 0.004, -len / 2 + 0.04])
  g.add(slide)
  if (kind === 'usp') cyl(g, M.dark, 0.016, 0.16, [0, 0.055, -len - 0.04])
  const mag = new THREE.Group()
  mag.position.set(0, -0.085 - drop, 0.03)
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
  if (kind === 'molotov') {
    // a bottle with a burning rag in the neck
    const glass = new THREE.MeshStandardMaterial({ color: '#6b8f3a', transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.1 })
    cylY(g, glass, 0.028, 0.1, [0, -0.01, 0])
    cylY(g, glass, 0.011, 0.05, [0, 0.065, 0])
    cylY(g, M.tan, 0.009, 0.04, [0, 0.1, 0])
    ball(g, M.orange, 0.012, [0, 0.12, 0], [1, 1.4, 1])
  } else if (kind === 'incgrenade') {
    cylY(g, M.red, 0.026, 0.11, [0, 0.0, 0])
    cylY(g, M.dark, 0.014, 0.03, [0, 0.07, 0])
    box(g, M.steel, [0.01, 0.08, 0.004], [0.024, 0.02, 0], [0, 0, 0.12])
    ball(g, M.steel, 0.012, [0, 0.09, 0.01], [1, 1, 0.2])
    cylY(g, M.black, 0.027, 0.012, [0, 0.02, 0])
  } else if (kind === 'he') {
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
  ssg08,
  g3sg1,
  scar20,
  mac10, mp9, ump, p90,
  glock: (g, M) => pistol(g, M, 'glock'),
  usp: (g, M) => pistol(g, M, 'usp'),
  p250: (g, M) => pistol(g, M, 'p250'),
  deagle: (g, M) => pistol(g, M, 'deagle'),
  he: (g, M) => grenade(g, M, 'he'),
  flash: (g, M) => grenade(g, M, 'flash'),
  smoke: (g, M) => grenade(g, M, 'smoke'),
  molotov: (g, M) => grenade(g, M, 'molotov'),
  incgrenade: (g, M) => grenade(g, M, 'incgrenade'),
  c4,
}

/** Build a weapon model. Returns { group, ...anchors }. */
/** Build a weapon model, optionally wearing a skin (see skins/catalog.js). */
/* The eye goes on the line through `sight.rear` and `sight.front`. Hand-placed
   points can sit a hair inside a sight block or under a gas tube, and then the
   gun fills the screen when aiming. Raise the line until nothing on the gun
   along it (within a narrow band either side of centre) pokes above it. */
function clearSightLine(g, sight) {
  g.updateMatrixWorld(true)
  const { rear, front } = sight
  const len = rear.z - front.z
  if (!(len > 0)) return
  let lift = 0
  const v = new THREE.Vector3()
  g.traverse(o => {
    if (!o.isMesh) return
    const pos = o.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
      if (Math.abs(v.x) > 0.012 || v.z > rear.z + 0.03 || v.z < front.z - 0.01) continue
      // the line's height here (held level past the rear sight, where the eye is)
      const t = Math.min(1, Math.max(0, (rear.z - v.z) / len))
      const y = rear.y + (front.y - rear.y) * t
      lift = Math.max(lift, v.y - y)
    }
  })
  if (lift > 0) { rear.y += lift + 0.002; front.y += lift + 0.002 }
}

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
    // `slideOnly`: just the slide wears the finish, the frame stays stock
    // (the Glock's Gamma Doppler)
    if (skin.slideOnly && info.slide) info.slide.traverse(o => { if (o.isMesh) parts.push(o) })
    else g.traverse(o => { if (o.isMesh && paintable.has(o.material)) parts.push(o) })
    paintMeshes(g, parts, skin, 'z')
  }
  if (info.sight) clearSightLine(g, info.sight)
  if (info.mag) info.magRest = { pos: info.mag.position.clone(), rot: info.mag.rotation.clone() }
  return { group: g, id, ...info }
}

export const GUN_IDS = Object.keys(BUILDERS)
