import * as THREE from 'three'
import { makeSand, makeWall, makeWood, makeMetal } from '../../lib/textures'

/* aim_arena — a symmetric duel map built for rifles and snipers alike.
   A long yard (40 x 90 m) with a spawn bunker at each end, three openings in
   each bunker wall; one sniper tower per side (2.4 m up, a waist-high
   parapet to peek over, stairs behind), its twin on the far diagonal; crate
   stacks, low walls and pillars down the side lanes for the close fights,
   and two long open lanes through the bunker gaps for the long ones. Built
   from boxes, point-mirrored: the same boxes are drawn and handed to the
   BVH for collision. */

const W = 40, L = 90            // yard width (x) and length (z), metres
const WALL = 7

// [x, y, z, w, h, d, material]  — y is the bottom of the box
const tower = []
{
  // the platform and the parapet along its front edge
  tower.push([-15, 0, 31, 8, 2.4, 6, 'stone'], [-15, 2.4, 28.25, 8, 1.05, 0.5, 'stone'])
  // stairs up its inner side, 0.4 m a step
  // flush against the platform's side (x -11), the top step its own height
  for (let k = 1; k <= 5; k++) tower.push([-11 + (5 - k) * 0.8 + 0.4, 0, 33, 0.8, 0.4 * k, 2, 'stone'])
}
const HALF_SIDE = [
  // spawn bunker wall, three segments: openings at |x| 4..11
  [-15.5, 0, 37, 9, 3.4, 1, 'stone'], [0, 0, 37, 8, 3.4, 1, 'stone'], [15.5, 0, 37, 9, 3.4, 1, 'stone'],
  ...tower,
  // crate stacks
  [8, 0, 30, 1.4, 1.4, 1.4, 'wood'], [9.4, 0, 30, 1.4, 1.4, 1.4, 'wood'], [8.7, 1.4, 30, 1.2, 1.2, 1.2, 'wood'],
  [-4, 0, 24, 1.4, 1.4, 1.4, 'wood'], [-4, 1.4, 24, 1.2, 1.2, 1.2, 'wood'],
  [12, 0, 22, 2.8, 1.4, 1.4, 'wood'],
  [-14, 0, 18, 1.4, 2.8, 1.4, 'wood'], [-12.6, 0, 18, 1.4, 1.4, 1.4, 'wood'],
  [5, 0, 16, 1.4, 1.4, 1.4, 'wood'], [6.4, 0, 16, 1.4, 1.4, 1.4, 'wood'],
  // low walls to crouch-peek over
  [-8, 0, 12, 6, 1.05, 0.5, 'stone'], [10, 0, 10, 5, 1.05, 0.5, 'stone'],
  // pillars
  [16, 0, 26, 1.2, 4, 1.2, 'stone'], [-6, 0, 6, 1.2, 4, 1.2, 'stone'], [2.5, 0, 31, 1.2, 4, 1.2, 'stone'],
  // barrels
  [1, 0, 20, 0.8, 1.1, 0.8, 'metal'], [-17, 0, 8, 0.8, 1.1, 0.8, 'metal'], [17.5, 0, 14, 0.8, 1.1, 0.8, 'metal'],
]

function allBoxes() {
  const out = []
  // floor slab and outer walls
  out.push([0, -0.5, 0, W + 2, 0.5, L + 2, 'floor'])
  out.push([-(W / 2 + 0.5), 0, 0, 1, WALL, L + 2, 'wall'], [W / 2 + 0.5, 0, 0, 1, WALL, L + 2, 'wall'])
  out.push([0, 0, -(L / 2 + 0.5), W + 2, WALL, 1, 'wall'], [0, 0, L / 2 + 0.5, W + 2, WALL, 1, 'wall'])
  // centre: a broken wall at each side, the middle left open with one crate
  out.push([-12, 0, 0, 8, 2.6, 0.8, 'stone'], [12, 0, 0, 8, 2.6, 0.8, 'stone'], [0, 0, 0, 1.4, 1.4, 1.4, 'wood'])
  for (const b of HALF_SIDE) {
    out.push(b)
    out.push([-b[0], b[1], -b[2], b[3], b[4], b[5], b[6]])   // point-mirrored for the other side
  }
  return out
}

const TILE = { wall: 3.2, stone: 2.2, wood: 1.4, metal: 1.1, floor: 4 }

