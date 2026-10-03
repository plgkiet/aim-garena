import { RECOIL } from './constants'

/* Weapon table, after CS:GO's items_game.txt.

   damage/armorRatio/rangeMod/cycle/clip/reserve/reload/speed/price/killAward
   are the game's numbers. Inaccuracy is in the game's own units too — thousandths
   of a radian — so a cone's half angle is (spread + inaccuracy) / 1000.

   `pattern` names a spray pattern below; `kick` scales it per weapon. */

export const W = {
  knife: {
    name: 'Knife', slot: 3, type: 'knife', team: 'both', price: 0, killAward: 1500,
    speed: 250, deploy: 0.6,
  },

  glock: {
    name: 'Glock-18', slot: 2, type: 'pistol', team: 'T', price: 200, killAward: 300,
    damage: 30, armorRatio: 0.47, rangeMod: 0.85, range: 4096, pen: 1,
    cycle: 0.15, auto: false, clip: 20, reserve: 120, reload: 2.27, deploy: 1.0, speed: 240,
    inacc: { spread: 2, stand: 8.5, crouch: 6.2, move: 13, jump: 290, fire: 56, recover: 0.35 },
    pattern: 'pistol', kick: 0.8, sound: 'glock', model: 'glock',
  },
  usp: {
    name: 'USP-S', slot: 2, type: 'pistol', team: 'CT', price: 200, killAward: 300,
    damage: 35, armorRatio: 1.01, rangeMod: 0.99, range: 4096, pen: 1,
    cycle: 0.17, auto: false, clip: 12, reserve: 24, reload: 2.2, deploy: 1.0, speed: 240,
    inacc: { spread: 1.8, stand: 5.5, crouch: 4.2, move: 13, jump: 290, fire: 52, recover: 0.35 },
    pattern: 'pistol', kick: 0.85, sound: 'usp', silenced: true, model: 'usp',
  },
  p250: {
    name: 'P250', slot: 2, type: 'pistol', team: 'both', price: 300, killAward: 300,
    damage: 38, armorRatio: 1.64, rangeMod: 0.85, range: 4096, pen: 1,
    cycle: 0.15, auto: false, clip: 13, reserve: 26, reload: 2.2, deploy: 1.0, speed: 240,
    inacc: { spread: 2, stand: 9, crouch: 6.5, move: 14, jump: 290, fire: 62, recover: 0.4 },
    pattern: 'pistol', kick: 1.0, sound: 'p250', model: 'p250',
  },
  // FN Five-seveN: the CT side's armour-piercing pistol, 20 rounds, light recoil
  fiveseven: {
    name: 'Five-SeveN', slot: 2, type: 'pistol', team: 'CT', price: 500, killAward: 300,
    damage: 32, armorRatio: 1.823, rangeMod: 0.81, range: 4096, pen: 1,
    cycle: 0.15, auto: false, clip: 20, reserve: 100, reload: 2.2, deploy: 1.0, speed: 240,
    inacc: { spread: 2, stand: 9, crouch: 6.5, move: 14, jump: 290, fire: 50, recover: 0.38 },
    pattern: 'pistol', kick: 0.9, sound: 'fiveseven', model: 'fiveseven',
  },
  deagle: {
    name: 'Desert Eagle', slot: 2, type: 'pistol', team: 'both', price: 700, killAward: 300,
    damage: 63, armorRatio: 1.864, rangeMod: 0.81, range: 4096, pen: 2,
    cycle: 0.225, auto: false, clip: 7, reserve: 35, reload: 2.2, deploy: 1.0, speed: 230,
    inacc: { spread: 2, stand: 7, crouch: 5, move: 30, jump: 340, fire: 90, recover: 0.8 },
    pattern: 'pistol', kick: 2.4, sound: 'deagle', model: 'deagle',
  },

  mac10: {
    name: 'MAC-10', slot: 1, type: 'smg', team: 'T', price: 1050, killAward: 600,
    damage: 29, armorRatio: 1.15, rangeMod: 0.8, range: 4096, pen: 1,
    cycle: 0.075, auto: true, clip: 30, reserve: 100, reload: 2.6, deploy: 1.0, speed: 240,
    inacc: { spread: 2.5, stand: 15, crouch: 11, move: 30, jump: 120, fire: 7, recover: 0.33 },
    pattern: 'smg', kick: 0.75, sound: 'mac10', model: 'mac10',
  },
  mp9: {
    name: 'MP9', slot: 1, type: 'smg', team: 'CT', price: 1250, killAward: 600,
    damage: 26, armorRatio: 1.2, rangeMod: 0.87, range: 4096, pen: 1,
    cycle: 0.07, auto: true, clip: 30, reserve: 120, reload: 2.13, deploy: 1.0, speed: 240,
    inacc: { spread: 2.2, stand: 13, crouch: 10, move: 25, jump: 120, fire: 5.5, recover: 0.3 },
    pattern: 'smg', kick: 0.7, sound: 'mp9', model: 'mp9',
  },
  ump: {
    name: 'UMP-45', slot: 1, type: 'smg', team: 'both', price: 1200, killAward: 600,
    damage: 35, armorRatio: 1.3, rangeMod: 0.75, range: 4096, pen: 1,
    cycle: 0.09, auto: true, clip: 25, reserve: 100, reload: 3.5, deploy: 1.0, speed: 230,
    inacc: { spread: 2.2, stand: 13, crouch: 10, move: 30, jump: 120, fire: 5.5, recover: 0.33 },
    pattern: 'smg', kick: 0.85, sound: 'ump', model: 'ump',
  },
  p90: {
    name: 'P90', slot: 1, type: 'smg', team: 'both', price: 2350, killAward: 300,
    damage: 26, armorRatio: 1.38, rangeMod: 0.86, range: 3700, pen: 1,
    cycle: 0.07, auto: true, clip: 50, reserve: 100, reload: 3.3, deploy: 1.0, speed: 230,
    inacc: { spread: 2.3, stand: 14, crouch: 10, move: 28, jump: 120, fire: 4.5, recover: 0.33 },
    pattern: 'smg', kick: 0.7, sound: 'p90', model: 'p90',
  },

  galil: {
    name: 'Galil AR', slot: 1, type: 'rifle', team: 'T', price: 1800, killAward: 300,
    damage: 30, armorRatio: 1.55, rangeMod: 0.98, range: 8192, pen: 2,
    cycle: 0.09, auto: true, clip: 35, reserve: 90, reload: 3.0, deploy: 1.0, speed: 215,
    inacc: { spread: 0.6, stand: 8, crouch: 6, move: 150, jump: 140, fire: 8.5, recover: 0.4 },
    pattern: 'galil', kick: 0.95, sound: 'galil', model: 'galil',
  },
  famas: {
    name: 'FAMAS', slot: 1, type: 'rifle', team: 'CT', price: 2050, killAward: 300,
    damage: 30, armorRatio: 1.4, rangeMod: 0.96, range: 8192, pen: 2,
    cycle: 0.09, auto: true, clip: 25, reserve: 90, reload: 3.3, deploy: 1.0, speed: 220,
    inacc: { spread: 0.6, stand: 7, crouch: 5.5, move: 145, jump: 140, fire: 8, recover: 0.38 },
    pattern: 'famas', kick: 0.9, sound: 'famas', model: 'famas',
  },
  ak47: {
    name: 'AK-47', slot: 1, type: 'rifle', team: 'T', price: 2700, killAward: 300,
    damage: 36, armorRatio: 1.55, rangeMod: 0.98, range: 8192, pen: 2,
    cycle: 0.1, auto: true, clip: 30, reserve: 90, reload: 2.43, deploy: 1.0, speed: 215,
    inacc: { spread: 0.6, stand: 6.4, crouch: 4.8, move: 175, jump: 140, fire: 7.8, recover: 0.37 },
    pattern: 'ak47', kick: 1, sound: 'ak47', model: 'ak47',
  },
  m4a4: {
    name: 'M4A4', slot: 1, type: 'rifle', team: 'CT', price: 3100, killAward: 300,
    damage: 33, armorRatio: 1.4, rangeMod: 0.97, range: 8192, pen: 2,
    cycle: 0.09, auto: true, clip: 30, reserve: 90, reload: 3.07, deploy: 1.0, speed: 225,
    inacc: { spread: 0.6, stand: 4.9, crouch: 3.7, move: 123, jump: 130, fire: 7, recover: 0.32 },
    pattern: 'm4a4', kick: 1, sound: 'm4a4', model: 'm4a4',
  },
  m4a1s: {
    name: 'M4A1-S', slot: 1, type: 'rifle', team: 'CT', price: 2900, killAward: 300,
    damage: 38, armorRatio: 1.4, rangeMod: 0.94, range: 8192, pen: 2,
    cycle: 0.1, auto: true, clip: 20, reserve: 80, reload: 3.07, deploy: 1.0, speed: 225,
    inacc: { spread: 0.45, stand: 4.3, crouch: 3.3, move: 125, jump: 130, fire: 6.5, recover: 0.33 },
    pattern: 'm4a1s', kick: 0.85, sound: 'm4a1s', silenced: true, model: 'm4a1s',
  },
  ssg08: {
    name: 'SSG 08', slot: 1, type: 'sniper', team: 'both', price: 1700, killAward: 300,
    damage: 88, armorRatio: 1.7, rangeMod: 0.98, range: 8192, pen: 2.5,
    cycle: 1.25, auto: false, clip: 10, reserve: 90, reload: 3.7, deploy: 1.25, speed: 230, speedScoped: 230,
    inacc: { spread: 0.3, stand: 30, crouch: 22, move: 60, jump: 45, fire: 20, recover: 0.2,
      standScoped: 1.2, crouchScoped: 0.9 },
    zoom: [40, 15], pattern: 'sniper', kick: 1.4, sound: 'ssg08', model: 'ssg08',
  },
  g3sg1: {
    name: 'G3SG1', slot: 1, type: 'sniper', team: 'T', price: 5000, killAward: 300,
    damage: 80, armorRatio: 1.65, rangeMod: 0.98, range: 8192, pen: 2.5,
    cycle: 0.25, auto: true, clip: 20, reserve: 90, reload: 4.7, deploy: 1.25, speed: 215, speedScoped: 120,
    inacc: { spread: 0.3, stand: 30, crouch: 22, move: 150, jump: 200, fire: 28, recover: 0.3,
      standScoped: 2.6, crouchScoped: 1.8 },
    zoom: [40, 15], pattern: 'sniper', kick: 1.2, sound: 'g3sg1', model: 'g3sg1',
  },
  scar20: {
    name: 'SCAR-20', slot: 1, type: 'sniper', team: 'CT', price: 5000, killAward: 300,
    damage: 80, armorRatio: 1.65, rangeMod: 0.98, range: 8192, pen: 2.5,
    cycle: 0.25, auto: true, clip: 20, reserve: 90, reload: 3.1, deploy: 1.25, speed: 215, speedScoped: 120,
    inacc: { spread: 0.3, stand: 30, crouch: 22, move: 150, jump: 200, fire: 28, recover: 0.3,
      standScoped: 2.6, crouchScoped: 1.8 },
    zoom: [40, 15], pattern: 'sniper', kick: 1.2, sound: 'scar20', model: 'scar20',
  },
  awp: {
    name: 'AWP', slot: 1, type: 'sniper', team: 'both', price: 4750, killAward: 100,
    damage: 115, armorRatio: 1.95, rangeMod: 0.99, range: 8192, pen: 2.5,
    cycle: 1.455, auto: false, clip: 5, reserve: 30, reload: 3.67, deploy: 1.25, speed: 200, speedScoped: 100,
    inacc: { spread: 0.2, stand: 85, crouch: 70, move: 240, jump: 400, fire: 110, recover: 0.25,
      standScoped: 1.2, crouchScoped: 0.8 },
    zoom: [40, 10], pattern: 'sniper', kick: 3, sound: 'awp', model: 'awp',
  },

  he: {
    name: 'HE Grenade', slot: 4, type: 'grenade', team: 'both', price: 300, killAward: 300,
    deploy: 0.6, speed: 245, max: 1, model: 'he',
  },
  flash: {
    name: 'Flashbang', slot: 4, type: 'grenade', team: 'both', price: 200, killAward: 300,
    deploy: 0.6, speed: 245, max: 2, model: 'flash',
  },
  smoke: {
    name: 'Smoke Grenade', slot: 4, type: 'grenade', team: 'both', price: 300, killAward: 300,
    deploy: 0.6, speed: 245, max: 1, model: 'smoke',
  },
  // fire on the ground for 7 s: the Molotov for T, the Incendiary for CT
  molotov: {
    name: 'Molotov', slot: 4, type: 'grenade', team: 'T', price: 400, killAward: 300,
    deploy: 0.6, speed: 245, max: 1, model: 'molotov', fire: true,
  },
  incgrenade: {
    name: 'Incendiary Grenade', slot: 4, type: 'grenade', team: 'CT', price: 600, killAward: 300,
    deploy: 0.6, speed: 245, max: 1, model: 'incgrenade', fire: true,
  },
  c4: {
    name: 'C4 Explosive', slot: 5, type: 'c4', team: 'T', price: 0, killAward: 0,
    deploy: 0.8, speed: 250, model: 'c4',
  },
}
for (const [id, w] of Object.entries(W)) w.id = id

