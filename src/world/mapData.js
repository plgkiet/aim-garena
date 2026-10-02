import { src } from './level'
import { AIM_DATA } from './maps/aimArena'

/* Gameplay data for de_dust2, in real Hammer coordinates (x east, y north,
   z up, inches) converted with src(). The z values are the floor heights
   measured off the mesh; spawns are dropped onto the floor at runtime anyway.
   Points are [worldX, worldZ, worldY] so code that only needs the ground
   plane can keep reading [0] and [1]. */

const p = (x, y, z = 0) => { const v = src(x, y, z); return [v.x, v.z, v.y] }
const rect = (x0, y0, x1, y1) => {
  const a = src(x0, y0), b = src(x1, y1)
  return { min: [Math.min(a.x, b.x), Math.min(a.z, b.z)], max: [Math.max(a.x, b.x), Math.max(a.z, b.z)] }
}

const DUST2_SITES = {
  A: { name: 'A', ...rect(820, 2220, 1560, 2900), center: p(1100, 2550, 96) },
  B: { name: 'B', ...rect(-2080, 2280, -1360, 3000), center: p(-1700, 2650, 0) },
}

const DUST2_BUY = {
  CT: rect(-250, 1950, 760, 2560),
  T: rect(-1000, -1100, 420, -450),
}


const DUST2_SPAWNS = {
  CT: [p(600, 2150, -106), p(680, 2250, -81), p(600, 2300, -106), p(200, 2250, -128), p(350, 2350, -128), p(100, 2150, -128), p(450, 2200, -128)],
  T: [p(-600, -800, 128), p(-450, -800, 113), p(-300, -800, 75), p(-150, -850, 38), p(0, -800, 0), p(-750, -850, 128), p(100, -850, 0)],
}

const hold = (a, look) => ({ p: a, look })

/* Named spots the bots plan with; `look` is where to face while holding. */
const DUST2_SPOTS = {
  // T routes
  longDoors: p(640, 400, 0),
  longCorner: p(1450, 1600, 0),
  catBottom: p(-350, 1400, -32),
  shortTop: p(400, 1850, 96),
  tunnelsOut: p(-1800, 300, 0),
  tunnelsIn: p(-1980, 1700, 32),
  midTop: p(-400, 300, 0),
  midMid: p(-380, 1000, -58),
  // mid to B through CT: the mid doors from the CT side, then outside B doors
  ctMid: p(-400, 2050, -128),
  bDoors: p(-1150, 2380, 0),
  // CT holds
  holdA: [
    hold(p(1200, 2750, 96), p(1450, 1500, 0)),     // site, watching long
    hold(p(650, 2500, 96), p(400, 1850, 96)),      // watching short
    hold(p(1500, 2800, 124), p(1450, 1600, 0)),
    hold(p(1000, 2350, 0), p(-100, 1500, -32)),
  ],
  holdB: [
    hold(p(-1650, 2600, 0), p(-1980, 1750, 32)),   // watching the tunnel exit
    hold(p(-1400, 2500, 6), p(-1980, 1750, 32)),
    hold(p(-1850, 2550, 32), p(-1980, 1700, 32)),
    hold(p(-1500, 2200, 0), p(-1980, 1800, 32)),
  ],
  holdMid: [
    hold(p(-400, 2100, -128), p(-380, 900, -58)),
    hold(p(-300, 1900, -128), p(-400, 600, 0)),
  ],
  // where Ts sit after the plant, watching the CT approaches
  postA: [
    hold(p(1100, 2600, 96), p(300, 2300, -128)),
    hold(p(1400, 2300, 0), p(1000, 2350, 0)),
    hold(p(900, 2700, 96), p(400, 2300, -128)),
    hold(p(1250, 2150, 0), p(650, 2500, 96)),
  ],
  postB: [
    hold(p(-1700, 2700, 0), p(-1300, 2450, 0)),
    hold(p(-1500, 2700, 0), p(-1200, 2500, 0)),
    hold(p(-1900, 2400, 0), p(-1400, 2500, 0)),
    hold(p(-1980, 1800, 16), p(-1700, 2600, 0)),
  ],
  plantA: [p(1050, 2550, 96), p(1250, 2450, 96), p(950, 2650, 96)],
  plantB: [p(-1650, 2650, 0), p(-1750, 2850, 32), p(-1550, 2450, 0)],
}

