import * as THREE from 'three'

/* Glove finishes, painted in code onto the first-person hand rig (HandRig):
   the rig's palm block is the back of the glove, its finger capsules the
   fingers, its cuff the wrist strap. A finish is a few colours and a cut:

     sport       bright fingers, a dark breathable mesh down the back of the
                 hand with rows of reflective dashes along each finger, a
                 contrasting frame round the panel (Pandora's Box, Hedge Maze);
                 `blobs` prints ringed pond-skin cells for the mesh (Amphibious)
     moto        white fingers, a printed back panel (shards of camo with a
                 stroke across it) under a hard black knuckle guard (Spearmint);
                 `poly` prints a grid of cut squares instead (Polygon)
     specialist  one colour all over, perforated, with ribbed stripes of a
                 second colour down the back (Crimson Kimono); `web` strings
                 spider webs over it in place of the perforation (Emerald Web)
     driver      perforated leather fingers and a snakeskin back (King Snake)

   Each item gets its own small canvases, made once and kept. */

const SIZE = 256
const cache = new Map()

function canvas(draw) {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  draw(c.getContext('2d'))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// a seeded random, so a glove's camo is the same every time it is drawn
function rand(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function dots(g, color, step, r) {
  g.fillStyle = color
  for (let y = 0; y < SIZE + step; y += step)
    for (let x = (y / step) % 2 ? step / 2 : 0; x < SIZE + step; x += step) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
    }
}

/* The back of the hand. On the palm block's outer face u runs along the
   hand (wrist to knuckles) and v across it, so a row along a finger is a
   horizontal line here. */
function panelTexture(G) {
  return canvas(g => {
    g.fillStyle = G.panel; g.fillRect(0, 0, SIZE, SIZE)
    if (G.type === 'moto' && G.poly) {
      // Polygon: a grid of squares, each cut corner to corner (or into a
      // smaller square and its corners) and filled in a few shades of one colour
      const r = rand(G.seed ?? 7)
      const n = 16, pick = () => G.poly[(r() * G.poly.length) | 0]
      for (let y = 0; y < SIZE; y += n) for (let x = 0; x < SIZE; x += n) {
        g.fillStyle = pick(); g.fillRect(x, y, n, n)
        const k = r()
        g.fillStyle = pick()
        g.beginPath()
        if (k < 0.3) { g.moveTo(x, y); g.lineTo(x + n, y); g.lineTo(x, y + n) }
        else if (k < 0.6) { g.moveTo(x + n, y); g.lineTo(x + n, y + n); g.lineTo(x, y + n) }
        else if (k < 0.8) { g.moveTo(x, y); g.lineTo(x + n, y + n); g.lineTo(x, y + n) }
        else { g.moveTo(x + n / 2, y); g.lineTo(x + n, y + n / 2); g.lineTo(x + n / 2, y + n); g.lineTo(x, y + n / 2) }
        g.closePath(); g.fill()
      }
      // the pale seam that sweeps across the back of the hand under the guard
      if (G.stroke) {
        g.strokeStyle = G.stroke; g.lineWidth = 7; g.lineCap = 'round'
        g.beginPath(); g.moveTo(SIZE * 0.42, 14); g.quadraticCurveTo(SIZE * 0.3, SIZE * 0.5, SIZE * 0.46, SIZE - 14); g.stroke()
      }
    } else if (G.type === 'moto') {
      // camo shards, then the stroke across them
      const r = rand(G.seed ?? 7)
      for (let i = 0; i < 90; i++) {
        g.fillStyle = G.camo[i % G.camo.length]
        const x = r() * SIZE, y = r() * SIZE, s = 18 + r() * 40
        g.beginPath(); g.moveTo(x, y)
        g.lineTo(x + s, y + (r() - 0.5) * s * 0.6); g.lineTo(x + s * (0.4 + r() * 0.5), y + s * 0.7); g.closePath(); g.fill()
      }
      g.strokeStyle = G.stroke; g.lineWidth = 9; g.lineCap = 'round'
      g.beginPath(); g.moveTo(20, SIZE * 0.72); g.quadraticCurveTo(SIZE * 0.5, SIZE * 0.35, SIZE - 30, SIZE * 0.4); g.stroke()
    } else if (G.type === 'driver') {
      // snakeskin: rows of overlapping scales, mottled light and dark
      const r = rand(G.seed ?? 3)
      const w = 16, h = 11
      for (let row = -1; row * h < SIZE + h; row++)
        for (let col = -1; col * w < SIZE + w; col++) {
          const x = col * w + (row % 2 ? w / 2 : 0), y = row * h
          const blot = Math.sin(x * 0.03 + r() * 0.6) + Math.cos(y * 0.045)
          g.fillStyle = G.scales[(blot > 0.6 ? 2 : blot > -0.4 ? 1 : 0) + (r() < 0.15 ? 0 : 0)]
          g.beginPath(); g.ellipse(x, y, w * 0.56, h * 0.75, 0, 0, Math.PI); g.fill()
          g.strokeStyle = 'rgba(40,36,30,0.35)'; g.lineWidth = 1; g.stroke()
        }
    } else if (G.type === 'specialist') {
      if (G.web) {
        // Emerald Web: fine pale webs over the leather, a few of them, each
        // spokes out from a centre with sagging threads strung between
        const r = rand(G.seed ?? 6)
        g.strokeStyle = G.web; g.lineCap = 'round'
        for (let k = 0; k < 3; k++) {
          const cx = r() * SIZE, cy = r() * SIZE, n = 9 + ((r() * 5) | 0), a0 = r() * Math.PI
          const ang = Array.from({ length: n }, (_, i) => a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.25)
          g.lineWidth = 1.5
          for (const a of ang) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * SIZE, cy + Math.sin(a) * SIZE); g.stroke() }
          g.lineWidth = 1
          for (let ring = 20 + r() * 10; ring < SIZE * 0.8; ring += 22 + r() * 18)
            for (let i = 0; i < n; i++) {
              const a = ang[i], b = ang[(i + 1) % n] + (i === n - 1 ? Math.PI * 2 : 0), m = (a + b) / 2
              g.beginPath(); g.moveTo(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring)
              g.quadraticCurveTo(cx + Math.cos(m) * ring * 0.86, cy + Math.sin(m) * ring * 0.86, cx + Math.cos(b) * ring, cy + Math.sin(b) * ring)
              g.stroke()
            }
        }
      } else dots(g, G.mesh, 9, 1.8)
      // ribbed stripes along the fingers
      g.fillStyle = G.dash
      for (let i = 0; i < 4; i++) g.fillRect(0, SIZE * (0.17 + i * 0.22), SIZE, 10)
    } else {
      // sport: breathable mesh (dots, or a moulded triangle grid), then the
      // reflective dashes, one row per finger
      if (G.blobs) {
        // Amphibious: a pond-skin print, rounded cells of a deeper colour,
        // each ringed in a pale line, some with a smaller ring inside
        const r = rand(G.seed ?? 5)
        for (let i = 0; i < 150; i++) {
          const x = r() * SIZE, y = r() * SIZE, a = 7 + r() * 17, b = a * (0.55 + r() * 0.5)
          g.beginPath(); g.ellipse(x, y, a, b, r() * Math.PI, 0, Math.PI * 2)
          g.fillStyle = G.blobs[(r() * G.blobs.length) | 0]; g.fill()
          g.strokeStyle = G.mesh; g.lineWidth = 2; g.stroke()
          if (r() < 0.4) { g.beginPath(); g.ellipse(x, y, a * 0.4, b * 0.4, 0, 0, Math.PI * 2); g.stroke() }
        }
      } else if (G.tri) {
        g.strokeStyle = G.mesh; g.lineWidth = 1.4
        for (let y = 0; y < SIZE; y += 10) for (let x = (y / 10) % 2 ? 6 : 0; x < SIZE; x += 12) {
          g.beginPath(); g.moveTo(x, y + 9); g.lineTo(x + 6, y + 1); g.lineTo(x + 12, y + 9); g.closePath(); g.stroke()
        }
      } else dots(g, G.mesh, 7, 2.1)
      g.fillStyle = G.dash
      for (let i = 0; i < 4; i++) {
        const y = SIZE * (0.16 + i * 0.225)
        for (let x = 14; x < SIZE - 20; x += 46) {
          g.beginPath(); g.roundRect(x, y - 3, 30, 6, 3); g.fill()
        }
      }
    }
    // the frame round the panel
    if (G.frame) { g.strokeStyle = G.frame; g.lineWidth = 22; g.strokeRect(0, 0, SIZE, SIZE) }
  })
}