export const GEAR = {
  vest: { name: 'Kevlar Vest', price: 650 },
  vesthelm: { name: 'Kevlar + Helmet', price: 1000 },
  defuser: { name: 'Defuse Kit', price: 400, team: 'CT' },
}

/** What the buy menu shows, per team, in CS:GO's order. */
export const BUY_MENU = {
  T: {
    pistols: ['glock', 'p250', 'deagle'],
    smgs: ['mac10', 'ump', 'p90'],
    rifles: ['galil', 'ak47', 'ssg08', 'awp', 'g3sg1'],
    gear: ['vest', 'vesthelm'],
    grenades: ['flash', 'smoke', 'he', 'molotov'],
  },
  CT: {
    pistols: ['usp', 'p250', 'fiveseven', 'deagle'],
    smgs: ['mp9', 'ump', 'p90'],
    rifles: ['famas', 'm4a4', 'm4a1s', 'ssg08', 'awp', 'scar20'],
    gear: ['vest', 'vesthelm', 'defuser'],
    grenades: ['flash', 'smoke', 'he', 'incgrenade'],
  },
}

/* ------------------------------------------------------------- patterns --- */

/* Where each bullet of an uninterrupted spray lands relative to the first, in
   degrees (x right, y up) — what you see on the wall. The per-shot aim-punch
   kicks are derived from these at load time, *through* the recoil decay, so
   spraying reproduces the curve and letting go recovers exactly like the game. */
