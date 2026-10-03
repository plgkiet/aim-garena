import * as THREE from 'three'
import { MOVE } from './constants'
import { hullBlocked } from '../world/collision'
import { level, onLevelChange } from '../world/level'

/* Bot navigation, baked from the map's own triangles once it has loaded.

   A grid over the map where every cell can hold up to LAYERS floors — dust2
   stacks walkable space in places (the CT-side underpass beneath the short
   platform), so one height per cell would lose one of them. A floor counts if
   a standing player fits on it and nothing taller than a stair step stands in
   the way. A* runs over (cell, layer) nodes; neighbours link when their floors
   are within a step of each other. Paths are then string-pulled. */

// a finer grid on the small arena, whose doorways are barely a body wide:
// a cell centre has to land inside a gap for the gap to count
export let NAV_CELL = 0.7
const CELL_FOR = { arena: 0.35 }
const LAYERS = 3
const R = MOVE.radius + 0.05
const STEP = MOVE.step + 0.06
const HEADROOM = 1.75

export const NAV = { ready: false, NX: 0, NZ: 0, x0: 0, z0: 0, H: null, walk: null, toX: null, toZ: null }
let NX = 0, NZ = 0, NN = 0, x0 = 0, z0 = 0
let H = null          // Float32Array(LAYERS * NN), NaN where no floor
let WALK = null       // Uint8Array(LAYERS * NN)
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]
let REGION = null      // Int32Array(LAYERS * NN): connected walkable region per node
let gScore, came, stamp, closed   // A* scratch, sized per map

const toX = i => x0 + (i + 0.5) * NAV_CELL
const toZ = j => z0 + (j + 0.5) * NAV_CELL
const cellOf = (x, z) => [
  Math.max(0, Math.min(NX - 1, Math.floor((x - x0) / NAV_CELL))),
  Math.max(0, Math.min(NZ - 1, Math.floor((z - z0) / NAV_CELL))),
]

function bake() {
  NAV_CELL = CELL_FOR[level.id] ?? 0.7
  const b = level.bounds
  x0 = b.min.x - 1; z0 = b.min.z - 1
  NX = Math.ceil((b.max.x - b.min.x + 2) / NAV_CELL)
  NZ = Math.ceil((b.max.z - b.min.z + 2) / NAV_CELL)
  NN = NX * NZ
  H = new Float32Array(LAYERS * NN).fill(NaN)
  WALK = new Uint8Array(LAYERS * NN)
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0))
  const top = b.max.y + 2
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x = toX(i), z = toZ(j)
      ray.origin.set(x, top, z)
      const hits = level.bvh.raycast(ray, THREE.DoubleSide, 0, top - b.min.y + 5)
      if (!hits.length) continue
      const ys = hits.map(h => h.point.y).sort((a, c) => a - c)
      const floors = hits.filter(h => h.face.normal.y > 0.6).map(h => h.point.y).sort((a, c) => a - c)
      let l = 0
      let last = -Infinity
      for (const f of floors) {
        if (l >= LAYERS) break
        if (f - last < 0.05) continue                      // the same surface twice
        const above = ys.find(y => y > f + 0.05)
        if (above !== undefined && above - f < HEADROOM) continue
        last = f
        const k = l * NN + j * NX + i
        H[k] = f
        // anything taller than a step in the way (a low tread under a staircase,
        // a kerb) makes the cell unwalkable: the hull test's own skin would miss it
        WALK[k] = hullBlocked(x, f, z, R, 1.8, STEP + 0.02) ? 0 : 1
        l++
      }
    }
  }
  labelRegions()
  Object.assign(NAV, { ready: true, NX, NZ, x0, z0, H, walk: WALK, toX, toZ, LAYERS, NN })
}

/* Flood-fill the walkable nodes into connected regions, with the same links
   A* uses, so "is there any path from here to there" is a lookup: a goal in
   a pocket nothing connects to (a crate top, a closed-off room) can be
   skipped instead of planned for and failed. */
