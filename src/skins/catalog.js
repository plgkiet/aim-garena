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
  { slug: 'milspec', label: 'Mil-Spec', vi: 'Quân dụng', color: '#4b69ff', odds: 37.26 },
  { slug: 'restricted', label: 'Restricted', vi: 'Hạn chế', color: '#8847ff', odds: 32 },
  { slug: 'classified', label: 'Classified', vi: 'Tối mật', color: '#d32ce6', odds: 23.74 }   /* far more generous than CS's 3.2 / 0.64: asked for */,
  { slug: 'covert', label: 'Covert', vi: 'Tuyệt mật', color: '#eb4b4b', odds: 5 },
  { slug: 'gold', label: '★ Rare Special', vi: 'Cực hiếm', color: '#e4ae39', odds: 2 },
  // above everything, like the Howl after 2014: never in a case, never traded up to
  { slug: 'contraband', label: 'Contraband', vi: 'Hàng lậu', color: '#ff8a00', odds: 0, noDrop: true },
]
export const tierBySlug = slug => TIERS.find(t => t.slug === slug) || TIERS[0]
export const TIER_COLOR = Object.fromEntries(TIERS.map(t => [t.slug, t.color]))

/* The three stones, lifted from their dark photos into bright, glassy
   colour: brighter and richer paint, a clearcoat and a thin-film shimmer
   (see skinMaterial) so they catch the light like cut gems. */