/* Fingers: the capsule's v runs along the finger. A second colour fades in
   toward the tip, and sport and specialist gloves are perforated. */
function fingerTexture(G) {
  return canvas(g => {
    const gr = g.createLinearGradient(0, SIZE, 0, 0)
    gr.addColorStop(0, G.finger); gr.addColorStop(1, G.finger2 ?? G.finger)
    g.fillStyle = gr; g.fillRect(0, 0, SIZE, SIZE)
    if (G.type !== 'moto') dots(g, G.type === 'driver' ? 'rgba(60,50,40,0.35)' : 'rgba(0,0,0,0.16)', 12, G.type === 'driver' ? 2 : 1.6)
  })
}

/* The wrist strap: its own colour with a trim line near each edge. */
function cuffTexture(G) {
  return canvas(g => {
    g.fillStyle = G.cuff; g.fillRect(0, 0, SIZE, SIZE)
    if (G.trim) {
      g.fillStyle = G.trim
      g.fillRect(0, SIZE * 0.12, SIZE, 14)
      g.fillRect(0, SIZE * 0.8, SIZE, 14)
    }
  })
}

/* `logo`: a picture set on the back of the hand once it has loaded, turned
   so it stands upright when the fingers point up (the panel's u runs along
   the hand). `logo.crop` [x0, y0, x1, y1] picks the part of the file. */
