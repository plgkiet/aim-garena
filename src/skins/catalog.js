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
  // Covert: only the texture skins (photos, paintings, patterns from pictures)
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
  // paintings: a strip cut to the M4A4's 3.3:1 side (v 0-0.61), laid on once
  // and mirrored so the side you look at reads the right way round
  skin('m4a4', 'Starry Night', 'covert', 'gem', ['#1b2a5e'], {
    image: '/textures/starry_night.jpg', fit: 'band', metal: 0.2, rough: 0.5,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.61, crop: [0.01, 0.99], cropV: [0.06, 0.44], flip: true },
  }),
  skin('m4a4', 'Doraemon', 'covert', 'gem', ['#e9d9f0'], {
    image: '/textures/doraemon.jpg', fit: 'band', metal: 0.15, rough: 0.5,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.61, crop: [0.401, 0.801], cropV: [0.46, 0.708], flip: true },   // the big Doraemon by the door sits mid-gun
  }),
  // Hokusai's wave: the curling crest, cut to the AK's 3.3:1 side
  skin('ak47', 'Great Wave', 'covert', 'gem', ['#e9dcc0'], {
    image: '/textures/great_wave.jpg', fit: 'band', metal: 0.15, rough: 0.5,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.604, crop: [0.1, 0.62], cropV: [0.33, 0.56], flip: true },
  }),
  // Munch's Scream on the Deagle: its side is taller than the artwork, so it
  // is squeezed (vSpan) to fit, and the face lands on the frame
  skin('deagle', 'The Scream', 'covert', 'gem', ['#4a3528'], {
    image: '/textures/scream.jpg', fit: 'band', metal: 0.15, rough: 0.55, vSpan: 1.6, paintChrome: true,
    layout: { plain: true, u0: 0, u1: 1, v0: 0.12, v1: 1, cropV: [0.37, 1], flip: true },
  }),
  // a tiled background with one emblem set mid-gun (tileCrop / emblem in patterns.js)
  skin('m4a4', 'Bape Shark', 'covert', 'gem', ['#4c8fd6'], {
    image: '/textures/bape.jpg', fit: 'tile', tile: 0.6, tileCrop: [0, 0, 1, 0.3], metal: 0.15, rough: 0.55,
    emblem: { crop: [0.3, 0.355, 0.69, 0.66], at: [0.58, 0.3], h: 0.5 },
  }),
  skin('awp', 'LV Supreme', 'covert', 'gem', ['#e0141e'], {
    image: '/textures/supreme_lv.jpg', fit: 'tile', tile: 0.35, tileCrop: [0, 0, 1, 0.33], tileFlip: true, metal: 0.15, rough: 0.5,
    emblem: { crop: [0.25, 0.43, 0.77, 0.63], at: [0.6, 0.2], h: 0.13, flip: true, pad: 0.5, padColor: '#fe0000' },
  }),
  // Michelangelo on the AWP: the two hands almost touching land on the body
  skin('awp', 'Creation of Adam', 'covert', 'gem', ['#d9cbb0'], {
    image: '/textures/creation_of_adam.jpg', fit: 'band', metal: 0.15, rough: 0.55,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.46, crop: [0.08, 0.92], cropV: [0.14, 0.566], flip: true },
  }),
  // Monet's water lilies on the USP-S: its side (silencer and all) is about
  // the painting's 1.9:1 once squeezed, so the whole canvas goes on
  skin('usp', 'Water Lilies', 'covert', 'gem', ['#5b7fb8'], {
    image: '/textures/water_lilies.jpg', fit: 'band', metal: 0.15, rough: 0.5, vSpan: 1.1,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.94, flip: true },
  }),
  // painted in code after the silver-and-blue street racer
  // the silver-and-blue street racer, from a flat livery sheet: silver with
  // the twin stripes painted in code, the band of blue blades off the sheet
  // (upright there, turned to run along the gun) low on the body, and each
  // sponsor sticker cut from the sheet's column and set on the forend and stock
  skin('awp', 'Street Racer', 'covert', 'gem', ['#c7ccd2', '#2438c8', '#8d949c'], {
    image: '/textures/r34_livery.jpg', fit: 'overlay', base: 'livery', blades: false, metal: 0.7, rough: 0.3,
    emblems: [
      { crop: [0, 0.02, 0.44, 0.98], at: [0.66, 0.1], h: 1.34, w: 0.1, rot: -Math.PI / 2 },   // blade band
      { crop: [0.76, 0.05, 0.94, 0.105], at: [0.37, 0.27], h: 0.055, flip: true },   // HKS
      { crop: [0.76, 0.375, 0.94, 0.46], at: [0.45, 0.27], h: 0.06, flip: true },    // JBL
      { crop: [0.76, 0.31, 0.94, 0.36], at: [0.54, 0.27], h: 0.045, flip: true },    // NOPI
      { crop: [0.76, 0.59, 0.94, 0.63], at: [0.63, 0.27], h: 0.04, flip: true },     // sparco
      { crop: [0.76, 0.115, 0.94, 0.18], at: [0.95, 0.29], h: 0.06, flip: true },    // JIC magic
      { crop: [0.76, 0.19, 0.94, 0.235], at: [0.79, 0.29], h: 0.045, flip: true },   // Gold-Line
      { crop: [0.76, 0.245, 0.94, 0.295], at: [0.95, 0.2], h: 0.045, flip: true },   // flexivity
      { crop: [0.76, 0.52, 0.94, 0.585], at: [0.955, 0.1], h: 0.06, flip: true },    // APC
      { crop: [0.76, 0.47, 0.94, 0.515], at: [0.8, 0.045], h: 0.04, flip: true },    // Modern Image
    ],
  }),
  // the orange street racer, from a side photo: the whole door graphic (green
  // streaks, silver runner, stripes) shrunk into one band along the receiver
  // and handguard over plain orange; unflipped, so the runner heads for the muzzle
  skin('m4a4', 'Street Flames', 'covert', 'gem', ['#f47a00'], {
    image: '/textures/supra_side.jpg', fit: 'band', metal: 0.5, rough: 0.32,
    layout: { plain: true, u0: 0.38, u1: 0.98, v0: 0.3, v1: 0.55, crop: [0, 0.9], cropV: [0.33, 0.6] },
  }),
  // the maneki-neko print: a square around the cat (the Glock's side is about
  // square once squeezed with vSpan), frame and wall cut away
  skin('glock', 'Lucky Cat', 'covert', 'gem', ['#e9dcc2'], {
    image: '/textures/lucky_cat.jpg', fit: 'band', metal: 0.15, rough: 0.5, vSpan: 2,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.97, crop: [0.274, 0.733], cropV: [0.37, 0.851], flip: true },
  }),
  // black ground with the horseshoe-and-tongue logo mid-gun and the wordmark
  // on the handguard, both mirrored to read right on the side you see
  skin('m4a4', 'Chrome Hearts', 'covert', 'gem', ['#0b0b0c'], {
    image: '/textures/chrome_hearts.jpg', fit: 'overlay', base: 'solid', metal: 0.55, rough: 0.35,
    emblems: [
      { crop: [0.06, 0.16, 0.94, 0.67], at: [0.6, 0.4], h: 0.52, flip: true },   // horseshoe + tongue, raised so the tongue clears the trigger gap
      { crop: [0.06, 0.68, 0.94, 0.86], at: [0.31, 0.49], h: 0.1, flip: true },  // wordmark on the handguard
      { crop: [0.06, 0.68, 0.94, 0.86], at: [0.9, 0.42], h: 0.09, flip: true },  // and on the stock
    ],
  }),
  // hot-rod flames burning upward: the picture tiled along the gun, each
  // tile as tall as the gun's side so the roots sit on its underside
  skin('m4a4', 'Green Flames', 'covert', 'gem', ['#1b1c1b'], {
    image: '/textures/green_flames.jpg', fit: 'tile', tile: 0.61, tileCrop: [0, 0.2, 1, 1], metal: 0.4, rough: 0.4,
  }),
  // the same in blue for the M4A1-S (its side runs to v 0.53)
  skin('m4a1s', 'Blue Flames', 'covert', 'gem', ['#05070d'], {
    image: '/textures/blue_flames.jpg', fit: 'tile', tile: 0.53, tileCrop: [0, 0.03, 1, 1], metal: 0.4, rough: 0.4,
  }),
  // the cherry-blossom wordmark on white, mid-gun, with sprigs of blossom off
  // its edges on the handguard and stock
  skin('m4a1s', 'Anti Social', 'covert', 'gem', ['#f4f3ef'], {
    image: '/textures/assc.jpg', fit: 'overlay', base: 'solid', metal: 0.1, rough: 0.55,
    emblems: [
      { crop: [0.02, 0.2, 0.98, 0.73], at: [0.58, 0.36], h: 0.3, flip: true },  // wordmark on the receiver
      { crop: [0.02, 0.2, 0.98, 0.73], at: [0.92, 0.34], h: 0.22, flip: true },  // and larger on the stock
      { crop: [0.0, 0.4, 0.2, 0.5], at: [0.3, 0.42], h: 0.1, flip: true },       // sprig, handguard
    ],
  }),
  // the web stripe and the king snake: both stand upright in the picture, so
  // both are turned to run the length of the gun, the snake's head toward the
  // muzzle over the magazine; at this length the snake keeps its own shape and
  // the stripe behind it lines up with the web running the gun's length
  skin('awp', 'Gucci Snake', 'covert', 'gem', ['#050505'], {
    image: '/textures/gucci.jpg', fit: 'overlay', base: 'solid', metal: 0.3, rough: 0.45,
    emblems: [
      { crop: [0.35, 0.0, 0.64, 0.1], at: [0.5, 0.21], h: 2, w: 0.09, rot: -Math.PI / 2 },   // green-red-green web
      { crop: [0.22, 0.12, 0.78, 0.89], at: [0.77, 0.21], h: 0.9, w: 0.17, rot: -Math.PI / 2 }, // the snake
    ],
  }),
  skin('ak47', 'Wild Lotus', 'covert', 'gem', ['#1f6b52'], { image: '/textures/lotus.jpg', fit: 'tile', tile: 0.45, metal: 0.2, rough: 0.5 }),
  // a side photo of the real skin laid on muzzle to butt (like Fire Serpent):
  // magazine and thumbhole pinned to the model's, stretched upright a little
  // so the photo's scope lands on the scope
  skin('awp', 'Gungnir', 'covert', 'gem', ['#3b8ad9'], {
    image: '/textures/gungnir.png', fit: 'decal', metal: 0.35, rough: 0.4,
    decal: { left: 0, right: 1260, bottom: 238, sy: 1.28, pins: [[819, 0.59], [986, 0.77]] },
  }),
  // the same kind of side photo (transparent around the gun, so the model's
  // own colour fills where the silhouettes differ)
  skin('awp', 'Medusa', 'covert', 'gem', ['#0e1a1d'], {
    image: '/textures/medusa.png', fit: 'decal', metal: 0.35, rough: 0.4,
    decal: { left: 0, right: 1260, bottom: 238, sy: 1.28, pins: [[752, 0.59], [873, 0.77]] },
  }),
  // Classified (the painted-in-code headliners moved down: Covert is for texture skins)
  skin('ak47', 'Dragon Fire', 'classified', 'flames', ['#140707', '#b3140f', '#ff6a00', '#ffd23f'], { metal: 0.3 }),
  skin('awp', 'Neo Dragon', 'classified', 'neon', ['#0b0616', '#ff2bd6', '#8a2bff', '#2be4ff']),
  skin('m4a4', 'Solar Flare', 'classified', 'geometric', ['#f4f1ea', '#15171b', '#ff6a1a', '#15171b'], { tag: 'SOL-4' }),
  skin('deagle', 'Blaze', 'classified', 'fade', ['#ffe066', '#ff8a00', '#ff2a00', '#6b0000'], { metal: 0.75, rough: 0.28 }),
  skin('m4a1s', 'Hyper Violet', 'classified', 'splatter', ['#1a0f2e', '#ff2e97', '#39ff14', '#00e5ff', '#fff200']),
  skin('ak47', 'Neon Revolution', 'classified', 'neon', ['#0a0a12', '#ff3ea5', '#18f2ff', '#fffb00']),
  skin('usp', 'Cortex Pink', 'classified', 'circuit', ['#2a0b22', '#ff4fb8', '#ffe3f5']),
  skin('awp', 'Aurora', 'classified', 'aurora', ['#05091c', '#14f1b6', '#6b5bff', '#ff4fd8']),
  skin('glock', 'Fade', 'classified', 'fade', ['#fff27a', '#ff7ad9', '#9b5bff', '#3b3bff'], { metal: 0.8, rough: 0.25 }),
  skin('mp9', 'Hydra', 'classified', 'waves', ['#031a2b', '#0ff0ff', '#0b8fff', '#004b9c', '#9ef8ff']),
  skin('galil', 'Cerberus', 'classified', 'flames', ['#0c0303', '#6b0f1a', '#ff3b1f', '#ffd24a'], { metal: 0.3 }),
  skin('ssg08', 'Blood in the Water', 'classified', 'waves', ['#02121c', '#0b4f6c', '#01baef', '#c1121f', '#fbfbff']),
  skin('p250', 'Splash Jam', 'classified', 'splatter', ['#f7f7f2', '#ff006e', '#3a86ff', '#ffbe0b', '#8338ec']),
  skin('mp9', 'Starlight', 'classified', 'neon', ['#070b1a', '#ffd166', '#06d6a0', '#ef476f']),
  // Restricted
  skin('m4a1s', 'Cyrex', 'restricted', 'geometric', ['#f2f2f2', '#c8102e', '#1b1b1b', '#c8102e'], { tag: 'CYREX' }),
  skin('famas', 'Mecha Orange', 'restricted', 'hex', ['#ff7a00', '#3a1a00', '#ffd08a']),
  skin('galil', 'Toxic Lime', 'restricted', 'stripes', ['#b6ff00', '#121212', '#b6ff00', '#2a2a2a']),
  skin('deagle', 'Ocean Drive', 'restricted', 'waves', ['#073b4c', '#06d6a0', '#ff5d8f', '#118ab2', '#ffd166']),
  skin('p250', 'Violet Hex', 'restricted', 'hex', ['#2d0a4e', '#8f2bff', '#e0b3ff']),
  skin('ak47', 'Tartan Riot', 'restricted', 'tartan', ['#3a0d0d', '#e03c31', '#f2c14e', '#111111']),
  skin('m4a1s', 'Halftone Sunset', 'restricted', 'halftone', ['#2a0f3d', '#ff7a3d']),
  skin('awp', 'Neon Topo', 'restricted', 'topo', ['#050816', '#00f0ff']),
  skin('usp', 'Orion Chevron', 'restricted', 'chevron', ['#0a1a3a', '#4fd1ff', '#ffffff']),
  skin('glock', 'Cheetah', 'restricted', 'leopard', ['#f2b134', '#241507', '#ffe3a3']),
  skin('mac10', 'Pixel Pop', 'restricted', 'digital', ['#2be4ff', '#8a5bff', '#ff4fd8', '#1b0f3a']),
  skin('ump', 'Grand Prix', 'restricted', 'stripes', ['#ffcc00', '#111111', '#ffcc00', '#e10600']),
  skin('famas', 'Aqua Hex', 'restricted', 'hex', ['#003b46', '#07575b', '#66fcf1']),
  skin('scar20', 'Crimson Carbon', 'restricted', 'carbon', ['#1a0607', '#561a1f', '#ff2a3a'], { metal: 0.5, rough: 0.35 }),
  skin('g3sg1', 'Mint Aurora', 'restricted', 'aurora', ['#04121a', '#2cf5a1', '#4fd1ff']),
  // Mil-Spec
  skin('ak47', 'Urban Pixel', 'milspec', 'digital', ['#d7d9dc', '#9aa0a8', '#5d636b', '#2c3036']),
  skin('m4a4', 'Desert Storm', 'milspec', 'digital', ['#e3cf9e', '#c2a36b', '#8c6d3f', '#5a4526']),
  skin('famas', 'Carbon Weave', 'milspec', 'carbon', ['#1d1f23', '#5c636e'], { metal: 0.45, rough: 0.35 }),
  skin('p250', 'Sand Dune', 'milspec', 'topo', ['#e8d3a8', '#7a4a18']),
  skin('mac10', 'Highland', 'milspec', 'tartan', ['#1e3a5f', '#b3202a', '#f2e6c9', '#0f1d30']),
  skin('galil', 'Rally Chevron', 'milspec', 'chevron', ['#101820', '#fee715', '#101820']),
  skin('ump', 'Leopard', 'milspec', 'leopard', ['#d9a55b', '#3b2412', '#f2d3a0']),
  skin('scar20', 'Contour', 'milspec', 'topo', ['#2f3b2a', '#9bc36b']),
  skin('g3sg1', 'Polar Pixel', 'milspec', 'digital', ['#f4f8fb', '#c9d8e6', '#8aa6c1', '#4c6a8a']),
  skin('glock', 'Bubblegum Dots', 'milspec', 'halftone', ['#ffe3ef', '#ff3e8e']),
  skin('mp9', 'Red Line Carbon', 'milspec', 'carbon', ['#1d0d0f', '#522529', '#e0202e'], { metal: 0.45, rough: 0.35 }),
  skin('ssg08', 'Mint Chevron', 'milspec', 'chevron', ['#e9fff6', '#28c7a0', '#0c5c4a']),
  skin('deagle', 'Midnight Topo', 'milspec', 'topo', ['#0b1026', '#4f7cff']),
  skin('awp', 'Pit Viper', 'milspec', 'scales', ['#1c2b12', '#b8e06a', '#4e7a24']),
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
  blackPearl: { name: 'Doppler Black Pearl', pattern: 'doppler', pal: ['#07030d', '#241146', '#6437b5', '#d24c9c', '#3d6ad0'], metal: 0.75, rough: 0.14, iridescent: true },
  caseHardened: { name: 'Case Hardened', pattern: 'caseHardened', pal: ['#3f86e0'], seeded: true, metal: 0.8, rough: 0.24 },
  // gems: photographs of the stone (public/textures), painted by paintGem
  gemRuby: { name: 'Ruby', pattern: 'gem', image: '/textures/ruby.jpg', pal: ['#b0142e'], ...GEM_LOOK.ruby },
  gemSapphire: { name: 'Sapphire', pattern: 'gem', image: '/textures/sapphire.jpg', pal: ['#1f4fd6'], ...GEM_LOOK.sapphire },
  gemEmerald: { name: 'Emerald', pattern: 'gem', image: '/textures/emerald.jpg', pal: ['#12a866'], ...GEM_LOOK.emerald },
  rust: { name: 'Rust Coat', pattern: 'gem', image: '/textures/rust.jpg', pal: ['#8a4a22'], metal: 0.45, rough: 0.8, sat: 1.1, contrast: 1.05, gloss: false },
}

