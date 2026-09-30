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

  karambit(g) {
    const s = new THREE.Shape()
    s.moveTo(0.012, 0.028)
    s.quadraticCurveTo(0.036, 0.12, -0.048, 0.185)          // spine sweeps round to the talon tip
    s.quadraticCurveTo(-0.004, 0.112, -0.012, 0.028)        // edge hooks back inside the curve
    s.closePath()
    const b = new THREE.Mesh(blade(s), steel())
    g.add(b)
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.12, 0.017, 3, 0.007), handleMat('#1e1f22'))
    h.position.y = -0.032
    g.add(h)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0055, 12, 32), steel())
    ring.position.y = -0.112
    g.add(ring)
    for (const y of [-0.06, -0.02]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 10).rotateX(Math.PI / 2), steel())
      pin.position.y = y; g.add(pin)
    }
    return [b]
  },

  flip(g) {
    const s = new THREE.Shape()
    s.moveTo(-0.013, 0.03)
    s.lineTo(0.013, 0.03)
    s.lineTo(0.013, 0.16)                                   // straight spine
    s.quadraticCurveTo(0.012, 0.19, 0.004, 0.215)            // dropping to the point
    s.quadraticCurveTo(-0.016, 0.16, -0.013, 0.03)           // full belly back down
    const b = new THREE.Mesh(blade(s, 0.0045), steel())
    g.add(b)
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.13, 0.016, 3, 0.006), handleMat('#232426'))
    h.position.y = -0.035
    g.add(h)
    const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.02, 0.018, 2, 0.004), steel())
    bolster.position.y = 0.025
    g.add(bolster)
    const flipper = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 16).rotateX(Math.PI / 2), steel())
    flipper.position.set(-0.016, 0.034, 0)
    g.add(flipper)
    return [b]
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