function pushBox(arr, [x, y, z, w, h, d], tile, color) {
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2
  const faces = [
    [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
    [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
    [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
    [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
    [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
    [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
  ]
  for (const [n, c] of faces) {
    const base = arr.pos.length / 3
    for (const p of c) {
      arr.pos.push(p[0], p[1], p[2])
      arr.nor.push(n[0], n[1], n[2])
      let u, v
      if (n[0]) { u = p[2] * n[0]; v = p[1] }
      else if (n[1]) { u = p[0]; v = p[2] }
      else { u = -p[0] * n[2]; v = p[1] }
      arr.uv.push(u / tile, v / tile)
      const shade = n[1] === 0 ? THREE.MathUtils.clamp(0.7 + (p[1] - y0) * 0.12, 0.7, 1) : n[1] > 0 ? 1 : 0.6
      arr.col.push(color.r * shade, color.g * shade, color.b * shade)
    }
    arr.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
}

function geometryFor(list, tile, tint) {
  const arr = { pos: [], nor: [], uv: [], col: [], idx: [] }
  for (const b of list) pushBox(arr, b, tile, tint())
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr.pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(arr.nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(arr.uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(arr.col, 3))
  g.setIndex(arr.idx)
  return g
}

/** Collision only (no textures) — also what the headless tests load. */
const SURFACE_CODE = { wall: 0, wood: 1, stone: 2, metal: 3, floor: 4 }
export function aimCollision() {
  const boxes = allBoxes()
  const g = geometryFor(boxes, 1, () => new THREE.Color())
  // 24 vertices a box, each tagged with what the box is made of (for wallbangs)
  const surf = new Float32Array(boxes.length * 24)
  boxes.forEach((bx, i) => surf.fill(SURFACE_CODE[bx[6]] ?? 0, i * 24, i * 24 + 24))
  g.setAttribute('surface', new THREE.Float32BufferAttribute(surf, 1))
  return g
}

/** Build the arena: render meshes plus a plain collision geometry. */
export function buildAimArena() {
  const boxes = allBoxes()
  const sand = makeSand(512), wall = makeWall(512), wood = makeWood(512), metal = makeMetal(256)
  for (const t of [sand, wall, wood, metal]) for (const m of [t.map, t.normalMap]) m.wrapS = m.wrapT = THREE.RepeatWrapping
  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: sand.map, normalMap: sand.normalMap, roughness: 1, vertexColors: true, color: '#e8d4aa' }),
    wall: new THREE.MeshStandardMaterial({ map: wall.map, normalMap: wall.normalMap, roughness: 0.95, vertexColors: true }),
    stone: new THREE.MeshStandardMaterial({ map: wall.map, normalMap: wall.normalMap, roughness: 0.9, vertexColors: true }),
    wood: new THREE.MeshStandardMaterial({ map: wood.map, normalMap: wood.normalMap, roughness: 0.85, vertexColors: true }),
    metal: new THREE.MeshStandardMaterial({ map: metal.map, normalMap: metal.normalMap, roughness: 0.55, metalness: 0.5, vertexColors: true }),
  }
  const tints = {
    floor: () => new THREE.Color('#ffffff'),
    wall: () => new THREE.Color().setHSL(0.09, 0.3, 0.62 + Math.random() * 0.05),
    stone: () => new THREE.Color().setHSL(0.08, 0.22, 0.72),
    wood: () => new THREE.Color().setHSL(0.08, 0.35, 0.72 + Math.random() * 0.1),
    metal: () => new THREE.Color().setHSL(0.58, 0.35, 0.5),
  }
  const groups = {}
  for (const b of boxes) (groups[b[6]] ||= []).push(b)
  const meshes = Object.entries(groups).map(([k, list]) => ({
    geometry: geometryFor(list, TILE[k], tints[k]), material: mats[k], lit: true,
  }))
  return { meshes, collision: aimCollision() }
}

/* Gameplay data, in the same [x, z, y] form as de_dust2's. */
const at = (x, z, y = 0) => [x, z, y]
export const AIM_DATA = {
  SITES: {},
  BUY_ZONES: { CT: { min: [-W, -L], max: [W, L] }, T: { min: [-W, -L], max: [W, L] } },
  SPAWNS: {
    CT: [at(0, 41), at(-5, 41), at(5, 41), at(-10, 41), at(10, 41), at(-2.5, 42.5), at(2.5, 42.5)],
    T: [at(0, -41), at(5, -41), at(-5, -41), at(10, -41), at(-10, -41), at(2.5, -42.5), at(-2.5, -42.5)],
  },
  SPOTS: {},
}