/* `band`: how tall the blade sits on the artwork, so a banner finish (Lore)
   spans the blade exactly once. */
export const KNIFE_TYPES = {
  karambit: { name: 'Karambit', band: 1 },
  flip: { name: 'Flip Knife', band: 0.31 },
  huntsman: { name: 'Huntsman Knife', band: 0.35 },
  skeleton: { name: 'Skeleton Knife', band: 0.4 },
  stiletto: { name: 'Stiletto Knife', band: 0.2 },
  bowie: { name: 'Bowie Knife', band: 0.45 },
}

const MODEL_TYPES = new Set(['karambit', 'huntsman', 'bowie', 'skeleton'])

const knife = (type, finish) => ({
  id: `knife_${type}_${finish}`,
  kind: 'knife', knife: type, tier: 'gold',
  name: FINISH[finish].name,
  weaponName: `★ ${KNIFE_TYPES[type].name}`,
  seed: seed++,
  band: KNIFE_TYPES[type].band,
  ...FINISH[finish],
  // these lines are real models now: the finish goes on the model's blade
  ...(MODEL_TYPES.has(type) && { model: true, finish: true }),
})

export const KNIFE_SKINS = [
  knife('karambit', 'fade'), knife('karambit', 'sapphire'), knife('karambit', 'marble'), knife('karambit', 'tiger'),
  knife('flip', 'ruby'), knife('flip', 'web'), knife('flip', 'gamma'),
  knife('huntsman', 'slaughter'), knife('huntsman', 'emerald'), knife('huntsman', 'doppler'),
  // every knife comes in every gem, Case Hardened and Rust Coat
  ...['karambit', 'flip', 'huntsman'].flatMap(t => ['gemRuby', 'gemSapphire', 'gemEmerald', 'caseHardened', 'rust', 'blackPearl'].map(f => knife(t, f))),
  // the newer lines, each in the headline finishes
  ...['skeleton', 'stiletto', 'bowie'].flatMap(t =>
    ['fade', 'doppler', 'slaughter', 'tiger', 'gemRuby', 'gemSapphire', 'gemEmerald', 'caseHardened', 'blackPearl'].map(f => knife(t, f))),
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
  ...['gemEmerald', 'gemRuby', 'gemSapphire', 'caseHardened', 'blackPearl'].map(f => modelKnife('bfly', '★ Butterfly Knife', f)),
  ...['gemEmerald', 'gemRuby', 'gemSapphire', 'caseHardened', 'blackPearl'].map(f => modelKnife('m9a', '★ M9 Bayonet', f)),
]