/* Bullet penetration cost per metre, by what the solid is made of. A gun's
   `pen` is its budget (pistols and SMGs 1, rifles 2, snipers 2.5), so:
     wood   crates: rifles through a whole crate, pistols through a thin one
     wall   plaster / thin brick, and anything untyped (de_dust2's mesh
            carries no surface types): rifles through ~0.5 m, pistols a door
     stone  concrete and thick masonry: only half a metre, rifles and up
     metal  solid steel: a few centimetres at most
   and nothing ever goes through the ground. */
export const PENETRATION = { wood: 1.2, wall: 4, stone: 4.5, metal: 14, sand: Infinity, floor: Infinity }
/** Material codes stored per vertex on a map's collision mesh (see level.js). */
export const SURFACES = ['wall', 'wood', 'stone', 'metal', 'floor']

/* ------------------------------------------------------------ registry --- */

const MAPS = {
  dust2: {
    id: 'dust2', name: 'Dust',
    SITES: DUST2_SITES, BUY_ZONES: DUST2_BUY, SPAWNS: DUST2_SPAWNS, SPOTS: DUST2_SPOTS,
    SPAWN_YAW: { T: 0, CT: Math.PI },      // T spawn is south: face north (-Z)
  },
  aim: {
    id: 'aim', name: 'Aim Garena', ...AIM_DATA,
    SPAWN_YAW: { T: Math.PI, CT: 0 },
  },
  /* Warehouse (Standoff 2's Arena): a walled yard about 33 x 49 m, crates
     and low platforms down the middle; one side spawns along each short
     wall (spots measured clear of everything on the floor). */
  arena: {
    id: 'arena', name: 'Warehouse',
    SITES: {}, SPOTS: {},
    BUY_ZONES: { CT: { min: [-30, -30], max: [30, 30] }, T: { min: [-30, -30], max: [30, 30] } },
    SPAWNS: {
      CT: [[0, 23.5, 0], [-5, 23.5, 0], [5, 23.5, 0], [-9, 23.5, 0], [10, 23.5, 0], [14, 23.5, 0], [2.5, 24.5, 0]],
      T: [[0, -24, 0], [5, -24, 0], [-5, -24, 0], [10, -24, 0], [-10, -24, 0], [13, -24, 0], [-2.5, -25, 0]],
    },
    SPAWN_YAW: { T: Math.PI, CT: 0 },
  },
}

/** The map the match is on. Its fields are swapped in place by setMap(). */
export const map = { ...MAPS.dust2 }
export function setMap(id) { Object.assign(map, MAPS[id]) }

// live views, so `SITES.A` etc. always mean the current map
export const SITES = new Proxy({}, { get: (_, k) => map.SITES[k], ownKeys: () => Reflect.ownKeys(map.SITES), getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: map.SITES[k] }) })
export const SPOTS = new Proxy({}, { get: (_, k) => map.SPOTS[k] })
export const SPAWNS = new Proxy({}, { get: (_, k) => map.SPAWNS[k] })
export const BUY_ZONES = new Proxy({}, { get: (_, k) => map.BUY_ZONES[k] })

export function inZone(z, x, zz) {
  return !!z && x >= z.min[0] && x <= z.max[0] && zz >= z.min[1] && zz <= z.max[1]
}
export function siteAt(x, z) {
  for (const s of Object.values(map.SITES)) if (inZone(s, x, z)) return s.name
  return null
}