function labelRegions() {
  REGION = new Int32Array(LAYERS * NN).fill(-1)
  const stack = []
  let id = 0
  for (let s0 = 0; s0 < LAYERS * NN; s0++) {
    if (WALK[s0] !== 1 || REGION[s0] >= 0) continue
    REGION[s0] = id
    stack.push(s0)
    while (stack.length) {
      const cur = stack.pop()
      const ci = (cur % NN) % NX, cj = ((cur % NN) / NX) | 0
      for (const [di, dj] of DIRS) {
        const n = layerNear(ci + di, cj + dj, H[cur], STEP)
        if (n < 0 || REGION[n] >= 0) continue
        if (di && dj && (layerNear(ci + di, cj, H[cur], STEP) < 0 || layerNear(ci, cj + dj, H[cur], STEP) < 0)) continue
        REGION[n] = id
        stack.push(n)
      }
    }
    id++
  }
}

/** Connected region of the node nearest a point (-1 if none). */
export function regionAt(x, y, z) {
  if (!NAV.ready || !REGION) return -1
  const k = nearestNode(x, y, z)
  return k < 0 ? -1 : REGION[k]
}

onLevelChange(() => {
  const t = performance.now()
  NAV.ready = false
  gScore = null           // grid size changes with the map
  bake()
  NAV.version = (NAV.version || 0) + 1
  if (import.meta.env.DEV) console.info(`nav baked ${NX}x${NZ}x${LAYERS} in ${(performance.now() - t) | 0} ms`)
})

/** Walkable node in cell (i, j) whose floor is nearest to height y (within tol). */
function layerNear(i, j, y, tol) {
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return -1
  let best = -1, bd = tol
  for (let l = 0; l < LAYERS; l++) {
    const k = l * NN + j * NX + i
    if (WALK[k] !== 1) continue
    const d = Math.abs(H[k] - y)
    if (d <= bd) { bd = d; best = k }
  }
  return best
}

/** Nearest walkable node to a world point. Height counts for more than
 *  distance: standing on the floor beside a platform, the floor a cell or
 *  two away is the right node, not the platform top right overhead (taking
 *  that one left bots with no path at all, walking into the platform's side). */
export function nearestNode(x, y, z) {
  const [ci, cj] = cellOf(x, z)
  const rMax = Math.max(10, Math.ceil(3.5 / NAV_CELL))
  let best = -1, bd = Infinity
  for (let r = 0; r <= rMax; r++) {
    // nothing further out can beat what we have
    if (best >= 0 && r * NAV_CELL * 0.6 >= bd) break
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
      if (ci + di < 0 || cj + dj < 0 || ci + di >= NX || cj + dj >= NZ) continue
      for (let l = 0; l < LAYERS; l++) {
        const k = l * NN + (cj + dj) * NX + (ci + di)
        if (WALK[k] !== 1) continue
        const dh = Math.abs(H[k] - y)
        const d = (dh > STEP ? dh * 3 : dh) + Math.hypot(di, dj) * NAV_CELL * 0.6
        if (d < bd) { bd = d; best = k }
      }
    }
  }
  return best
}

/* ------------------------------------------------------------------ A* --- */

class Heap {
  constructor() { this.a = []; this.f = [] }
  push(v, f) {
    const a = this.a, fs = this.f
    a.push(v); fs.push(f)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (fs[p] <= fs[i]) break
      ;[a[p], a[i]] = [a[i], a[p]]; [fs[p], fs[i]] = [fs[i], fs[p]]
      i = p
    }
  }
  pop() {
    const a = this.a, fs = this.f
    const top = a[0]
    const lv = a.pop(), lf = fs.pop()
    if (a.length) {
      a[0] = lv; fs[0] = lf
      let i = 0
      for (;;) {
        const l = i * 2 + 1, r = l + 1
        let m = i
        if (l < a.length && fs[l] < fs[m]) m = l
        if (r < a.length && fs[r] < fs[m]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]; [fs[m], fs[i]] = [fs[i], fs[m]]
        i = m
      }
    }
    return top
  }
  get size() { return this.a.length }
}

let run = 0

const cellI = k => (k % NN) % NX
const cellJ = k => ((k % NN) / NX) | 0

/**
 * Path between two world points as a list of [x, z, y] waypoints.
 * @param {{x:number,y:number,z:number}} from
 * @param {{x:number,y:number,z:number}} to
 * @param {(i:number,j:number)=>number} [cost] extra per-cell cost (route variety)
 */