const GEM_LOOK = {
  ruby: { bright: 1.45, sat: 1.5, contrast: 1.1, hue: -8, metal: 0.35, rough: 0.12, iridescent: true },
  // the picture is the blade of the M9 model itself (its violet-indigo), so
  // every Sapphire matches that knife; shown nearly as it is
  sapphire: { bright: 1.2, sat: 1.15, contrast: 1.05, metal: 0.35, rough: 0.12, iridescent: true },
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
  skin('m4a4', 'Doraemon Murakami', 'covert', 'gem', ['#e9d9f0'], {
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
    // (set a little high, so the face sits mid-way up the gun's side, across
    // the slide and frame, instead of down on the frame's lower edge)
    layout: { plain: true, u0: 0, u1: 1, v0: 0.2, v1: 1.08, cropV: [0.37, 1], flip: true },
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
  skin('glock', 'Maneki-neko', 'covert', 'gem', ['#e9dcc2'], {
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
  skin('m4a1s', 'Anti Social Social Club', 'covert', 'gem', ['#f4f3ef'], {
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
  // Gold Arabesque: a side photo of the real skin laid on like Wild Lotus,
  // pinned at the same landmarks: gold metal, the carved dark furniture
  skin('ak47', 'Gold Arabesque', 'covert', 'gem', ['#c9a227'], {
    image: '/textures/gold_arabesque.png', fit: 'decal', metal: 0.75, rough: 0.32,
    decal: { left: 20, right: 1475, bottom: 440, sy: 1.05, bleed: 24, pins: [[68, 0.075], [238, 0.224], [625, 0.423], [820, 0.569], [988, 0.608], [1063, 0.681], [1075, 0.733]] },
    // four Katowice 2014 stickers along the side: one on the handguard,
    // three down the receiver
    emblems: [
      { image: '/textures/sticker_navi_kato14.png', crop: [0.08, 0.1, 0.92, 0.9], h: 0.105, flip: true, at: [0.315, 0.482] },
      { image: '/textures/sticker_navi_kato14.png', crop: [0.08, 0.1, 0.92, 0.9], h: 0.105, flip: true, at: [0.47, 0.482] },
      { image: '/textures/sticker_navi_kato14.png', crop: [0.08, 0.1, 0.92, 0.9], h: 0.105, flip: true, at: [0.565, 0.482] },
      { image: '/textures/sticker_navi_kato14.png', crop: [0.08, 0.1, 0.92, 0.9], h: 0.105, flip: true, at: [0.66, 0.482] },
    ],
    // the other side: the same photo, its stickers unmirrored so they read
    // right from there too
    back: {
      emblems: [
        { image: '/textures/sticker_navi_kato14.png', crop: [0.08, 0.1, 0.92, 0.9], h: 0.105, at: [0.315, 0.482] },
        { image: '/textures/sticker_navi_kato14.png', crop: [0.08, 0.1, 0.92, 0.9], h: 0.105, at: [0.47, 0.482] },
        { image: '/textures/sticker_navi_kato14.png', crop: [0.08, 0.1, 0.92, 0.9], h: 0.105, at: [0.565, 0.482] },
        { image: '/textures/sticker_navi_kato14.png', crop: [0.08, 0.1, 0.92, 0.9], h: 0.105, at: [0.66, 0.482] },
      ],
    },
  }),
  // a side photo of the real skin laid on muzzle to butt, like Fire Serpent,
  // pinned landmark by landmark onto the model (measured off the photo's
  // outline and the model's UVs): front sight, handguard front, the
  // magazine's front and back, the grip, the stock; bled outward so parts
  // standing proud of the photo's outline still wear its colours
  skin('ak47', 'Wild Lotus', 'covert', 'gem', ['#1f8a80'], {
    image: '/textures/wild_lotus.png', fit: 'decal', metal: 0.2, rough: 0.5,
    decal: { left: 50, right: 1012, bottom: 284, sy: 1.05, bleed: 24, pins: [[82, 0.075], [195, 0.224], [440, 0.423], [580, 0.569], [690, 0.608], [740, 0.681], [748, 0.733]] },
  }),
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
    // pinned on this photo's own landmarks: the forend's front edge, the
    // magazine and the thumbhole each land on the model's, so the snakes run
    // along the forend and the face sits whole on the stock behind the hole
    decal: { left: 0, right: 1260, bottom: 238, sy: 1.28, pins: [[505, 0.301], [818, 0.587], [1010, 0.771]] },
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
  // Doppler and Gamma Doppler come in phases, rolled when the knife drops (see PHASES)
  doppler: { name: 'Doppler', pattern: 'doppler', pal: ['#0a0212', '#3b0a52', '#c1128c', '#ff5bd1', '#1b1f5a'], metal: 0.85, rough: 0.2, seeded: true, phased: 'doppler' },
  ruby: { name: 'Doppler Ruby', pattern: 'doppler', pal: ['#1a0003', '#6e0010', '#e0102c', '#ff4d5e', '#3a0008'], metal: 0.9, rough: 0.18 },
  sapphire: { name: 'Doppler Sapphire', pattern: 'doppler', pal: ['#0a0524', '#2a148f', '#4b2fe0', '#b4a8ff', '#160a52'], metal: 0.9, rough: 0.18 },
  // the emerald phase of a Gamma Doppler, shown under the family's name
  emerald: { name: 'Gamma Doppler', pattern: 'doppler', pal: ['#001207', '#00471f', '#00c853', '#7dff9c', '#002a12'], metal: 0.9, rough: 0.18 },
  gamma: { name: 'Gamma Doppler', pattern: 'doppler', pal: ['#02140a', '#0b5e3a', '#2cf5a1', '#b8ff3b', '#083b28'], metal: 0.85, rough: 0.2, seeded: true, phased: 'gamma' },
  marble: { name: 'Marble Fade', pattern: 'marble', pal: ['#ffe600', '#ff2a00', '#fff4c2', '#1f4fff', '#ffe600'], metal: 0.85, rough: 0.22 },
  tiger: { name: 'Tiger Tooth', pattern: 'tiger', pal: ['#fff2b0', '#e8a317', '#3b1d00'], metal: 0.95, rough: 0.2 },
  web: { name: 'Crimson Web', pattern: 'web', pal: ['#b3121b', '#0b0000'], metal: 0.35, rough: 0.4 },
  slaughter: { name: 'Slaughter', pattern: 'slaughter', pal: ['#ffd0dc', '#ff5a7a', '#c0122e', '#ffe6ea'], metal: 0.75, rough: 0.25 },
  // every drop gets its own pattern number; see variantOf
  blackPearl: { name: 'Doppler Black Pearl', pattern: 'doppler', pal: ['#07030d', '#241146', '#6437b5', '#d24c9c', '#3d6ad0'], metal: 0.75, rough: 0.14, iridescent: true },
  caseHardened: { name: 'Case Hardened', pattern: 'caseHardened', pal: ['#3f86e0'], seeded: true, metal: 0.8, rough: 0.24 },
  // gems: photographs of the stone (public/textures), painted by paintGem
  gemRuby: { name: 'Ruby', pattern: 'gem', image: '/textures/ruby.jpg', pal: ['#b0142e'], ...GEM_LOOK.ruby },
  gemSapphire: { name: 'Sapphire', pattern: 'gem', image: '/textures/sapphire.jpg', pal: ['#4b2fe0'], ...GEM_LOOK.sapphire },
  gemEmerald: { name: 'Emerald', pattern: 'gem', image: '/textures/emerald.jpg', pal: ['#12a866'], ...GEM_LOOK.emerald },
  // MixiGaming fan art, two-sided: the whole squad lined up along the blade
  // on one side, the goose with the knife on the other
  mixi: {
    name: 'MixiGaming FanArt', pattern: 'gem', image: '/textures/mixi_squad.jpg', fit: 'band', pal: ['#d6d6da'], metal: 0.25, rough: 0.4,
    layout: { plain: true, u0: 0.4, u1: 1, v0: -0.015, v1: 0.27, crop: [0.05, 0.97], cropV: [0.25, 0.78] },
    back: {
      image: '/textures/mixi_goose_knife.jpg', pal: ['#0f2a55'],
      layout: { plain: true, u0: 0.4, u1: 1, v0: 0.05, v1: 0.35, crop: [0.18, 0.92], cropV: [0.26, 0.72] },
    },
  },
  // Lore: each knife wears the blade of its own real Lore, cut from a side
  // photo and fitted onto the model's blade (see LORE_ART below); only the
  // knives that have a photo come in it
  lore: { name: 'Lore', pattern: 'gem', fit: 'band', pal: ['#e3b01f'], metal: 0.85, rough: 0.25, bladeFit: true },
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

/* The blade's rectangle in each Lore photo (fractions of the picture):
   `crop` along it, `cropV` across it (fitted so the photo's outline falls on
   the model's, hence the odd figures and the ones just outside 0..1); `flip` / `flipV` turn it to the way
   the model's blade runs. */
const LORE_ART = {
  m9a: { file: 'm9', crop: [0.391, 1.006], cropV: [0.336, 0.78] },
  bfly: { file: 'butterfly', crop: [0.478, 1.017], cropV: [0.115, 0.732], align: true },
  flip: { file: 'flip', crop: [0.464, 0.997], cropV: [0.04, 0.87], flipV: true },
  // the model is this very knife: the whole photo is lined up on the whole
  // model (`whole`) and the blade takes its part of it; the outline is grown
  // a little (`bleed`) so the rim never reads the photo's empty background
  huntsman: { file: 'huntsman', whole: true, bleed: 6, flipV: true, crop: [-0.01, 0.992], cropV: [-0.057, 0.928] },
  karambit: { file: 'karambit', whole: true, bleed: 6, flipV: true, crop: [-0.027, 0.942], cropV: [-0.011, 1.09] },
}
const loreOf = type => {
  const { file, align, whole, ...cut } = LORE_ART[type]
  return { alignBlade: !!align, polarBlade: !!cut.polar, wholeKnife: !!whole, image: `/textures/lore_${file}.png`, layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 1, ...cut } }
}

const MODEL_TYPES = new Set(['karambit', 'huntsman', 'bowie', 'skeleton'])

const knife = (type, finish, fixedSeed) => ({
  id: `knife_${type}_${finish}`,
  kind: 'knife', knife: type, tier: 'gold',
  name: FINISH[finish].name,
  weaponName: `★ ${KNIFE_TYPES[type].name}`,
  seed: fixedSeed ?? seed++,
  band: KNIFE_TYPES[type].band,
  ...FINISH[finish],
  ...(finish === 'lore' && loreOf(type)),
  // these lines are real models now: the finish goes on the model's blade
  ...(MODEL_TYPES.has(type) && { model: true, finish: true }),
})

/* Which knives come in Doppler and in Gamma Doppler, after CS: every one of
   these has a Doppler; the Gamma Doppler is on the Gamma-case knives
   (Karambit, Flip, M9 Bayonet) and the Riptide ones (Butterfly, Huntsman,
   Bowie), not on the Skeleton or the Stiletto. */
const DOPPLER_KNIVES = ['karambit', 'flip', 'huntsman', 'skeleton', 'stiletto', 'bowie', 'bfly', 'm9a']
const GAMMA_KNIVES = ['karambit', 'flip', 'huntsman', 'bowie', 'bfly', 'm9a']
/* The stones were items of their own once (Ruby, Sapphire, Emerald, Black
   Pearl, on every knife, and three Dopplers in one colour). They are phases
   of the Doppler now: still built below, in their old places, so every other
   skin keeps the seed (and so the look) it always had, then left out. */
const STONE = /_(gemRuby|gemSapphire|gemEmerald|blackPearl|ruby|sapphire|emerald)$/
const notStone = it => !STONE.test(it.id)

export const KNIFE_SKINS = [
  knife('karambit', 'fade'), knife('karambit', 'sapphire'), knife('karambit', 'marble'), knife('karambit', 'tiger'),
  knife('flip', 'ruby'), knife('flip', 'web'), knife('flip', 'gamma'),
  knife('huntsman', 'slaughter'), knife('huntsman', 'emerald'), knife('huntsman', 'doppler'),
  // every knife comes in every gem, Case Hardened and Rust Coat
  ...['karambit', 'flip', 'huntsman'].flatMap(t => ['gemRuby', 'gemSapphire', 'gemEmerald', 'caseHardened', 'rust', 'blackPearl', 'lore'].map(f => knife(t, f))),
  // the newer lines, each in the headline finishes
  ...['skeleton', 'stiletto', 'bowie'].flatMap(t =>
    ['fade', 'doppler', 'slaughter', 'tiger', 'gemRuby', 'gemSapphire', 'gemEmerald', 'caseHardened', 'blackPearl'].map(f => knife(t, f))),
  // the Dopplers and Gamma Dopplers the knives above did not have yet
  ...['karambit', 'flip'].map((t, i) => knife(t, 'doppler', 9100 + i)),
  ...['karambit', 'huntsman', 'bowie'].map((t, i) => knife(t, 'gamma', 9200 + i)),
].filter(notStone)

/* The original model knives can drop too (their finish is baked into the file). */
/* The Butterfly's own model with a finish painted on its blade: the stones and
   Case Hardened. `finish` marks a model knife whose blade gets repainted. */
const modelKnife = (type, weaponName, f, fixedSeed) => ({
  id: `knife_${type}_${f}`, kind: 'knife', knife: type, tier: 'gold', weaponName, model: true,
  seed: fixedSeed ?? seed++, ...FINISH[f], ...(f === 'lore' && loreOf(type)), finish: true,
})

export const MODEL_KNIVES = [
  // (the M9 Bayonet's own Sapphire look is no item of its own: it is the
  // Sapphire phase of the M9 Doppler, see variantOf)
  { id: 'knife_m9b', kind: 'knife', knife: 'm9b', tier: 'gold', weaponName: '★ M9 Bayonet', name: 'Autotronic', model: true },
  { id: 'knife_bfly', kind: 'knife', knife: 'bfly', tier: 'gold', weaponName: '★ Butterfly Knife', name: 'Crimson Web', model: true },
  ...['gemEmerald', 'gemRuby', 'gemSapphire', 'caseHardened', 'blackPearl', 'lore'].map(f => modelKnife('bfly', '★ Butterfly Knife', f)),
  // (no painted Sapphire: the M9's own look is the Sapphire)
  ...['gemEmerald', 'gemRuby', 'caseHardened', 'blackPearl', 'lore', 'mixi'].map(f => modelKnife('m9a', '★ M9 Bayonet', f)),
  // the special one: a Bearbrick in the Jiangshi (cương thi) livery, held as a knife
  { id: 'knife_racket', kind: 'knife', knife: 'racket', tier: 'gold', weaponName: '★ Badminton Racket', name: 'Vợt Cầu Lông', model: true },
  { id: 'knife_iphone', kind: 'knife', knife: 'iphone', tier: 'gold', weaponName: '★ iPhone', name: 'Burgundy Red', model: true },
  { id: 'knife_bearbrick_jiangshi', kind: 'knife', knife: 'bearbrick', tier: 'gold', weaponName: '★ Bearbrick', name: 'Cương Thi', model: true },
  modelKnife('bfly', '★ Butterfly Knife', 'doppler', 9300), modelKnife('bfly', '★ Butterfly Knife', 'gamma', 9301),
  modelKnife('m9a', '★ M9 Bayonet', 'doppler', 9302), modelKnife('m9a', '★ M9 Bayonet', 'gamma', 9303),
].filter(notStone)

/* The phases. A Doppler or a Gamma Doppler is one item; what you hold is that
   item at a phase, rolled when it drops and kept on the drop as its pattern
   number, exactly as a Case Hardened keeps its pattern. Phases 1-4 are the
   mixes (an ordinary roll lands on one of them, evenly); the stones after
   them are the jackpots: they only come out of the 0.03% draw (isJackpot). */
const mix = (pal) => ({ pattern: 'doppler', pal, metal: 0.85, rough: 0.2 })
export const PHASES = {
  doppler: [
    { label: 'Phase 1', look: mix(['#050308', '#1a0b2e', '#5a1470', '#b0309a', '#120a24']) },   // mostly black, a little purple
    { label: 'Phase 2', look: mix(['#1a0420', '#6a0f6a', '#e0189a', '#ff7ad8', '#3a1060']) },   // pink
    { label: 'Phase 3', look: mix(['#04101c', '#0d3a6a', '#1f7fd0', '#5fe0c0', '#0a2440']) },   // blue with green in it
    { label: 'Phase 4', look: mix(['#050a28', '#1a2a9a', '#3558ff', '#9ab8ff', '#101a60']) },   // blue
    { label: 'Ruby', rare: true, look: FINISH.gemRuby },
    { label: 'Sapphire', rare: true, look: FINISH.gemSapphire },
    { label: 'Black Pearl', rare: true, look: FINISH.blackPearl },
  ],
  gamma: [
    { label: 'Phase 1', look: mix(['#020a06', '#0a3020', '#167a48', '#3fc080', '#04180e']) },   // dark green
    { label: 'Phase 2', look: mix(['#02140a', '#0b5e3a', '#2cf5a1', '#b8ff3b', '#083b28']) },   // bright green
    { label: 'Phase 3', look: mix(['#03121a', '#0a4a5a', '#18b0a8', '#7af0d0', '#062a3a']) },   // green into teal
    { label: 'Phase 4', look: mix(['#041020', '#0c3a7a', '#1a9ad0', '#70e0f0', '#082048']) },   // teal and blue
    { label: 'Emerald', rare: true, look: FINISH.gemEmerald },
  ],
}
const MIX_PHASES = 4
const phaseNo = (family, label) => PHASES[family].findIndex(p => p.label === label) + 1

/* Guns added later go last, so every earlier item keeps its seed (and look). */
const LATE_GUN_SKINS = [
  skin('p90', 'Neon Grid', 'restricted', 'circuit', ['#07071a', '#ff2bd6', '#2bf0ff']),
  skin('p90', 'Sand Spray', 'milspec', 'camo', ['#e3cf9e', '#b08a52', '#6e5431', '#3d2e1b']),
  // the PLGK anniversary cards (year of the snake, year of the horse): the
  // card's navy as the ground, its picture set mid-gun, mirrored to read
  // right on the side you see (the snake stands upright, rising tail to head)
  skin('m4a4', 'Kỉ niệm Tết 2025', 'contraband', 'gem', ['#23395b'], {
    id: 'm4a4_plgk_2025',
    // cut out, so the ground shows through round the snake
    image: '/textures/plgk_2025.png', fit: 'overlay', base: 'solid', metal: 0.35, rough: 0.4,
    emblems: [
      { crop: [0, 0, 1, 1], at: [0.54, 0.21], h: 0.66, flip: true },
      { image: '/textures/plgk_signature.png', crop: [0, 0, 1, 1], at: [0.885, 0.44], h: 0.12, flip: true, tint: '#e9c46a', bold: 4 },   // the signature on the stock
    ],
  }),
  skin('m4a4', 'Kỉ niệm Tết 2026', 'contraband', 'gem', ['#253a5b'], {   // sampled off the card, so no seam
    id: 'm4a4_plgk_2026',
    image: '/textures/plgk_2026.jpg', fit: 'overlay', base: 'solid', metal: 0.3, rough: 0.45,
    emblems: [
      { crop: [0, 0, 1, 1], at: [0.58, 0.3], h: 0.58, flip: true },
      { image: '/textures/plgk_signature.png', crop: [0, 0, 1, 1], at: [0.885, 0.44], h: 0.12, flip: true, tint: '#e9c46a', bold: 4 },   // the signature on the stock
    ],
  }),
  // Dior's oblique monogram, tiled over the whole P90
  skin('p90', 'Dior Oblique', 'covert', 'gem', ['#f2f2f2'], {
    image: '/textures/dior.jpg', fit: 'tile', tile: 0.8, metal: 0.1, rough: 0.55,
  }),
  // Off-White: black, two lengths of the yellow industrial tape crossed in
  // an X over the middle of the gun (as on the brand's own packaging), the
  // crossed arrows on the stock and the label text along the handguard
  skin('m4a4', 'Off-White', 'covert', 'gem', ['#0b0b0c'], {
    image: '/textures/offwhite_tape.jpg', fit: 'overlay', base: 'solid', metal: 0.3, rough: 0.45,
    emblems: [
      { crop: [0, 0, 1, 1], at: [0.56, 0.4], h: 0.1, w: 0.5, rot: 0.42, flip: true },
      { crop: [0, 0, 1, 1], at: [0.56, 0.4], h: 0.1, w: 0.5, rot: -0.42, flip: true },
      { image: '/textures/offwhite_logo.jpg', crop: [0, 0, 1, 1], at: [0.87, 0.44], h: 0.17 },
    ],
    texts: [
      { text: 'Off-White™  "M4A4"  c. 2026', at: [0.21, 0.46], h: 0.045, weight: 400, font: 'Arial, Helvetica, sans-serif', color: '#f2f2f2', flip: true },
    ],
  }),
  // the Mona Lisa's face and hands on the receiver, the painting's own hazy
  // landscape tiled over the rest of the gun so the whole of it is one picture
  skin('m4a1s', 'Mona Lisa', 'covert', 'gem', ['#2c3122'], {
    image: '/textures/mona_lisa.jpg', fit: 'tile', tile: 0.53, tileCrop: [0, 0.2, 0.26, 0.56], tileFlip: true, metal: 0.15, rough: 0.55,
    emblem: { crop: [0.2, 0.1, 0.8, 0.62], at: [0.6, 0.27], h: 0.5, flip: true },
  }),
  // Hermès, composed rather than wallpapered: the house orange all over, the
  // collage itself framed on the stock like a panel, the wordmark on the
  // handguard, the duc-carriage on the receiver and more of the collage over
  // the magazine (mirrored to read right on the side you see)
  skin('ak47', 'Hermès', 'covert', 'gem', ['#f26a1b'], {
    id: 'ak47_hermes',
    image: '/textures/hermes.jpg', fit: 'overlay', base: 'solid', metal: 0.2, rough: 0.45,
    emblems: [
      { crop: [0.08, 0.31, 0.92, 0.62], at: [0.86, 0.3], h: 0.46, w: 0.3, flip: true },   // the collage on the stock
      { crop: [0.3, 0.55, 0.75, 0.8], at: [0.497, 0.19], h: 0.42, w: 0.175, flip: true },    // the collage over the whole magazine (under the logos)
      // the wordmark and the duc-carriage from the clean logo (transparent PNG)
      { image: '/textures/hermes_logo.png', crop: [0.015, 0.45, 0.995, 0.77], at: [0.338, 0.47], h: 0.06, flip: true },   // HERMÈS, clear of the receiver
      { image: '/textures/hermes_logo.png', crop: [0.21, 0, 0.77, 0.43], at: [0.57, 0.465], h: 0.095, flip: true },   // the carriage (horse's head and all), mid-receiver
    ],
  }),
  // Billionaire Boys Club on the Deagle: black, the whole pop-art painting set
  // on the grip like a framed print, the arched white wordmark along the slide
  skin('deagle', 'Billionaire Boys Club', 'covert', 'gem', ['#060606'], {
    id: 'deagle_bbc',
    image: '/textures/bbc_art.jpg', fit: 'overlay', base: 'solid', metal: 0.25, rough: 0.45, vSpan: 1.6, paintChrome: true,
    emblems: [
      { crop: [0, 0, 1, 1], at: [0.84, 0.3], h: 0.56, flip: true },
      { image: '/textures/bbc_logo.jpg', crop: [0.05, 0.28, 0.97, 0.76], at: [0.42, 0.8], h: 0.36, flip: true },
    ],
  }),
  // Travis Scott (Cactus Jack): one strip of the poster laid over the whole
  // P90, cut to its 2.6:1 side through the three glowing blue eyes
  skin('p90', 'Cactus Jack V1', 'covert', 'gem', ['#1a1a1a'], {
    id: 'p90_cactus_jack',   // its id from before it was V1, so drops keep it
    image: '/textures/travis_scott.jpg', fit: 'band', metal: 0.2, rough: 0.5,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.76, cropV: [0.33, 0.645], flip: true },
  }),
  // V2: the Takashi Murakami x Cactus Jack poster, the same way: one strip
  // through the sepia monster's eyes and teeth over the whole gun
  skin('p90', 'Cactus Jack V2', 'covert', 'gem', ['#5a3a26'], {
    id: 'p90_cactus_jack_v2',
    image: '/textures/travis_scott_v2.jpg', fit: 'band', metal: 0.2, rough: 0.5,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.76, cropV: [0.36, 0.664], flip: true },
  }),
  // KAWS on the Glock: the half-dissected Companion over its graffiti wall, a
  // square around the head and torso (the Glock's side is about square once
  // squeezed with vSpan, as for the Lucky Cat)
  // Gamma Doppler, on the slide only (the frame stays black). Phased like the
  // knives' (PHASES.gamma): a drop is one of the four mixes, or, from the
  // jackpot draw, the Emerald — which is what this skin was before the phases
  skin('glock', 'Gamma Doppler', 'covert', 'doppler', ['#02140a', '#0b5e3a', '#2cf5a1', '#b8ff3b', '#083b28'], {
    id: 'glock_gamma_doppler', slideOnly: true, metal: 0.85, rough: 0.2, seeded: true, phased: 'gamma',
  }),
  skin('glock', 'KAWS', 'covert', 'gem', ['#1c1c1c'], {
    image: '/textures/kaws.jpg', fit: 'band', metal: 0.15, rough: 0.5, vSpan: 2,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.97, crop: [0.17, 0.83], cropV: [0.05, 0.52], flip: true },
  }),
  // The Weeknd, two-sided: After Hours on the right side (the one you see in
  // hand), The Idol on the left, each a strip through the face cut to the
  // M4A4's 3.3:1 side (the back is left unmirrored, so it reads right from there)
  skin('m4a4', 'The Weeknd', 'covert', 'gem', ['#2a2230'], {
    image: '/textures/weeknd_after_hours.jpg', fit: 'band', metal: 0.2, rough: 0.5,
    layout: { plain: true, u0: 0.15, u1: 0.85, v0: 0, v1: 0.61, cropV: [0.28, 0.715], flip: true, fill: [0, 0.3, 0.26, 0.72] },   // the whole face, eyes on the receiver; flowers and serpents beyond
    back: {
      image: '/textures/weeknd_idol.jpg', pal: ['#dfe8f2'],
      layout: { plain: true, u0: 0.15, u1: 0.85, v0: 0, v1: 0.61, crop: [0.16, 0.8], cropV: [0.37, 0.648], flip: false, fill: [0.165, 0.3, 0.29, 0.66] },
    },
  }),
  // CR7 x Man Utd: one strip of the poster over the M4A4, through the big
  // CRISTIANO RONALDO lettering and the red slashes either side of it
  skin('m4a4', 'CR7 x Man Utd', 'covert', 'gem', ['#120f10'], {
    id: 'm4a4_cr7_manutd',
    image: '/textures/cr7_manutd.jpg', fit: 'band', metal: 0.2, rough: 0.5,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.61, crop: [0.04, 0.96], cropV: [0.35, 0.64], flip: true },   // mirrored to read right on your side
    // the stock takes a higher cut of the poster: Ronaldo's red No. 7 shirt
    emblems: [{ crop: [0.04, 0.27, 0.2424, 0.56], at: [0.89, 0.305], h: 0.61, w: 0.22, flip: true }],
    // the other side: the poster's bottom row (Berbatov 9, Ronaldo 7, Rooney
    // 10, Sir Alex), left unmirrored so it reads right from that side
    back: {
      layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 0.61, crop: [0, 1], cropV: [0.72, 1], flip: false },
      emblems: [],
    },
  }),
  // MixiGaming fan art on the Deagle, two-sided, each picture at its own
  // aspect across the whole side (faces on the slide): the family walk under
  // the ginkgo on your side, the two geese at the haunted church on the
  // other (unmirrored, so it reads right from there); the logo on the grip
  skin('deagle', 'MixiGaming FanArt', 'covert', 'gem', ['#e9b949'], {
    id: 'deagle_mixigaming',
    image: '/textures/mixi_walk.jpg', fit: 'band', metal: 0.15, rough: 0.5, vSpan: 2, paintChrome: true,
    layout: { plain: true, u0: 0, u1: 1, v0: 0.3, v1: 0.805, fill: [0, 0.82, 1, 1], fillH: 0.25, fillRows: true, flip: true },
    emblems: [{ image: '/textures/mixi_logo.png', crop: [0.1, 0.2, 0.93, 0.85], at: [0.905, 0.27], h: 0.075, disc: null, flip: true }],
    back: {
      image: '/textures/mixi_halloween.jpg', pal: ['#5a1f7a'],
      layout: { plain: true, u0: 0, u1: 1, v0: 0.29, v1: 0.81, crop: [0.02, 0.98], cropV: [0.4, 0.9], fill: [0.38, 0.6, 0.62, 0.78], fillH: 0.25, fillRows: true, flip: false },
      emblems: [{ image: '/textures/mixi_logo.png', crop: [0.1, 0.2, 0.93, 0.85], at: [0.905, 0.27], h: 0.075 }],
    },
  }),
  // MixiGaming, two-sided, fan art at its own aspect: the family in the red
  // car outrunning zombies on your side (small enough that all five faces
  // sit along the receiver and handguard, the car below), the city behind, the
  // two geese in the neon alley on the other (left unmirrored so it reads
  // right from there); the logo on the stock of both
  skin('m4a4', 'MixiGaming FanArt', 'covert', 'gem', ['#b8a7c4'], {
    id: 'm4a4_mixigaming',
    image: '/textures/mixi_family.jpg', fit: 'band', metal: 0.15, rough: 0.5,
    layout: { plain: true, u0: 0.29, u1: 0.79, v0: 0.04, v1: 0.6, fill: [0, 0.22, 0.24, 0.6], fillH: 0.3, fillRows: true, flip: true },
    emblems: [{ image: '/textures/mixi_logo.png', crop: [0.1, 0.2, 0.93, 0.85], at: [0.892, 0.445], h: 0.11, flip: true }],
    back: {
      image: '/textures/mixi_goose.jpg', pal: ['#1d2a6b'],
      layout: { plain: true, u0: 0.34, u1: 1.14, v0: -0.161, v1: 0.739, fill: [0.55, 0, 0.75, 0.3], fillRows: true, flip: false },
      emblems: [{ image: '/textures/mixi_logo.png', crop: [0.1, 0.2, 0.93, 0.85], at: [0.892, 0.445], h: 0.11 }],
    },
  }),
  // Magikarp leaping up the waterfall: one strip of the scratch-art card over
  // the whole P90, the fish on the body with the falls and the night jungle
  skin('p90', 'Magikarp', 'covert', 'gem', ['#0c0d10'], {
    id: 'p90_magikarp',
    image: '/textures/magikarp.jpg', fit: 'band', metal: 0.2, rough: 0.45,
    // the picture at its own aspect (not stretched), placed so the fish sits
    // mid-body between the thumbholes; the falls below it, tiled and
    // mirrored, cover the butt and the muzzle end
    layout: { plain: true, u0: 0.086, u1: 0.616, v0: 0, v1: 0.76, crop: [0, 1], cropV: [0.02, 0.52], fill: [0, 0.55, 1, 1], flip: true },
  }),
  // a coffee farm in watercolour (banana palms, terraced rows, the hacienda
  // under the mountains): the whole painting end to end at its own aspect,
  // a small siren logo in the middle of the body
  skin('famas', 'Starbucks', 'covert', 'gem', ['#2f6b45'], {
    id: 'famas_starbucks_vn',
    image: '/textures/starbucks_farm.jpg', fit: 'band', metal: 0.1, rough: 0.5,
    layout: { plain: true, u0: 0, u1: 1, v0: 0, v1: 1, flip: true },
    emblems: [{ image: '/textures/starbucks_logo.png', crop: [0, 0, 1, 1], at: [0.635, 0.43], h: 0.12, disc: '#ffffff', flip: true }],
  }),
  // a red 911 in thick abstract paint: the painting at its own aspect with
  // the car along the receiver, its red and gold strokes round the rest
  skin('scar20', '911', 'covert', 'gem', ['#1a0d0b'], {
    id: 'scar20_911',
    image: '/textures/porsche_911.jpg', fit: 'band', metal: 0.25, rough: 0.45,
    layout: {
      plain: true, u0: 0.401, u1: 0.745, v0: 0.073, v1: 0.761,
      fill: [0, 0.05, 0.45, 0.45], fillRows: true, flip: true,
    },
  }),
  // a red F40 down a dirt road under a summer sky: the painting at its own
  // aspect with the whole car on the body, the dirt road round the rest
  skin('ump', 'F40', 'covert', 'gem', ['#b8864f'], {
    id: 'ump_f40',
    image: '/textures/ferrari_f40.jpg', fit: 'band', metal: 0.2, rough: 0.5,
    layout: {
      plain: true, u0: 0.068, u1: 0.715, v0: 0.275, v1: 1.248,
      fill: [0, 0.75, 1, 0.9], fillRows: true, flip: true,
    },
  }),
  // Đông Hồ woodblock prints, two-sided, each at its own aspect over the
  // receiver (its top row of figures there, the rest down the magazine and
  // grips): the Rat's Wedding on your side, the Rats' Dragon Procession on
  // the other (left unmirrored so it reads right from there)
  skin('ump', 'Tranh Đông Hồ', 'covert', 'gem', ['#efe2c2'], {
    id: 'ump_dong_ho',
    image: '/textures/dongho_wedding.jpg', fit: 'band', metal: 0.05, rough: 0.7,
    layout: { plain: true, u0: 0.092, u1: 0.668, v0: -0.005, v1: 0.867, fill: [0.02, 0.6, 0.35, 0.97], fillH: 0.5, fillRows: true, flip: true },
    back: {
      image: '/textures/dongho_dragon.jpg', pal: ['#e6c98f'],
      layout: { plain: true, u0: 0.02, u1: 0.668, v0: -0.005, v1: 0.867, fill: [0.02, 0.52, 0.3, 0.97], fillH: 0.5, fillRows: true, flip: false },
    },
  }),
  // Dalí's The Persistence of Memory at its own aspect along the M4A1-S: the
  // clock draped on the table over the stock, the sleeping figure with its
  // clock on the receiver, the cliffs toward the suppressor; the sea and sky
  // beyond
  skin('m4a1s', 'The Persistence of Memory', 'covert', 'gem', ['#5a3a1c'], {
    id: 'm4a1s_persistence_of_memory',
    image: '/textures/dali_memory.jpg', fit: 'band', metal: 0.15, rough: 0.5,
    layout: { plain: true, u0: 0.23, u1: 1, v0: 0.072, v1: 0.937, fill: [0.6, 0.12, 1, 0.33], fillH: 0.3, fillRows: true, flip: true },
  }),
  // Charizard over the lava field, mid-gun at its own aspect: the head and
  // the fire it breathes along the receiver (the flame toward the muzzle),
  // the glowing belly down the magazine; the lava field round the rest
  skin('ak47', 'Charizard', 'covert', 'gem', ['#2a1210'], {
    id: 'ak47_charizard',
    image: '/textures/charizard.jpg', fit: 'band', metal: 0.2, rough: 0.5,
    layout: {
      plain: true, u0: 0.408, u1: 0.721, v0: -0.338, v1: 0.617, crop: [0, 0.82],
      fill: [0, 0.8, 1, 1], fillRows: true, flip: true,
    },
  }),
  // the Pokémon 30th-celebration Pikachu (Shinji Kanda): Pikachu from the
  // ears to the raised paws fills the receiver side at its own aspect, the
  // flower meadow from the bottom of the picture runs down the grip
  skin('mac10', 'Pikachu 30th', 'covert', 'gem', ['#f2c419'], {
    id: 'mac10_pikachu',
    // vSpan: the MAC-10 is short and tall, so its sides run past the top of
    // a texture spanned by half its length; spread v over 1.5x that
    image: '/textures/pikachu_30th.jpg', fit: 'band', metal: 0.15, rough: 0.5, vSpan: 1.5,
    layout: {
      plain: true, u0: 0.232, u1: 0.712, v0: 0.542, v1: 0.771, cropV: [0.03, 0.62],
      fill: [0, 0.62, 0.32, 1], fillStretch: 1.72, fillRows: true, flip: true,
    },
  }),
  // Bulbasaur and a sleeping Snorlax in the forest: one strip of the picture
  // over the SCAR-20, the two of them on the body
  skin('scar20', 'Bulbasaur and Snorlax', 'covert', 'gem', ['#3f7a32'], {
    id: 'scar20_forest_nap',
    image: '/textures/pokemon_forest.jpg', fit: 'band', metal: 0.15, rough: 0.55,
    layout: { plain: true, u0: 0.24, u1: 0.8, v0: 0, v1: 0.5, crop: [0.16, 0.92], cropV: [0.33, 0.84], fill: [0, 0.82, 1, 1], flip: true },
  }),
  // Pollock's drip painting, tiled over the P90 without its white margin
  skin('p90', 'Number 5', 'covert', 'gem', ['#6b4a2c'], {
    image: '/textures/pollock.jpg', fit: 'tile', tile: 0.8, tileCrop: [0.04, 0.03, 0.96, 0.97], metal: 0.15, rough: 0.6,
  }),
  // (last in the list, so no other skin's seed moves)
  // Case Hardened on two more guns (rolled and named like the AK's: a pattern
  // number each, Blue Gem when it comes out all blue). The MAC-10 wears it all
  // over; on the Five-SeveN only the slide is steel, the frame stays polymer
  skin('mac10', 'Case Hardened', 'covert', 'caseHardened', ['#3f86e0'], { seed: 9400, seeded: true, metalOnly: true, metal: 0.75, rough: 0.26 }),
  skin('fiveseven', 'Case Hardened', 'covert', 'caseHardened', ['#3f86e0'], { seed: 9401, seeded: true, slideOnly: true, metal: 0.75, rough: 0.26 }),
]

/* Gloves: a ★ rare special like the knives, worn on both hands in first
   person (see skins/gloves.js for how each cut is painted). */
const GLOVE_TYPES = { sport: 'Sport Gloves', moto: 'Moto Gloves', specialist: 'Specialist Gloves', driver: 'Driver Gloves' }
const glove = (type, name, spec) => ({
  id: `glove_${type}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
  kind: 'glove', tier: 'gold', weaponName: `★ ${GLOVE_TYPES[type]}`, name,
  glove: { type, ...spec },
})
export const GLOVES = [
  glove('sport', "Pandora's Box", {
    finger: '#6a35ff', finger2: '#8a5bff', panel: '#2a1d4f', mesh: 'rgba(150,120,255,0.35)', dash: '#c9c4ff',
    frame: '#1b1440', pad: '#24183f', cuff: '#5a2ee6', trim: '#1b1440',
  }),
  glove('sport', 'Hedge Maze', {
    finger: '#78e01c', finger2: '#9cf03a', panel: '#1b2628', mesh: 'rgba(110,200,190,0.3)', dash: '#a8e8de',
    frame: '#d9dde2', pad: '#c9ced4', cuff: '#e8ebee', trim: '#78e01c',
  }),
  glove('sport', 'Ultra Violent', {
    finger: '#b03cff', finger2: '#3d8bff', panel: '#3f78e8', mesh: 'rgba(170,220,255,0.4)', dash: '#e6ff3a',
    frame: '#e6ff3a', pad: '#8a3cff', cuff: '#7a46ff', trim: '#e6ff3a',
  }),
  glove('sport', 'Vice', {
    finger: '#e8459a', finger2: '#f070b4', panel: '#5d6b62', tri: true, mesh: 'rgba(25,32,30,0.55)', dash: '#4fd6e0',
    frame: '#e8459a', pad: '#4fd6e0', cuff: '#e8459a', trim: '#4fd6e0',
  }),
  // MixiGaming: black and red, a fan art on the back of each hand (the camel
  // ride on the left, Mixi at his desk on the right)
  glove('sport', 'MixiGaming FanArt', {
    finger: '#17171a', finger2: '#a51c24', tip: '#c8202a', panel: '#17171a', mesh: 'rgba(200,32,42,0.28)', dash: 'rgba(0,0,0,0)',
    frame: '#c8202a', pad: '#222226', cuff: '#17171a', trim: '#c8202a',
    logo: {
      left: { src: '/textures/mixi_glove_l.jpg', crop: [0, 0.1, 1, 0.82], size: 0.5, shift: -0.08, across: -0.01 },
      right: { src: '/textures/mixi_glove_r.jpg', crop: [0.3, 0.215, 0.9, 0.765], size: 0.5, shift: -0.08, across: -0.01 },
    },
  }),
  // Amphibious: sky-blue fingers, a pond-skin print of deep blue cells ringed
  // in pale blue down the back, white dashes, white frame and wrist
  glove('sport', 'Amphibious', {
    finger: '#1f5fd6', finger2: '#2f74e8', panel: '#1f4fd8', blobs: ['#1a2cc0', '#2238cc', '#4a3cc8', '#1634a8'], mesh: '#4fb0f0', dash: '#ffffff',
    frame: '#e9eef6', pad: '#2458d8', cuff: '#e9eef6', trim: '#1f5fd6', seed: 9,
  }),
  // Omega: slate-grey leather, a moulded triangle mesh down the back with
  // gold dashes, and yellow at the frame, the knuckles and the wrist
  glove('sport', 'Omega', {
    finger: '#23282b', finger2: '#394043', panel: '#1c2124', tri: true, mesh: 'rgba(120,150,158,0.7)', dash: '#d99a00',
    frame: '#d99a00', pad: '#2a2f32', cuff: '#d99a00', trim: '#1c2124',
  }),
  glove('driver', 'King Snake', {
    finger: '#d6cfbb', panel: '#8f8877', scales: ['#3e3a33', '#857e6d', '#d6d0bf'], pad: '#c9a85a',
    cuff: '#d6cfbb', trim: '#a89f88', seed: 5,
  }),
  glove('moto', 'Spearmint', {
    finger: '#eef1f3', panel: '#7fd6cf', camo: ['#3fb8b0', '#a9ece6', '#e8faf8', '#2c8f8a', '#5ccac2'], stroke: '#e0453a',
    pad: '#1c1d20', cuff: '#2a2c30', trim: '#7fd6cf', seed: 11,
  }),
  // Polygon: navy leather fingers and a hard navy knuckle guard over a print
  // of cut squares in blues, with a pale seam swept across it
  glove('moto', 'Polygon', {
    finger: '#232f7c', panel: '#3f7ae6', poly: ['#3f7ae6', '#5b93f2', '#243a9e', '#2f5fd0', '#6aa2f5', '#1f2f86'], stroke: '#a9c4f2',
    pad: '#2238a6', cuff: '#2a47b8', trim: '#5b93f2', seed: 4,
  }),
  // Emerald Web: deep green leather strung with pale webs, lime ribs down the
  // back and lime fingers, gunmetal pads and wrist
  glove('specialist', 'Emerald Web', {
    finger: '#2f9a00', finger2: '#4cc000', tip: '#3c3f3e', panel: '#1a5a0a', web: 'rgba(120,220,50,0.7)', dash: '#58d000',
    frame: '#6f7472', pad: '#484c4d', cuff: '#34383a', trim: '#4cc000', seed: 6,
  }),
  glove('specialist', 'Crimson Kimono', {
    finger: '#d4243c', finger2: '#e2334a', panel: '#c81f37', mesh: 'rgba(40,10,40,0.45)', dash: '#2a1f4a',
    pad: '#2a1f4a', cuff: '#2a1f4a', trim: '#d4243c',
  }),
]

export const ITEMS = [...GUN_SKINS, ...KNIFE_SKINS, ...MODEL_KNIVES, ...GLOVES, ...LATE_GUN_SKINS]
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
  // the stones are phases of the Doppler / Gamma Doppler now. A knife with no
  // Gamma Doppler (Skeleton, Stiletto) keeps its Emerald as a Sapphire Doppler
  ...Object.fromEntries(DOPPLER_KNIVES.flatMap(t => {
    const d = label => ({ id: `knife_${t}_doppler`, pattern: phaseNo('doppler', label) })
    const emerald = GAMMA_KNIVES.includes(t) ? { id: `knife_${t}_gamma`, pattern: phaseNo('gamma', 'Emerald') } : d('Sapphire')
    return [
      [`knife_${t}_gemRuby`, d('Ruby')], [`knife_${t}_ruby`, d('Ruby')],
      [`knife_${t}_gemSapphire`, d('Sapphire')], [`knife_${t}_sapphire`, d('Sapphire')],
      [`knife_${t}_blackPearl`, d('Black Pearl')],
      [`knife_${t}_gemEmerald`, emerald], [`knife_${t}_emerald`, emerald],
    ]
  })),
  // the M9 Bayonet whose file is the Sapphire: that phase of the M9 Doppler
  knife_m9a: { id: 'knife_m9a_doppler', pattern: phaseNo('doppler', 'Sapphire') },
}

/* Drops from before a finish had phases carry no phase: this is the one they
   get (the Glock's Gamma Doppler was the Emerald, and stays it). */
export const LEGACY_PATTERN = { glock_gamma_doppler: 5 }

/* Pattern-seeded finishes (Case Hardened). The catalog item is the finish;
   what you hold is that finish at one pattern number, 1-1000, rolled when it
   drops. The variant carries its own id so its texture and picture are its
   own, and is named Blue Gem when the pattern came out nearly all blue. */
export const PATTERN_MAX = 1000

/* Blue Gems. A pattern number is a gem or it is not (caseHardenedInfo). A
   Case Hardened gun is a gem BLUE_GEM_CHANCE of the time. The knives' roll is
   then weighted so that a Blue Gem knife (all of them together) drops no
   more often than a Blue Gem gun (all of them together), and never at a
   higher rate per knife than a gun's. */
/* How often a Case Hardened drop is a Blue Gem. 33 of the 1000 pattern numbers
   are gems (3.3% if every number were as likely); the roll is weighted down
   to this instead, which leaves the patterns themselves, and so every drop
   already in an inventory, exactly as they were. */
export const BLUE_GEM_CHANCE = 0.013
let gemTable = null
function gemOdds() {
  if (gemTable) return gemTable
  const gems = [], plain = []
  for (let n = 1; n <= PATTERN_MAX; n++) (caseHardenedInfo(n).gem ? gems : plain).push(n)
  const base = BLUE_GEM_CHANCE
  // how often a case gives a Case Hardened gun, and a Case Hardened knife
  const perCase = kind => {
    let p = 0
    for (const slug of ['covert', 'gold']) {
      const pool = CASE.items.filter(i => i.tier === slug)
      const rest = pool.filter(i => !isJackpot(i))
      const mine = rest.filter(i => i.pattern === 'caseHardened' && i.kind === kind).length
      if (mine) p += (tierBySlug(slug).odds - (JACKPOT_ODDS[slug] ?? 0)) * mine / rest.length
    }
    return p
  }
  const gun = perCase('gun'), knifeP = perCase('knife')
  gemTable = { gems, plain, gun: base, knife: knifeP > 0 && gun > 0 ? Math.min(base, base * gun / knifeP) : base }
  return gemTable
}

/** TEST helper: every top-rarity variant there is, as [item id, pattern]
 *  pairs: each Doppler on its Ruby, Sapphire and Black Pearl, each Gamma
 *  Doppler on its Emerald, and each Case Hardened on a Blue Gem pattern (a
 *  different gem pattern for each, so they do not all look the same). */
export function rarestDrops() {
  const gems = gemOdds().gems
  let k = 0
  return ITEMS.flatMap(it => {
    if (it.phased) return PHASES[it.phased].flatMap((p, i) => (p.rare ? [[it.id, i + 1]] : []))
    if (it.pattern === 'caseHardened' && gems.length) return [[it.id, gems[k++ % gems.length]]]
    return []
  })
}

/** A pattern number for a Case Hardened drop (see above for the knives). */
export function rollPattern(item) {
  // a Doppler: one of the mixes, evenly (the stones come from the jackpot draw)
  if (item?.phased) return 1 + Math.floor(Math.random() * MIX_PHASES)
  const t = gemOdds()
  if (!t.gems.length || !t.plain.length) return 1 + Math.floor(Math.random() * PATTERN_MAX)
  const from = Math.random() < (item?.kind === 'knife' ? t.knife : t.gun) ? t.gems : t.plain
  return from[Math.floor(Math.random() * from.length)]
}

export function variantOf(item, patternNo) {
  if (!item?.seeded || !patternNo) return item
  if (item.phased) {
    const P = PHASES[item.phased]
    // (a drop from before the phases carries any number: it falls on a mix)
    const n = patternNo >= 1 && patternNo <= P.length ? patternNo : 1 + ((patternNo - 1) % MIX_PHASES)
    const ph = P[n - 1]
    return {
      ...item, ...ph.look,
      id: `${item.id}#${n}`, baseId: item.id, patternNo: n,
      seed: item.seed * 7 + n * 131,
      phase: ph.label, gem: !!ph.rare,
      name: `${FINISH[item.phased].name} (${ph.label})`,
      detail: ph.rare ? `💎 ${ph.label}` : ph.label,
      // the M9 Bayonet's model file is a Sapphire as it comes: that phase
      // shows the file's own blade instead of a painted one
      ...(item.knife === 'm9a' && item.phased === 'doppler' && ph.label === 'Sapphire' && { finish: false }),
    }
  }
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
  // Contraband never comes out of a case
  items: ITEMS.filter(i => !TIERS.find(t => t.slug === i.tier)?.noDrop),
}

