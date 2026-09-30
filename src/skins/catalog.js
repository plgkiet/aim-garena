import { caseHardenedInfo } from './patterns'

/* The case and everything that can come out of it.

   Five tiers, the CS:GO case ladder (blue → purple → pink → red → gold), with
   the same slugs and colours as plgk's gift wheel so its reel, tiles and modal
   carry over unchanged. Knives are the gold tier and only ever gold.

   Odds are the real CS:GO case odds, split evenly inside a tier. */

/* The CS:GO case ladder, colours as the game shows them, with the real case
   odds: Mil-Spec 79.92%, Restricted 15.98%, Classified 3.2%, Covert 0.64%
   and a knife 0.26%. Odds are split evenly inside a grade. */
export const TIERS = [
  { slug: 'milspec', label: 'Mil-Spec', vi: 'Quân dụng', color: '#4b69ff', odds: 79.92 },
  { slug: 'restricted', label: 'Restricted', vi: 'Hạn chế', color: '#8847ff', odds: 15.98 },
  { slug: 'classified', label: 'Classified', vi: 'Tối mật', color: '#d32ce6', odds: 3.2 },
  { slug: 'covert', label: 'Covert', vi: 'Tuyệt mật', color: '#eb4b4b', odds: 0.64 },
  { slug: 'gold', label: '★ Rare Special', vi: 'Cực hiếm', color: '#e4ae39', odds: 0.26 },
]
export const tierBySlug = slug => TIERS.find(t => t.slug === slug) || TIERS[0]
export const TIER_COLOR = Object.fromEntries(TIERS.map(t => [t.slug, t.color]))

/* The three stones, lifted from their dark photos into bright, glassy
   colour: brighter and richer paint, a clearcoat and a thin-film shimmer
   (see skinMaterial) so they catch the light like cut gems. */
const GEM_LOOK = {
  ruby: { bright: 1.45, sat: 1.5, contrast: 1.1, hue: -8, metal: 0.35, rough: 0.12, iridescent: true },
  sapphire: { bright: 2.1, sat: 1.35, contrast: 1.05, metal: 0.35, rough: 0.12, iridescent: true },
  emerald: { bright: 1.08, sat: 1.6, contrast: 1.2, metal: 0.3, rough: 0.12, iridescent: true },
}