const CURVES = {
  ak47: [
    [0, 0], [0.05, 0.45], [0.1, 1.15], [0, 1.95], [-0.1, 2.85], [0.1, 3.65], [0.3, 4.4], [0.25, 5.1],
    [0.45, 5.6], [0.8, 5.95], [0.4, 6.15], [-0.4, 6.3], [-1.3, 6.35], [-2, 6.45], [-2.5, 6.55],
    [-2.2, 6.8], [-1.5, 6.8], [-0.6, 6.7], [0.4, 6.9], [1.4, 7], [2.2, 6.9], [2.8, 6.95], [3.1, 7.1],
    [2.9, 7.3], [2.2, 7.2], [1.3, 7.3], [0.8, 7.4], [1, 7.2], [1.6, 7.1], [2.2, 7.2],
  ],
  m4a4: [
    [0, 0], [0, 0.4], [-0.05, 1], [0.05, 1.7], [0.15, 2.45], [0.05, 3.15], [-0.15, 3.8], [0.1, 4.3],
    [0.4, 4.7], [0.9, 4.95], [1.4, 5.1], [1.9, 5.2], [2.2, 5.35], [1.9, 5.5], [1.2, 5.55], [0.4, 5.6],
    [-0.4, 5.7], [-1.1, 5.75], [-1.7, 5.8], [-2.1, 5.9], [-1.8, 6.05], [-1.2, 6.1], [-0.4, 6.1],
    [0.3, 6.2], [0.9, 6.3], [1.3, 6.3], [1.5, 6.4], [1.2, 6.5], [0.7, 6.5], [0.2, 6.6],
  ],
  m4a1s: [
    [0, 0], [0, 0.35], [-0.05, 0.85], [0.05, 1.45], [0.1, 2.05], [0, 2.6], [-0.15, 3.1], [0.05, 3.5],
    [0.35, 3.8], [0.75, 4], [1.1, 4.1], [1.35, 4.2], [1.1, 4.3], [0.6, 4.35], [0, 4.4], [-0.6, 4.45],
    [-1.1, 4.5], [-1.3, 4.6], [-1, 4.65], [-0.5, 4.7],
  ],
}
function riseCurve(n, height, sway, seed) {
  // generic rise-then-wander curve for weapons without a hand-authored one
  const out = []
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5
  let x = 0
  for (let i = 0; i < n; i++) {
    const y = height * (1 - Math.exp(-i / 7))
    if (i > 6) x += rnd() * sway + Math.sin(i * 0.45) * sway * 0.4
    out.push([x, y])
  }
  return out
}
CURVES.galil = riseCurve(35, 7, 0.9, 7)
CURVES.famas = riseCurve(25, 5.5, 0.8, 11)
CURVES.smg = riseCurve(30, 4.2, 0.7, 3)
CURVES.pistol = [[0, 0], ...riseCurve(20, 5, 0.6, 5).slice(1)]
CURVES.sniper = [[0, 0], [0, 3], [0, 3]]