/* The jackpots: the rarest drops of their grade. Inside ★ Rare Special
   (2% a case) the stones (a Doppler on its Ruby, Sapphire or Black Pearl
   phase, a Gamma Doppler on its Emerald), the
   Bearbrick Cương Thi and every pair of gloves come out 0.03% of cases between them, the other knives the
   remaining 1.97%. Inside Covert (5%) the six grails (Howl, Fire Serpent,
   Dragon Lore, Gungnir, Wild Lotus, Gold Arabesque) and the Glock's Gamma
   Doppler on its Emerald come out 0.03% between
   them, the other Coverts 4.97%. The grade's own total is unchanged. */
const JACKPOT_GUNS = new Set(['m4a4_howl', 'ak47_fire_serpent', 'awp_dragon_lore', 'awp_gungnir', 'ak47_wild_lotus', 'ak47_gold_arabesque'])
const JACKPOT_KNIFE = /\b(ruby|sapphire|emerald|black pearl)\b/i
export const JACKPOT_ODDS = { gold: 0.03, covert: 0.03 }
export function isJackpot(it) {
  const id = it.baseId || it.id
  // a phased finish (a knife's, the Glock's) is a jackpot only on a stone
  // phase; the bare catalog item is not
  if (it.phased) return !!it.gem
  if (it.tier === 'covert') return JACKPOT_GUNS.has(id)
  if (it.tier !== 'gold') return false
  return it.kind === 'glove' || id === 'knife_bearbrick_jiangshi' || (it.kind === 'knife' && JACKPOT_KNIFE.test(it.name))
}
/** A phased knife at each of its stone phases: the jackpot draw picks among these. */
const stonesOf = it => (it.phased ? PHASES[it.phased].flatMap((p, i) => (p.rare ? [variantOf(it, i + 1)] : [])) : [])

