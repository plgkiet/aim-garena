import * as THREE from 'three'

/* Glove finishes, painted in code onto the first-person hand rig (HandRig):
   the rig's palm block is the back of the glove, its finger capsules the
   fingers, its cuff the wrist strap. A finish is a few colours and a cut:

     sport       bright fingers, a dark breathable mesh down the back of the
                 hand with rows of reflective dashes along each finger, a
                 contrasting frame round the panel (Pandora's Box, Hedge Maze)
     moto        white fingers, a printed back panel (shards of camo with a
                 stroke across it) under a hard black knuckle guard (Spearmint)
     specialist  one colour all over, perforated, with ribbed stripes of a
                 second colour down the back (Crimson Kimono)
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
    if (G.type === 'moto') {
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
      dots(g, G.mesh, 9, 1.8)
      // ribbed stripes along the fingers
      g.fillStyle = G.dash
      for (let i = 0; i < 4; i++) g.fillRect(0, SIZE * (0.17 + i * 0.22), SIZE, 10)
    } else {
      // sport: breathable mesh (dots, or a moulded triangle grid), then the
      // reflective dashes, one row per finger
      if (G.tri) {
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

/** The rig materials for a glove item: finger, fingertip, back panel, pads, cuff. */
export function gloveMaterials(item) {
  if (cache.has(item.id)) return cache.get(item.id)
  const G = item.glove
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.05, ...o })
  const finger = std({ map: fingerTexture(G) })
  const M = {
    glove: finger,
    tip: G.tip ? std({ color: G.tip }) : finger,
    panel: std({ map: panelTexture(G), roughness: 0.7 }),
    pad: std({ color: G.pad, roughness: G.type === 'moto' ? 0.35 : 0.6, metalness: G.type === 'moto' ? 0.2 : 0.05 }),
    cuff: std({ map: cuffTexture(G) }),
  }
  cache.set(item.id, M)
  return M
}