const logoWaits = new WeakMap()
/** Resolves once the pictures on a glove's hands (built already) are painted in. */
export const gloveReady = item => Promise.all(logoWaits.get(item.glove) ?? [])
function withLogo(tex, G, side) {
  if (!G.logo) return tex
  // `logo.left` / `logo.right`: a different picture on each hand
  const L = G.logo[side] ?? G.logo
  const img = new Image()
  let done
  if (!logoWaits.has(G)) logoWaits.set(G, [])
  logoWaits.get(G).push(new Promise(res => { done = res }))
  img.onerror = () => done()
  img.onload = () => {
    const g = tex.image.getContext('2d')
    const [x0, y0, x1, y1] = L.crop ?? [0, 0, 1, 1]
    const sw = (x1 - x0) * img.width, sh = (y1 - y0) * img.height
    const size = SIZE * (L.size ?? 0.62)
    // a stitched-on patch: the picture cut to a rounded card with a light
    // border, slid along the hand (`shift`, negative toward the wrist) so the knuckle pad clears it
    const w = size, h = size * sh / sw
    g.save()
    // `across` nudges it across the hand, to sit centred on the panel that shows
    g.translate(SIZE / 2 + (L.shift ?? 0) * SIZE, SIZE / 2 + (L.across ?? 0) * SIZE)
    g.rotate((L.turn ?? 1) * Math.PI / 2)
    // the left hand is the right one mirrored: mirror its picture back
    if (side === 'left') g.scale(-1, 1)
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 14); g.closePath()
    g.save(); g.clip()
    g.drawImage(img, x0 * img.width, y0 * img.height, sw, sh, -w / 2, -h / 2, w, h)
    g.restore()
    g.lineWidth = 6; g.strokeStyle = L.border ?? '#f4f1ea'; g.stroke()
    g.restore()
    tex.needsUpdate = true
    done()
  }
  img.src = L.src
  return tex
}

/** The rig materials for a glove item: finger, fingertip, back panel, pads, cuff. */
export function gloveMaterials(item, side = 'right') {
  // a glove with a picture per hand gets its own materials for each
  const key = item.glove.logo?.left ? `${item.id}:${side}` : item.id
  if (cache.has(key)) return cache.get(key)
  const G = item.glove
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.05, ...o })
  const finger = std({ map: fingerTexture(G) })
  const M = {
    glove: finger,
    tip: G.tip ? std({ color: G.tip }) : finger,
    panel: std({ map: withLogo(panelTexture(G), G, side), roughness: 0.7 }),
    pad: std({ color: G.pad, roughness: G.type === 'moto' ? 0.35 : 0.6, metalness: G.type === 'moto' ? 0.2 : 0.05 }),
    cuff: std({ map: cuffTexture(G) }),
  }
  cache.set(key, M)
  return M
}