/** One item of a grade: the jackpots get only their share of the grade. */
function pickInTier(slug, items) {
  const pool = items.filter(i => i.tier === slug)
  const tier = tierBySlug(slug)
  const share = JACKPOT_ODDS[slug] != null && tier.odds > 0 ? JACKPOT_ODDS[slug] / tier.odds : null
  if (share != null) {
    // (a stone comes back as the knife already at that phase: `patternNo` set)
    const rare = [...pool.filter(isJackpot), ...pool.flatMap(stonesOf)], rest = pool.filter(i => !isJackpot(i))
    if (rare.length && rest.length) {
      const from = Math.random() < share ? rare : rest
      return from[Math.floor(Math.random() * from.length)]
    }
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Weighted draw: pick a tier by the case odds, then an item inside it. */
export function drawItem(items = CASE.items) {
  const total = TIERS.reduce((s, t) => s + t.odds, 0)
  let p = Math.random() * total
  let tier = TIERS[0]
  for (const t of TIERS) { p -= t.odds; if (p < 0) { tier = t; break } }
  return pickInTier(tier.slug, items)
}

/* Trade up, as in CS:GO: five drops of one grade go in, one drop of the next
   grade up comes out, any item of that grade with equal chance. Five Coverts
   make a knife. */
export const TRADE_COUNT = 5
export function nextTier(slug) {
  const i = TIERS.findIndex(t => t.slug === slug)
  const up = i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null
  return up && !up.noDrop ? up : null
}
export function drawFromTier(slug, items = CASE.items) {
  // a trade up lands on a jackpot no more often than a case would
  return pickInTier(slug, items)
}

export const fullName = it => it.kind === 'knife' || it.kind === 'glove' ? `${it.weaponName} | ${it.name}` : null