/* Guns added later go last, so every earlier item keeps its seed (and look). */
const LATE_GUN_SKINS = [
  skin('p90', 'Neon Grid', 'restricted', 'circuit', ['#07071a', '#ff2bd6', '#2bf0ff']),
  skin('p90', 'Sand Spray', 'milspec', 'camo', ['#e3cf9e', '#b08a52', '#6e5431', '#3d2e1b']),
  // the PLGK anniversary cards (year of the snake, year of the horse): the
  // card's navy as the ground, its picture set mid-gun, mirrored to read
  // right on the side you see (the snake stands upright, rising tail to head)
  skin('m4a4', 'Kỉ niệm 2025', 'covert', 'gem', ['#23395b'], {
    id: 'm4a4_plgk_2025',
    // cut out, so the ground shows through round the snake
    image: '/textures/plgk_2025.png', fit: 'overlay', base: 'solid', metal: 0.35, rough: 0.4,
    emblems: [{ crop: [0, 0, 1, 1], at: [0.54, 0.21], h: 0.66, flip: true }],
  }),
  skin('m4a4', 'Kỉ niệm 2026', 'covert', 'gem', ['#253a5b'], {   // sampled off the card, so no seam
    id: 'm4a4_plgk_2026',
    image: '/textures/plgk_2026.jpg', fit: 'overlay', base: 'solid', metal: 0.3, rough: 0.45,
    emblems: [{ crop: [0, 0, 1, 1], at: [0.58, 0.3], h: 0.58, flip: true }],
  }),
]

export const ITEMS = [...GUN_SKINS, ...KNIFE_SKINS, ...MODEL_KNIVES, ...LATE_GUN_SKINS]
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
  deagle_water_lilies: 'usp_water_lilies',
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
