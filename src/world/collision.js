import * as THREE from 'three'
import { level } from './level'
import { SURFACES } from './mapData'

/* World queries against the real map's triangles through a BVH.

   Players are boxes (Source hulls are boxes too). A hull test starts SKIN above
   the feet, so anything lower than that — a kerb, a ramp's rise over one tick —
   is walked onto by the ground snap rather than stopping you dead. */

// close to a full step (MOVE.step 0.467): steep stairs (the Warehouse's
// metal flights, 19 cm risers on 30 cm treads) put the next treads inside a
// standing hull's footprint well above 0.2 m, which stopped you dead on them
const SKIN = 0.42
const IDENTITY = new THREE.Matrix4()
const _box = new THREE.Box3()
const _ray = new THREE.Ray()
const _sphere = new THREE.Sphere()
const DOWN = new THREE.Vector3(0, -1, 0)
const UP = new THREE.Vector3(0, 1, 0)

/** Does a hull (feet at y, half-width r, height h) intersect the map? */
export function hullBlocked(x, y, z, r, h, skin = SKIN) {
  if (!level.bvh) return false
  _box.min.set(x - r, y + skin, z - r)
  _box.max.set(x + r, y + h, z + r)
  if (_box.max.y <= _box.min.y) return false
  return level.bvh.intersectsBox(_box, IDENTITY)
}

/** Does a sphere touch the map? (grenades) */
export function sphereHits(x, y, z, r) {
  if (!level.bvh) return false
  _sphere.center.set(x, y, z)
  _sphere.radius = r
  return level.bvh.intersectsSphere(_sphere)
}

// centre, corners, and a line of probes along each axis (spaced closer than
// a stair tread, so a row of them can't all drop through the gaps)
const FOOT = [[0, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
  [0.95, 0], [-0.95, 0], [0, 0.95], [0, -0.95], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]

/** First upward-facing surface below `fromY` along a vertical line, or -Infinity. */
function floorBelow(x, z, fromY) {
  _ray.origin.set(x, fromY + 0.001, z)
  _ray.direction.copy(DOWN)
  const hits = level.bvh.raycast(_ray, THREE.DoubleSide, 0, 60)
  let best = -Infinity
  for (const h of hits) {
    if (h.face.normal.y < 0.25) continue
    if (h.point.y > best) best = h.point.y
  }
  return best
}

// a denser 5 x 5 net, for when the five probes disagree
const FOOT_FINE = []
for (const ox of [-0.95, -0.5, 0, 0.5, 0.95]) for (const oz of [-0.95, -0.5, 0, 0.5, 0.95]) FOOT_FINE.push([ox, oz])

/** Highest floor under the hull's footprint no higher than `maxY`. */
export function groundHeight(x, z, r, maxY) {
  if (!level.bvh) return 0
  let g = -Infinity, lo = Infinity
  for (const [ox, oz] of FOOT) {
    const y = floorBelow(x + ox * r, z + oz * r, maxY)
    if (y > g) g = y
    if (y < lo) lo = y
  }
  // uneven underfoot (open metal stairs: thin treads with gaps between
  // them, the Warehouse's flights): five probes can all fall through the
  // gaps and miss the tread the hull is really standing on, which leaves
  // the hull sunk into that tread and stuck. Look closer.
  if (g - lo > 0.05) {
    for (const [ox, oz] of FOOT_FINE) {
      const y = floorBelow(x + ox * r, z + oz * r, maxY)
      if (y > g) g = y
    }
  }
  return g === -Infinity ? level.bounds.min.y - 50 : g
}

/** Lowest ceiling above `y` over the footprint (Infinity if open sky). */
export function ceilingHeight(x, z, r, y) {
  if (!level.bvh) return Infinity
  let c = Infinity
  for (const [ox, oz] of FOOT) {
    _ray.origin.set(x + ox * r, y - 0.001, z + oz * r)
    _ray.direction.copy(UP)
    const h = level.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, 40)
    if (h && h.point.y < c) c = h.point.y
  }
  return c
}

/* ------------------------------------------------------------------ rays --- */

const matOf = n => (n.y > 0.7 ? 'sand' : 'wall')
/* What a hit face is made of, for bullet penetration: the map's per-vertex
   `surface` code when it has one, else plain wall. */
function surfaceOf(h) {
  const attr = level.geometry?.attributes.surface, idx = level.geometry?.index
  if (!attr || !idx || h.faceIndex == null) return 'wall'
  return SURFACES[attr.getX(idx.getX(h.faceIndex * 3))] || 'wall'
}

function toRay(o, d) {
  _ray.origin.set(o.x, o.y, o.z)
  _ray.direction.set(d.x, d.y, d.z)
  return _ray
}

/** Nearest hit, or null. { t, normal:[x,y,z], box, mat } */
export function raycast(o, d, maxDist) {
  if (!level.bvh) return null
  const h = level.bvh.raycastFirst(toRay(o, d), THREE.DoubleSide, 0, maxDist)
  if (!h) return null
  const n = h.face.normal.clone()
  if (n.dot(_ray.direction) > 0) n.negate()
  return { t: h.distance, normal: [n.x, n.y, n.z], box: true, mat: matOf(n) }
}

/**
 * Every solid the ray passes through, sorted, with entry/exit distances — a
 * face turned toward the ray opens a solid, the next face turned away closes
 * it. Thin one-sided props never close, so they stop bullets outright.
 */
export function rayAll(o, d, maxDist) {
  if (!level.bvh) return []
  const ray = toRay(o, d)
  const hits = level.bvh.raycast(ray, THREE.DoubleSide, 0, maxDist + 3)
  hits.sort((a, b) => a.distance - b.distance)
  const out = []
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]
    if (h.distance > maxDist) break
    const n = h.face.normal
    if (n.dot(ray.direction) > 0) continue          // an exit with no entry: we started inside
    let tOut = Infinity
    for (let k = i + 1; k < hits.length; k++) {
      if (hits[k].face.normal.dot(ray.direction) > 0) { tOut = hits[k].distance; i = k; break }
    }
    out.push({ t: h.distance, tOut, normal: [n.x, n.y, n.z], box: true, mat: matOf(n), surface: surfaceOf(h) })
  }
  return out
}

/** Clear line between two points (world geometry only). */
export function lineClear(ax, ay, az, bx, by, bz) {
  if (!level.bvh) return true
  const dx = bx - ax, dy = by - ay, dz = bz - az
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-6) return true
  _ray.origin.set(ax, ay, az)
  _ray.direction.set(dx / len, dy / len, dz / len)
  const h = level.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, len - 1e-3)
  return !h
}
