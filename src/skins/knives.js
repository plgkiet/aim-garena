import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { paintMeshes } from './apply'

/* The knives that have no model file — Karambit, Flip, Huntsman — built from
   shapes in the frame the viewmodel expects of every knife: blade up +Y, the
   grip's centre on the origin, the blade's width across X and its flat facing
   Z. The finish is painted onto the blade only; handles keep their own look. */

const steel = () => new THREE.MeshStandardMaterial({ color: '#c9d0d8', metalness: 0.95, roughness: 0.22 })
const handleMat = c => new THREE.MeshStandardMaterial({ color: c, metalness: 0.1, roughness: 0.6 })

function blade(shape, thick = 0.004) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 24 })
  g.translate(0, 0, -thick / 2)
  return g
}

const BUILD = {
  /* The stock knife everyone starts with, like CS:GO's default: a plain
     gunmetal clip-point blade on a black rubber grip. */
  default(g) {
    const s = new THREE.Shape()
    s.moveTo(-0.014, 0.03)
    s.lineTo(0.014, 0.03)
    s.lineTo(0.014, 0.15)
    s.lineTo(0.004, 0.185)
    s.quadraticCurveTo(0.0, 0.205, -0.002, 0.21)
    s.quadraticCurveTo(-0.018, 0.15, -0.014, 0.03)
    const b = new THREE.Mesh(blade(s, 0.0045), new THREE.MeshStandardMaterial({ color: '#5d636b', metalness: 0.85, roughness: 0.38 }))
    g.add(b)
    const guard = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.01, 0.018, 2, 0.004), handleMat('#1a1b1d'))
    guard.position.y = 0.026
    g.add(guard)
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.028, 0.12, 0.02, 3, 0.008), handleMat('#161719'))
    h.position.y = -0.035
    g.add(h)
    for (let i = 0; i < 3; i++) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0022, 6, 16).rotateX(Math.PI / 2), handleMat('#0e0f10'))
      groove.position.y = -0.005 - i * 0.026; groove.scale.set(1.2, 1, 0.85); g.add(groove)
    }
    return [b]
  },

  /* Karambit: a broad crescent blade sweeping forward to a hooked point, a
     black handle curving with it (a guard lug up top, finger grooves along
     the inside, an inset plate held by two screws) and the finger ring at
     the butt, finished like the blade, as the CS karambit is. */
  karambit(g) {
    const s = new THREE.Shape()
    s.moveTo(0.019, 0.03)
    s.bezierCurveTo(0.036, 0.11, 0.012, 0.19, -0.078, 0.205)   // the spine arcs over to the hook
    s.bezierCurveTo(-0.03, 0.17, -0.012, 0.11, -0.017, 0.03)   // the edge, hollow inside the curve
    s.closePath()
    const b = new THREE.Mesh(blade(s, 0.0042), steel())
    g.add(b)
    // handle: its back is smooth, its inside grooved for the fingers
    const hs = new THREE.Shape()
    hs.moveTo(-0.021, 0.034)
    hs.lineTo(0.024, 0.036)
    hs.quadraticCurveTo(0.032, 0.0, 0.026, -0.05)
    hs.quadraticCurveTo(0.022, -0.085, 0.012, -0.1)
    hs.lineTo(-0.006, -0.098)
    for (let i = 0; i < 3; i++) {                               // three finger grooves, bottom up
      const y = -0.085 + i * 0.03
      hs.quadraticCurveTo(-0.019 - i * 0.002, y + 0.008, -0.012 - i * 0.002, y + 0.016)
      hs.quadraticCurveTo(-0.022 - i * 0.002, y + 0.022, -0.016 - i * 0.002, y + 0.03)
    }
    hs.quadraticCurveTo(-0.03, 0.022, -0.021, 0.034)           // the guard lug
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.017, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 12 })
    hg.translate(0, 0, -0.0085)
    const h = new THREE.Mesh(hg, handleMat('#141518'))
    g.add(h)
    // the inset plate and its two screws, both faces
    for (const z of [-0.0115, 0.0115]) {
      const plate = new THREE.Mesh(new RoundedBoxGeometry(0.009, 0.07, 0.002, 1, 0.001), handleMat('#08090a'))
      plate.position.set(0.012, -0.03, z); plate.rotation.z = 0.08; g.add(plate)
      for (const y of [-0.004, -0.056]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.003, 12).rotateX(Math.PI / 2), steel())
        screw.position.set(0.012 - y * 0.08, y, z * 1.08); g.add(screw)
      }
    }
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.022, 10).rotateX(Math.PI / 2), handleMat('#c8121b'))
    pivot.position.set(-0.006, 0.04, 0)
    g.add(pivot)
    // the finger ring, a flat loop off the butt
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0065, 14, 36), steel())
    ring.scale.set(1, 1, 1.4)
    ring.position.set(0.004, -0.122, 0)
    g.add(ring)
    return [b, ring]
  },

  /* Flip knife: an upswept blade whose point lifts toward the spine, a full
     belly with serrations at its heel, a pivot screw and flipper; a black G10
     handle with finger grooves on the edge side, a butt that hooks back toward
     the spine, a pocket clip, the red release button and lock slot, and the
     backspacer at the butt in the blade's finish. */
  flip(g) {
    const s = new THREE.Shape()
    s.moveTo(0.016, 0.03)
    s.quadraticCurveTo(0.005, 0.17, 0.034, 0.252)            // the spine, dished, lifting to the point
    s.quadraticCurveTo(-0.022, 0.19, -0.021, 0.098)          // the belly
    for (let i = 0; i < 5; i++) {                            // serrations at the heel
      const y = 0.093 - i * 0.0095
      s.lineTo(-0.0165, y - 0.0035)
      s.lineTo(-0.021, y - 0.0095)
    }
    s.lineTo(-0.016, 0.03)
    s.closePath()
    const b = new THREE.Mesh(blade(s, 0.0042), steel())
    g.add(b)
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.009, 14).rotateX(Math.PI / 2), handleMat('#b8161c'))
    pivot.position.set(0.003, 0.04, 0)
    g.add(pivot)
    const flipper = new THREE.Mesh(new RoundedBoxGeometry(0.009, 0.01, 0.004, 1, 0.002), steel())
    flipper.position.set(-0.021, 0.034, 0)
    g.add(flipper)
    // G10 handle: grooved on the edge side, hooking back at the butt
    const hs = new THREE.Shape()
    hs.moveTo(-0.019, 0.033)
    hs.lineTo(0.02, 0.036)
    hs.quadraticCurveTo(0.023, -0.02, 0.02, -0.058)
    hs.quadraticCurveTo(0.024, -0.098, 0.036, -0.114)        // the butt hooks toward the spine
    hs.quadraticCurveTo(0.028, -0.128, 0.012, -0.124)
    hs.quadraticCurveTo(-0.004, -0.11, -0.011, -0.09)
    for (let i = 0; i < 3; i++) {                            // finger grooves, bottom up
      const y = -0.088 + i * 0.03
      hs.quadraticCurveTo(-0.012, y + 0.012, -0.018, y + 0.018)
      hs.quadraticCurveTo(-0.014, y + 0.024, -0.017, y + 0.03)
    }
    hs.lineTo(-0.019, 0.033)
    const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 12 })
    hg.translate(0, 0, -0.008)
    const h = new THREE.Mesh(hg, handleMat('#131416'))
    g.add(h)
    // the backspacer at the butt, painted with the blade
    const spacer = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.07, 0.009, 2, 0.002), steel())
    spacer.position.set(0.024, -0.078, 0); spacer.rotation.z = 0.2
    g.add(spacer)
    // pocket clip, release button, lock slot, screws
    const clip = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.05, 0.002, 1, 0.001), handleMat('#070708'))
    clip.position.set(0.008, -0.06, 0.0105); clip.rotation.z = -0.35
    g.add(clip)
    for (const y of [-0.04, -0.08]) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.002, 10).rotateX(Math.PI / 2), steel())
      sc.position.set(0.008 - (y + 0.06) * 0.35, y, 0.0118); g.add(sc)
    }
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 16).rotateX(Math.PI / 2), handleMat('#c41a1f'))
    button.position.set(-0.004, 0.005, 0.0098)
    g.add(button)
    const slot = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.014, 0.0015, 1, 0.0007), handleMat('#3a3d42'))
    slot.position.set(0.008, 0.01, 0.0092); slot.rotation.z = -0.5
    g.add(slot)
    // the accents (pivot, flipper, release button) wear the finish too
    return [b, spacer, pivot, flipper, button]
  },

  huntsman(g) {
    const s = new THREE.Shape()
    s.moveTo(-0.017, 0.035)
    s.lineTo(0.017, 0.035)
    s.lineTo(0.017, 0.15)                                   // spine, serrated in paint
    s.lineTo(0.004, 0.195)                                  // the clip
    s.quadraticCurveTo(-0.004, 0.235, -0.006, 0.245)        // point
    s.quadraticCurveTo(-0.022, 0.17, -0.017, 0.035)         // deep belly
    const b = new THREE.Mesh(blade(s, 0.005), steel())
    g.add(b)
    // saw teeth along the spine
    for (let i = 0; i < 9; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.008, 4).rotateZ(-Math.PI / 2), steel())
      t.position.set(0.02, 0.05 + i * 0.011, 0); g.add(t)
    }
    const guard = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.012, 0.02, 2, 0.004), steel())
    guard.position.y = 0.03
    g.add(guard)
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.12, 18), handleMat('#3a2a1c'))
    h.position.y = -0.035
    g.add(h)
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.0165, 0.0025, 8, 24).rotateX(Math.PI / 2), handleMat('#1c140d'))
      rib.position.y = -0.08 + i * 0.022; g.add(rib)
    }
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 10), steel())
    pommel.position.y = -0.1; pommel.scale.y = 0.6
    g.add(pommel)
    return [b]
  },

  /* Skeleton: a double-edged spear-point dagger, a row of lightening holes
     down the middle and a finger hole through the flared guard, the tang
     wrapped in black tape and ending in a teardrop pommel with a lanyard
     hole. Blade and pommel wear the finish, as in CS. */
  skeleton(g) {
    const s = new THREE.Shape()
    s.moveTo(0, 0.24)                                       // the point
    s.quadraticCurveTo(0.012, 0.15, 0.0155, 0.062)          // right edge
    s.lineTo(0.027, 0.04)                                   // guard flare
    s.quadraticCurveTo(0.022, 0.031, 0.016, 0.03)
    s.quadraticCurveTo(0.019, 0.005, 0.006, -0.012)         // round the finger hole to the tang
    s.lineTo(-0.006, -0.012)
    s.quadraticCurveTo(-0.019, 0.005, -0.016, 0.03)
    s.quadraticCurveTo(-0.022, 0.031, -0.027, 0.04)
    s.lineTo(-0.0155, 0.062)
    s.quadraticCurveTo(-0.012, 0.15, 0, 0.24)               // left edge back to the point
    const ring = new THREE.Path(); ring.absarc(0, 0.012, 0.0095, 0, Math.PI * 2, true)
    s.holes.push(ring)
    for (let i = 0; i < 4; i++) {
      const h = new THREE.Path(); h.absarc(0, 0.052 + i * 0.012, 0.0025 + (i === 0 ? 0.0006 : 0), 0, Math.PI * 2, true)
      s.holes.push(h)
    }
    const b = new THREE.Mesh(blade(s, 0.0045), steel())
    g.add(b)
    // the taped tang
    const tape = handleMat('#16171a')
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(new RoundedBoxGeometry(0.019 - i * 0.0006, 0.013, 0.014, 2, 0.004), tape)
      w.position.y = -0.02 - i * 0.0135; w.rotation.z = (i % 2 ? 0.08 : -0.08); g.add(w)
    }
    // teardrop pommel with its lanyard hole
    const ps = new THREE.Shape()
    ps.moveTo(-0.0085, -0.094)
    ps.lineTo(0.0085, -0.094)
    ps.quadraticCurveTo(0.012, -0.118, 0, -0.132)
    ps.quadraticCurveTo(-0.012, -0.118, -0.0085, -0.094)
    const lan = new THREE.Path(); lan.absarc(0, -0.119, 0.0028, 0, Math.PI * 2, true)
    ps.holes.push(lan)
    const pommel = new THREE.Mesh(blade(ps, 0.009), steel())
    g.add(pommel)
    return [b, pommel]
  },

  /* Stiletto: the Italian switchblade: a long, slim bayonet-grind blade with
     a small hole at its heel, a steel bolster with two little quillons, a
     slender steel frame with wood scales, rivets and the release button, and
     a steel end cap. */
  stiletto(g) {
    const s = new THREE.Shape()
    s.moveTo(-0.0075, 0.036)
    s.lineTo(0.0075, 0.036)
    s.lineTo(0.0075, 0.2)                                   // straight spine
    s.lineTo(0.0015, 0.238)                                 // the false edge
    s.lineTo(0, 0.262)                                      // needle point
    s.quadraticCurveTo(-0.008, 0.21, -0.0075, 0.036)        // the edge
    const heel = new THREE.Path(); heel.absarc(0, 0.05, 0.0018, 0, Math.PI * 2, true)
    s.holes.push(heel)
    const b = new THREE.Mesh(blade(s, 0.0038), steel())
    g.add(b)
    const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.024, 0.018, 2, 0.004), steel())
    bolster.position.y = 0.024
    g.add(bolster)
    const quillons = []
    for (const x of [-1, 1]) {                              // the two quillons, curling back
      const q = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0028, 0.016, 10), steel())
      q.position.set(x * 0.017, 0.03, 0); q.rotation.z = x * 1.1; g.add(q)
      const tipq = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 10, 8), steel())
      tipq.position.set(x * 0.024, 0.025, 0); g.add(tipq)
      quillons.push(q, tipq)
    }
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.13, 0.015, 2, 0.003), steel())
    frame.position.y = -0.054
    g.add(frame)
    const wood = handleMat('#4a3322')
    for (const z of [-0.0075, 0.0075]) {
      const scale = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.112, 0.004, 2, 0.0015), wood)
      scale.position.set(0, -0.054, z); g.add(scale)
      for (const y of [-0.012, -0.06, -0.098]) {
        const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0015, 10).rotateX(Math.PI / 2), steel())
        rivet.position.set(0, y, z * 1.32); g.add(rivet)
      }
    }
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 12).rotateX(Math.PI / 2), steel())
    button.position.set(0, -0.032, 0.0105)
    g.add(button)
    const cap = new THREE.Mesh(new RoundedBoxGeometry(0.025, 0.018, 0.017, 2, 0.005), steel())
    cap.position.y = -0.126
    g.add(cap)
    // bolster, quillons and end cap wear the finish with the blade
    return [b, bolster, ...quillons, cap]
  },

  /* Bowie: a big clip-point blade whose edge swells into a belly and dips in
     a recurve toward the guard, a row of saw notches cut along the spine, an
     S-shaped black crossguard, and a ridged black rubber handle flaring into
     its butt cap. */
  bowie(g) {
    const s = new THREE.Shape()
    s.moveTo(0.019, 0.03)
    s.lineTo(0.019, 0.17)                                   // the straight spine
    s.quadraticCurveTo(0.012, 0.225, -0.011, 0.264)         // the clip sweeping to the point
    s.quadraticCurveTo(-0.031, 0.205, -0.024, 0.145)        // the belly
    s.quadraticCurveTo(-0.017, 0.105, -0.025, 0.07)         // the recurve
    s.quadraticCurveTo(-0.028, 0.045, -0.019, 0.03)
    s.closePath()
    // saw notches along the spine: square cut-outs just inside it
    for (let i = 0; i < 9; i++) {
      const n = new THREE.Path()
      const y = 0.052 + i * 0.013
      n.moveTo(0.0125, y); n.lineTo(0.0165, y); n.lineTo(0.0165, y + 0.0055); n.lineTo(0.0125, y + 0.0055); n.closePath()
      s.holes.push(n)
    }
    const b = new THREE.Mesh(blade(s, 0.0055), steel())
    g.add(b)
    const black = handleMat('#101113')
    // S-shaped crossguard: a bar, one end curling up toward the spine side, the other down
    const bar = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.0065, 0.019, 2, 0.002), black)
    bar.position.y = 0.027
    g.add(bar)
    const up = new THREE.Mesh(new RoundedBoxGeometry(0.0065, 0.022, 0.017, 2, 0.002), black)
    up.position.set(0.03, 0.036, 0); up.rotation.z = 0.25
    g.add(up)
    const down = new THREE.Mesh(new RoundedBoxGeometry(0.0065, 0.022, 0.017, 2, 0.002), black)
    down.position.set(-0.03, 0.018, 0); down.rotation.z = 0.25
    g.add(down)
    // handle: a collar, the ridged grip swelling in the middle, the flared butt
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0165, 0.02, 18), black)
    collar.position.y = 0.013
    g.add(collar)
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.0165, 0.085, 20), handleMat('#17181b'))
    grip.position.y = -0.04; grip.scale.set(1, 1, 0.85)
    g.add(grip)
    for (let i = 0; i < 9; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.0163, 0.0014, 6, 22).rotateX(Math.PI / 2), black)
      rib.position.y = -0.004 - i * 0.009; rib.scale.set(1, 1, 0.85); g.add(rib)
    }
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.022, 0.022, 18), black)
    butt.position.set(-0.002, -0.093, 0); butt.scale.set(1.05, 1, 0.85)
    g.add(butt)
    return [b]
  },
}