export function findPath(from, to, cost) {
  if (!NAV.ready) return null
  if (!gScore) {
    gScore = new Float32Array(LAYERS * NN); came = new Int32Array(LAYERS * NN)
    stamp = new Uint32Array(LAYERS * NN); closed = new Uint32Array(LAYERS * NN)
  }
  const start = nearestNode(from.x, from.y, from.z)
  const goal = nearestNode(to.x, to.y, to.z)
  if (start < 0 || goal < 0) return null
  run++
  const ti = cellI(goal), tj = cellJ(goal)
  const h = (i, j) => {
    const dx = Math.abs(i - ti), dz = Math.abs(j - tj)
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz)
  }
  const open = new Heap()
  stamp[start] = run; gScore[start] = 0; came[start] = -1
  open.push(start, h(cellI(start), cellJ(start)))
  let found = false, iter = 0
  while (open.size && iter++ < 90000) {
    const cur = open.pop()
    if (closed[cur] === run) continue
    closed[cur] = run
    if (cur === goal) { found = true; break }
    const ci = cellI(cur), cj = cellJ(cur)
    const ch = H[cur]
    for (const [di, dj, dc] of DIRS) {
      const n = layerNear(ci + di, cj + dj, ch, STEP)
      if (n < 0 || closed[n] === run) continue
      // no corner cutting: both orthogonal cells must be walkable at this height
      if (di && dj && (layerNear(ci + di, cj, ch, STEP) < 0 || layerNear(ci, cj + dj, ch, STEP) < 0)) continue
      const g = gScore[cur] + dc + (cost ? cost(ci + di, cj + dj) : 0)
      if (stamp[n] !== run || g < gScore[n]) {
        stamp[n] = run; gScore[n] = g; came[n] = cur
        open.push(n, g + h(ci + di, cj + dj))
      }
    }
  }
  if (!found) return null
  const nodes = []
  for (let c = goal; c !== -1; c = came[c]) nodes.push(c)
  nodes.reverse()
  const pts = nodes.map(k => [toX(cellI(k)), toZ(cellJ(k)), H[k]])
  pts[pts.length - 1] = [to.x, to.z, H[goal]]
  return smooth(pts)
}

/** Can a bot walk straight from a to b? Follows the floor along the segment. */
function straight(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const len = Math.hypot(dx, dz)
  const steps = Math.ceil(len / (NAV_CELL * 0.4))
  let y = a[2]
  for (let s = 1; s <= steps; s++) {
    const t = s / steps
    const x = a[0] + dx * t, z = a[1] + dz * t
    const [i, j] = cellOf(x, z)
    const k = layerNear(i, j, y, STEP)
    if (k < 0) return false
    // widen the check so the corridor clears the hull, not just the centre line
    for (const [ox, oz] of [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]]) {
      const [ii, jj] = cellOf(x + ox, z + oz)
      if (layerNear(ii, jj, H[k], STEP) < 0) return false
    }
    // and the real hull, with a hair to spare: a line that shaves a wall's
    // corner passes the grid test but leaves a bot grinding on that corner
    if (hullBlocked(x, H[k], z, MOVE.radius + 0.03, MOVE.height, 0.42)) return false
    y = H[k]
  }
  return Math.abs(y - b[2]) < STEP * 2
}

function smooth(pts) {
  if (pts.length <= 2) return pts
  const out = [pts[0]]
  let anchor = 0
  while (anchor < pts.length - 1) {
    let far = anchor + 1
    for (let k = Math.min(pts.length - 1, anchor + 40); k > anchor + 1; k--) {
      if (straight(pts[anchor], pts[k])) { far = k; break }
    }
    out.push(pts[far])
    anchor = far
  }
  return out
}

export function isWalkable(x, z, y) {
  if (!NAV.ready) return true
  const [i, j] = cellOf(x, z)
  return layerNear(i, j, y, 1.2) >= 0
}

/** A random walkable point within `r` of (x, z) near height y: [x, z, y]. */
export function randomNear(x, z, r, y = 0) {
  for (let k = 0; k < 24; k++) {
    const px = x + (Math.random() * 2 - 1) * r, pz = z + (Math.random() * 2 - 1) * r
    const [i, j] = cellOf(px, pz)
    const n = layerNear(i, j, y, 1.2)
    if (n >= 0) return [px, pz, H[n]]
  }
  return [x, z, y]
}

/** Floor height of the node nearest a point (for dropping spawns onto the map). */
export function floorNear(x, y, z) {
  const n = nearestNode(x, y, z)
  return n >= 0 ? H[n] : y
}