/** Per-shot aim-punch kicks: the curve's steps, halved by weapon_recoil_scale.
    Punch does not decay between the shots of a held spray (see weaponLogic),
    so the spray walks the curve exactly and recovers once you let go. */
function kicksFor(curve, scale) {
  const k = RECOIL.weapon_recoil_scale
  const kicks = []
  for (let i = 0; i < curve.length; i++) {
    const a = curve[i], b = curve[Math.min(i + 1, curve.length - 1)]
    kicks.push([((b[0] - a[0]) * scale) / k, ((b[1] - a[1]) * scale) / k])
  }
  return kicks
}

for (const w of Object.values(W)) {
  if (!w.pattern) continue
  const scale = w.pattern === 'pistol' || w.pattern === 'sniper' ? w.kick : 1
  // pistols and snipers are tapped: size their kick directly, not the curve
  w.kicks = w.pattern === 'pistol' || w.pattern === 'sniper'
    ? CURVES[w.pattern].map((_, i) => [0, (i === 0 ? 0.9 : 1.1) * scale])
    : kicksFor(CURVES[w.pattern], w.kick)
}

export const isGun = id => !!W[id]?.damage

/* Aim-down-sights zoom per weapon class (horizontal FOV at 4:3, like the
   scopes). CS:GO has no ADS outside the AUG/SG; this is a PUBG-style addition. */
export const ADS_FOV = { rifle: 60, smg: 70, pistol: 76 }
export const canAds = w => !!w && !w.zoom && !!ADS_FOV[w.type]