/** Build a knife model; `finish` is a knife item from the catalog (or null for plain steel). */
export function buildKnifeModel(type, finish = null) {
  const g = new THREE.Group()
  g.name = `knife_${type}`
  const blades = BUILD[type](g)
  if (finish) paintMeshes(g, blades, finish, 'y')
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false } })
  return g
}

export const KNIFE_BUILDERS = Object.keys(BUILD)

/** Repaint the blade of a model knife (Butterfly, M9) with a finish; its
    handles, bolts and screws keep the look baked into the file. */
const GRIP_STEEL = new THREE.MeshStandardMaterial({ color: '#1c1f24', metalness: 0.6, roughness: 0.42 })
export function paintModelBlade(model, finish, bladeTokens = ['blade_'], roll = 0, accentTokens = []) {
  const want = [...bladeTokens, ...accentTokens].map(t => t.toLowerCase())
  const blades = []
  model.traverse(o => {
    if (!o.isMesh) return
    if (want.some(t => o.name.toLowerCase().startsWith(t))) blades.push(o)
    // the file's pink Crimson Web grip inlays would fight any other finish
    else if (/red_grip/i.test(o.name)) o.material = GRIP_STEEL
  })
  // project in the knife frame normalizeKnife set up (blade up +Y, flat on Z,
  // before the in-hand roll), not the file's own axes
  model.updateMatrixWorld(true)
  const frame = new THREE.Matrix4().makeRotationY(roll)
  if (model.parent) frame.premultiply(model.parent.matrixWorld)
  paintMeshes(model, blades, finish, 'y', frame)
}

/** Swap the named parts of a model knife to polished silver (the Butterfly's
    blade bolts ship tinted pink for its Crimson Web, which clashes with the rest). */
const SILVER = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 1, roughness: 0.22 })
export function silverParts(model, tokens) {
  if (!tokens?.length) return
  const want = tokens.map(t => t.toLowerCase())
  model.traverse(o => { if (o.isMesh && want.some(t => o.name.toLowerCase().includes(t))) o.material = SILVER })
}