let seed = 100
const skin = (weapon, name, tier, pattern, pal, extra = {}) => ({
  id: `${weapon}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
  kind: 'gun', weapon, name, tier, pattern, pal, seed: seed++, ...extra,
})

/* ---------------------------------------------------------------- guns --- */

export const GUN_SKINS = [
  // Covert
  skin('ak47', 'Dragon Fire', 'covert', 'flames', ['#140707', '#b3140f', '#ff6a00', '#ffd23f'], { metal: 0.3 }),
  skin('awp', 'Neo Dragon', 'covert', 'neon', ['#0b0616', '#ff2bd6', '#8a2bff', '#2be4ff']),
  skin('m4a4', 'Solar Flare', 'covert', 'geometric', ['#f4f1ea', '#15171b', '#ff6a1a', '#15171b'], { tag: 'SOL-4' }),
  skin('deagle', 'Blaze', 'covert', 'fade', ['#ffe066', '#ff8a00', '#ff2a00', '#6b0000'], { metal: 0.75, rough: 0.28 }),
  skin('m4a1s', 'Hyper Violet', 'covert', 'splatter', ['#1a0f2e', '#ff2e97', '#39ff14', '#00e5ff', '#fff200']),
  // Covert photo finishes (public/textures)
  // the dragon runs the length of the body and stock, breathing fire toward
  // the barrel; barrel and scope wear the gold harlequin (layout from the AWP's
  // parts on its artwork: body and stock span u 0.3-1, v 0-0.34)
  skin('awp', 'Dragon Lore', 'covert', 'gem', ['#b9b08a'], {
    image: '/textures/lore.jpg', fit: 'band', metal: 0.25, rough: 0.45,
    layout: { u0: 0.3, u1: 1, v0: 0.0, v1: 0.34, crop: [0.18, 1], flip: true },
  }),
  skin('m4a4', 'Howl', 'covert', 'gem', ['#8a1a08'], { image: '/textures/howl.jpg', fit: 'band', band: 0.61, metal: 0.3, rough: 0.4 }),
  skin('ak47', 'Case Hardened', 'covert', 'caseHardened', ['#3f86e0'], { seeded: true, metalOnly: true, metal: 0.75, rough: 0.26 }),
  // a side photo of the real skin, laid onto the model muzzle to butt; wood stays wood
  skin('ak47', 'Fire Serpent', 'covert', 'gem', ['#2b2e33'], {
    image: '/textures/fire_serpent.png', fit: 'decal', decal: {
      left: 94, right: 986, bottom: 427,
      // the model's receiver is shorter ahead of the magazine than the photo's:
      // pin the serpent's head onto the receiver front and the mag onto the mag
      pins: [[405, 0.392], [455, 0.435], [600, 0.575]],
    },
    metalOnly: true, metal: 0.35, rough: 0.45,
  }),
  skin('ak47', 'Wild Lotus', 'covert', 'gem', ['#1f6b52'], { image: '/textures/lotus.jpg', fit: 'tile', tile: 0.45, metal: 0.2, rough: 0.5 }),
  skin('awp', 'Gungnir', 'covert', 'gem', ['#2a7fd6'], { image: '/textures/gungnir.jpg', fit: 'tile', tile: 1.5, sat: 1.4, bright: 0.82, metal: 0.25, rough: 0.45 }),
  // Classified
  skin('ak47', 'Neon Revolution', 'classified', 'neon', ['#0a0a12', '#ff3ea5', '#18f2ff', '#fffb00']),
  skin('usp', 'Cortex Pink', 'classified', 'circuit', ['#2a0b22', '#ff4fb8', '#ffe3f5']),
  skin('awp', 'Aurora', 'classified', 'aurora', ['#05091c', '#14f1b6', '#6b5bff', '#ff4fd8']),
  skin('glock', 'Fade', 'classified', 'fade', ['#fff27a', '#ff7ad9', '#9b5bff', '#3b3bff'], { metal: 0.8, rough: 0.25 }),
  skin('mp9', 'Hydra', 'classified', 'waves', ['#031a2b', '#0ff0ff', '#0b8fff', '#004b9c', '#9ef8ff']),
  // Restricted
  skin('m4a1s', 'Cyrex', 'restricted', 'geometric', ['#f2f2f2', '#c8102e', '#1b1b1b', '#c8102e'], { tag: 'CYREX' }),
  skin('famas', 'Mecha Orange', 'restricted', 'hex', ['#ff7a00', '#3a1a00', '#ffd08a']),
  skin('galil', 'Toxic Lime', 'restricted', 'stripes', ['#b6ff00', '#121212', '#b6ff00', '#2a2a2a']),
  skin('deagle', 'Ocean Drive', 'restricted', 'waves', ['#073b4c', '#06d6a0', '#ff5d8f', '#118ab2', '#ffd166']),
  skin('p250', 'Violet Hex', 'restricted', 'hex', ['#2d0a4e', '#8f2bff', '#e0b3ff']),
  // Mil-Spec
  skin('mac10', 'Candy Stripes', 'milspec', 'stripes', ['#ff4d6d', '#ffffff', '#4dc9ff', '#ffffff']),
  skin('ump', 'Arctic Camo', 'milspec', 'camo', ['#e9f5ff', '#9cc9ec', '#4f86c6', '#1e3a5f']),
  skin('ssg08', 'Sand Viper', 'milspec', 'scales', ['#3a2410', '#ffcf6b', '#b3561b']),
  skin('glock', 'Blue Circuit', 'milspec', 'circuit', ['#06122b', '#2f8cff', '#bfe0ff']),
  skin('mp9', 'Sunset Grid', 'milspec', 'fade', ['#ff9a3c', '#ff4f81', '#6a2cff', '#16103a']),
]

/* -------------------------------------------------------------- knives --- */

/* Knife finishes, after the CS:GO ones. */
const FINISH = {
  fade: { name: 'Fade', pattern: 'fade', pal: ['#fff04d', '#ff8ad8', '#b44dff', '#5b2bff'], metal: 0.9, rough: 0.2 },
  doppler: { name: 'Doppler', pattern: 'doppler', pal: ['#0a0212', '#3b0a52', '#c1128c', '#ff5bd1', '#1b1f5a'], metal: 0.85, rough: 0.2 },
  ruby: { name: 'Doppler Ruby', pattern: 'doppler', pal: ['#1a0003', '#6e0010', '#e0102c', '#ff4d5e', '#3a0008'], metal: 0.9, rough: 0.18 },
  sapphire: { name: 'Doppler Sapphire', pattern: 'doppler', pal: ['#00031a', '#001b6e', '#0a52ff', '#48a7ff', '#000b3a'], metal: 0.9, rough: 0.18 },
  emerald: { name: 'Gamma Emerald', pattern: 'doppler', pal: ['#001207', '#00471f', '#00c853', '#7dff9c', '#002a12'], metal: 0.9, rough: 0.18 },
  gamma: { name: 'Gamma Doppler', pattern: 'doppler', pal: ['#02140a', '#0b5e3a', '#2cf5a1', '#b8ff3b', '#083b28'], metal: 0.85, rough: 0.2 },
  marble: { name: 'Marble Fade', pattern: 'marble', pal: ['#ffe600', '#ff2a00', '#fff4c2', '#1f4fff', '#ffe600'], metal: 0.85, rough: 0.22 },
  tiger: { name: 'Tiger Tooth', pattern: 'tiger', pal: ['#fff2b0', '#e8a317', '#3b1d00'], metal: 0.95, rough: 0.2 },
  web: { name: 'Crimson Web', pattern: 'web', pal: ['#b3121b', '#0b0000'], metal: 0.35, rough: 0.4 },
  slaughter: { name: 'Slaughter', pattern: 'slaughter', pal: ['#ffd0dc', '#ff5a7a', '#c0122e', '#ffe6ea'], metal: 0.75, rough: 0.25 },
  // every drop gets its own pattern number; see variantOf
  caseHardened: { name: 'Case Hardened', pattern: 'caseHardened', pal: ['#3f86e0'], seeded: true, metal: 0.8, rough: 0.24 },
  // gems: photographs of the stone (public/textures), painted by paintGem
  gemRuby: { name: 'Ruby', pattern: 'gem', image: '/textures/ruby.jpg', pal: ['#b0142e'], ...GEM_LOOK.ruby },
  gemSapphire: { name: 'Sapphire', pattern: 'gem', image: '/textures/sapphire.jpg', pal: ['#1f4fd6'], ...GEM_LOOK.sapphire },
  gemEmerald: { name: 'Emerald', pattern: 'gem', image: '/textures/emerald.jpg', pal: ['#12a866'], ...GEM_LOOK.emerald },
  lore: { name: 'Lore', pattern: 'gem', image: '/textures/lore.jpg', fit: 'band', pal: ['#b9b08a'], metal: 0.6, rough: 0.3 },
  rust: { name: 'Rust Coat', pattern: 'gem', image: '/textures/rust.jpg', pal: ['#8a4a22'], metal: 0.45, rough: 0.8, sat: 1.1, contrast: 1.05, gloss: false },
}

/* `band`: how tall the blade sits on the artwork, so a banner finish (Lore)
   spans the blade exactly once. */
export const KNIFE_TYPES = {
  karambit: { name: 'Karambit', band: 0.85 },
  flip: { name: 'Flip Knife', band: 0.31 },
  huntsman: { name: 'Huntsman Knife', band: 0.35 },
}

const knife = (type, finish) => ({
  id: `knife_${type}_${finish}`,
  kind: 'knife', knife: type, tier: 'gold',
  name: FINISH[finish].name,
  weaponName: `★ ${KNIFE_TYPES[type].name}`,
  seed: seed++,
  band: KNIFE_TYPES[type].band,
  ...FINISH[finish],
})

export const KNIFE_SKINS = [
  knife('karambit', 'fade'), knife('karambit', 'sapphire'), knife('karambit', 'marble'), knife('karambit', 'tiger'),
  knife('flip', 'ruby'), knife('flip', 'web'), knife('flip', 'gamma'),
  knife('huntsman', 'slaughter'), knife('huntsman', 'emerald'), knife('huntsman', 'doppler'),
  // every knife comes in every gem, Case Hardened, Lore and Rust Coat
  ...['karambit', 'flip', 'huntsman'].flatMap(t => ['gemRuby', 'gemSapphire', 'gemEmerald', 'caseHardened', 'lore', 'rust'].map(f => knife(t, f))),
]

/* The original model knives can drop too (their finish is baked into the file). */
/* The Butterfly's own model with a finish painted on its blade: the stones and
   Case Hardened. `finish` marks a model knife whose blade gets repainted. */
const modelKnife = (type, weaponName, f) => ({
  id: `knife_${type}_${f}`, kind: 'knife', knife: type, tier: 'gold', weaponName, model: true,
  seed: seed++, ...FINISH[f], finish: true,
})

export const MODEL_KNIVES = [
  { id: 'knife_m9a', kind: 'knife', knife: 'm9a', tier: 'gold', weaponName: '★ M9 Bayonet', name: 'Doppler', model: true },
  { id: 'knife_m9b', kind: 'knife', knife: 'm9b', tier: 'gold', weaponName: '★ M9 Bayonet', name: 'Autotronic', model: true },
  { id: 'knife_bfly', kind: 'knife', knife: 'bfly', tier: 'gold', weaponName: '★ Butterfly Knife', name: 'Crimson Web', model: true },
  ...['gemEmerald', 'gemRuby', 'gemSapphire', 'caseHardened'].map(f => modelKnife('bfly', '★ Butterfly Knife', f)),
]

export const ITEMS = [...GUN_SKINS, ...KNIFE_SKINS, ...MODEL_KNIVES]
export const itemById = id => ITEMS.find(i => i.id === id) || null

/* Items renamed or merged since, so drops already in someone's inventory
   keep working: Blue Gem is now what a very blue Case Hardened is called, and
   the Howl moved to the M4A4 where it belongs. */
export const LEGACY_IDS = {
  ak47_blue_gem: 'ak47_case_hardened',
  knife_karambit_blueGem: 'knife_karambit_caseHardened',
  knife_flip_blueGem: 'knife_flip_caseHardened',
  knife_huntsman_blueGem: 'knife_huntsman_caseHardened',
  m4a1s_howl: 'm4a4_howl',
}

/* Pattern-seeded finishes (Case Hardened). The catalog item is the finish;
   what you hold is that finish at one pattern number, 1-1000, rolled when it
   drops. The variant carries its own id so its texture and picture are its
   own, and is named Blue Gem when the pattern came out nearly all blue. */
export const PATTERN_MAX = 1000
export const rollPattern = () => 1 + Math.floor(Math.random() * PATTERN_MAX)

export function variantOf(item, patternNo) {
  if (!item?.seeded || !patternNo) return item
  const { blue, gem } = caseHardenedInfo(patternNo)
  return {
    ...item,
    id: `${item.id}#${patternNo}`,
    baseId: item.id,
    patternNo,
    seed: 5000 + patternNo,
    blue,
    gem,
    name: gem ? `${item.name} (Blue Gem)` : item.name,
    detail: `Pattern #${patternNo}${gem ? ' · Blue Gem' : ''}`,
  }
}

export const CASE = {
  id: 'garena_case_1',
  name: 'Hòm Garena #1',
  items: ITEMS,
}

/** Weighted draw: pick a tier by the CS odds, then an item inside it. */
export function drawItem(items = CASE.items) {
  const total = TIERS.reduce((s, t) => s + t.odds, 0)
  let p = Math.random() * total
  let tier = TIERS[0]
  for (const t of TIERS) { p -= t.odds; if (p < 0) { tier = t; break } }
  const pool = items.filter(i => i.tier === tier.slug)
  return pool[Math.floor(Math.random() * pool.length)]
}

/* Trade up, as in CS:GO: five drops of one grade go in, one drop of the next
   grade up comes out, any item of that grade with equal chance. Five Coverts
   make a knife. */
export const TRADE_COUNT = 5
export function nextTier(slug) {
  const i = TIERS.findIndex(t => t.slug === slug)
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null
}
export function drawFromTier(slug, items = CASE.items) {
  const pool = items.filter(i => i.tier === slug)
  return pool[Math.floor(Math.random() * pool.length)]
}

export const fullName = it => it.kind === 'knife' ? `${it.weaponName} | ${it.name}` : null
