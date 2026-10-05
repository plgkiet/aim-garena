/* Skin artwork, painted procedurally onto a canvas.

   Every pattern paints the *whole weapon* as one image: u runs the length of
   the gun (muzzle at u = 0), v runs bottom to top. The gun builder projects
   each part onto that image by its position on the gun, so a fade really runs
   muzzle to stock and a flame really licks up from the magazine — the way CS
   skins read as one artwork rather than a sticker per part.

   All randomness is seeded by the skin, so a skin always looks the same. */

export const TEX_W = 1024, TEX_H = 512

export function rng(seed) {
  let s = (seed * 2654435761) % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/* value noise for the organic patterns */
function noise2(seed) {
  const r = rng(seed)
  const N = 64
  const g = Array.from({ length: N * N }, r)
  const at = (x, y) => g[((y % N + N) % N) * N + ((x % N + N) % N)]
  const sm = t => t * t * (3 - 2 * t)
  const v = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi)
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
  return (x, y, oct = 4) => {
    let n = 0, amp = 0.5, f = 1
    for (let o = 0; o < oct; o++) { n += v(x * f, y * f) * amp; amp *= 0.5; f *= 2.03 }
    return n
  }
}

const hex = c => {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
/** Sample a palette as a smooth ramp, t in 0..1. */
function ramp(pal, t) {
  t = Math.max(0, Math.min(0.9999, t)) * (pal.length - 1)
  const i = Math.floor(t)
  return mix(hex(pal[i]), hex(pal[i + 1]), t - i)
}

/** Paint every pixel from a field function returning [r,g,b] (0..255). */
function field(g, fn) {
  const img = g.createImageData(TEX_W, TEX_H)
  const d = img.data
  for (let y = 0; y < TEX_H; y++) {
    const v = 1 - y / TEX_H
    for (let x = 0; x < TEX_W; x++) {
      const c = fn(x / TEX_W, v)
      const k = (y * TEX_W + x) * 4
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
}

/* ------------------------------------------------------------ patterns --- */

const P = {
  /** Flames licking up from the bottom over a dark body. */
  flames(g, s) {
    const r = rng(s.seed)
    const [bg, deep, mid, hot] = s.pal
    g.fillStyle = bg; g.fillRect(0, 0, TEX_W, TEX_H)
    for (let layer = 0; layer < 3; layer++) {
      const col = [deep, mid, hot][layer]
      const count = 7 + layer * 3
      for (let i = 0; i < count; i++) {
        const x = r() * TEX_W, w = 90 + r() * 160 - layer * 30, h = TEX_H * (0.55 + r() * 0.4 - layer * 0.14)
        const grad = g.createLinearGradient(0, TEX_H, 0, TEX_H - h)
        grad.addColorStop(0, col); grad.addColorStop(1, col + '00')
        g.fillStyle = grad
        g.beginPath()
        g.moveTo(x - w / 2, TEX_H)
        g.bezierCurveTo(x - w * 0.6, TEX_H - h * 0.4, x + w * 0.3, TEX_H - h * 0.55, x + (r() - 0.5) * w * 0.8, TEX_H - h)
        g.bezierCurveTo(x + w * 0.1, TEX_H - h * 0.5, x + w * 0.7, TEX_H - h * 0.35, x + w / 2, TEX_H)
        g.fill()
      }
    }
    // embers
    g.fillStyle = hot
    for (let i = 0; i < 90; i++) { g.globalAlpha = r(); g.fillRect(r() * TEX_W, r() * TEX_H * 0.7, 2 + r() * 3, 2 + r() * 3) }
    g.globalAlpha = 1
  },

  /** Glowing diagonal neon tubes on black. */
  neon(g, s) {
    const r = rng(s.seed)
    const [bg, ...cols] = s.pal
    g.fillStyle = bg; g.fillRect(0, 0, TEX_W, TEX_H)
    g.lineCap = 'round'
    for (let i = 0; i < 26; i++) {
      const c = cols[i % cols.length]
      const x = r() * TEX_W * 1.4 - TEX_W * 0.2, len = 120 + r() * 380, a = -0.6 + (r() - 0.5) * 0.3
      g.shadowColor = c; g.shadowBlur = 24
      g.strokeStyle = c; g.lineWidth = 4 + r() * 10
      g.beginPath(); g.moveTo(x, TEX_H * r()); g.lineTo(x + Math.cos(a) * len, TEX_H * r() + Math.sin(a) * len); g.stroke()
    }
    g.shadowBlur = 0
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 40; i++) { g.globalAlpha = 0.5 * r(); g.fillRect(r() * TEX_W, r() * TEX_H, 3, 3) }
    g.globalAlpha = 1
  },

  /** Asiimov-style: white shell, black panels, bold orange blocks. */
  geometric(g, s) {
    const r = rng(s.seed)
    const [base, dark, accent, line] = s.pal
    g.fillStyle = base; g.fillRect(0, 0, TEX_W, TEX_H)
    g.fillStyle = dark
    g.beginPath(); g.moveTo(TEX_W * 0.55, 0); g.lineTo(TEX_W, 0); g.lineTo(TEX_W, TEX_H); g.lineTo(TEX_W * 0.72, TEX_H); g.closePath(); g.fill()
    g.beginPath(); g.moveTo(0, TEX_H * 0.62); g.lineTo(TEX_W * 0.3, TEX_H * 0.72); g.lineTo(TEX_W * 0.26, TEX_H); g.lineTo(0, TEX_H); g.fill()
    g.fillStyle = accent
    for (let i = 0; i < 6; i++) {
      const x = r() * TEX_W, y = r() * TEX_H, w = 60 + r() * 180, h = 30 + r() * 90
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h * 0.2); g.lineTo(x + w * 0.8, y + h); g.lineTo(x - w * 0.1, y + h * 0.8); g.fill()
    }
    g.strokeStyle = line; g.lineWidth = 3
    for (let i = 0; i < 14; i++) {
      const y = r() * TEX_H
      g.beginPath(); g.moveTo(r() * TEX_W * 0.4, y); g.lineTo(TEX_W * (0.5 + r() * 0.5), y + (r() - 0.5) * 60); g.stroke()
    }
    g.fillStyle = dark
    g.font = 'bold 44px sans-serif'
    g.fillText(s.tag || '', TEX_W * 0.08, TEX_H * 0.3)
  },

  /** Hyper-beast style colour splatter over a base. */
  splatter(g, s) {
    const r = rng(s.seed)
    const [base, ...cols] = s.pal
    g.fillStyle = base; g.fillRect(0, 0, TEX_W, TEX_H)
    for (let i = 0; i < 140; i++) {
      const c = cols[i % cols.length]
      g.fillStyle = c
      const x = r() * TEX_W, y = r() * TEX_H, rad = 6 + r() * r() * 70
      g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill()
      // drips
      if (r() < 0.35) { g.fillRect(x - rad * 0.2, y, rad * 0.4, rad * (1 + r() * 3)) }
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (r() - 0.5) * rad * 4, y + (r() - 0.5) * rad * 4, rad * 0.15 * r(), 0, 7); g.fill() }
    }
  },

  /** Smooth colour fade along the gun (the classic Fade). */
  fade(g, s) {
    const grad = g.createLinearGradient(0, TEX_H, TEX_W, 0)
    s.pal.forEach((c, i) => grad.addColorStop(i / (s.pal.length - 1), c))
    g.fillStyle = grad; g.fillRect(0, 0, TEX_W, TEX_H)
  },

  /** Northern lights: soft curtains over a night sky. */
  aurora(g, s) {
    const n = noise2(s.seed)
    const [sky, ...cols] = s.pal
    const skyC = hex(sky)
    field(g, (u, v) => {
      let c = skyC
      for (let k = 0; k < cols.length; k++) {
        const band = 0.35 + k * 0.18 + (n(u * 3 + k, 0.5, 3) - 0.5) * 0.5
        const d = Math.abs(v - band)
        const w = Math.max(0, 1 - d * 6) * (0.6 + n(u * 14, k * 3, 2) * 0.6)
        c = mix(c, hex(cols[k]), Math.min(1, w))
      }
      return c
    })
    const r = rng(s.seed + 7)
    g.fillStyle = '#fff'
    for (let i = 0; i < 70; i++) { g.globalAlpha = r(); g.fillRect(r() * TEX_W, r() * TEX_H * 0.5, 2, 2) }
    g.globalAlpha = 1
  },

  /** Stacked flowing waves. */
  waves(g, s) {
    const [bg, ...cols] = s.pal
    g.fillStyle = bg; g.fillRect(0, 0, TEX_W, TEX_H)
    const bands = 9
    for (let b = bands; b >= 0; b--) {
      g.fillStyle = cols[b % cols.length]
      g.beginPath()
      const base = (b / bands) * TEX_H * 1.1
      g.moveTo(0, TEX_H)
      for (let x = 0; x <= TEX_W; x += 8) g.lineTo(x, base + Math.sin(x / 70 + b * 1.3) * 26 + Math.sin(x / 23 + b) * 6)
      g.lineTo(TEX_W, TEX_H); g.fill()
    }
  },

  /** Glowing hex grid over a gradient. */
  hex(g, s) {
    const [a, b, glow] = s.pal
    const grad = g.createLinearGradient(0, 0, TEX_W, TEX_H)
    grad.addColorStop(0, a); grad.addColorStop(1, b)
    g.fillStyle = grad; g.fillRect(0, 0, TEX_W, TEX_H)
    const R = 26, h = R * Math.sqrt(3)
    g.strokeStyle = glow; g.lineWidth = 2.5; g.shadowColor = glow; g.shadowBlur = 10
    const r = rng(s.seed)
    for (let y = -h; y < TEX_H + h; y += h) for (let x = -R * 3, i = 0; x < TEX_W + R * 3; x += R * 1.5, i++) {
      const cy = y + (i % 2 ? h / 2 : 0)
      g.beginPath()
      for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2; g.lineTo(x + Math.cos(an) * R * 0.92, cy + Math.sin(an) * R * 0.92) }
      g.closePath(); g.stroke()
      if (r() < 0.08) { g.fillStyle = glow; g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1 }
    }
    g.shadowBlur = 0
  },

  /** Layered blob camouflage. */
  camo(g, s) {
    const n = noise2(s.seed)
    const cols = s.pal.map(hex)
    field(g, (u, v) => {
      const t = n(u * 6, v * 3, 3)
      const k = Math.min(cols.length - 1, Math.floor(Math.max(0, (t - 0.25) / 0.5) * cols.length))
      return cols[k]
    })
  },

  /** Printed circuit traces with glowing pads. */
  circuit(g, s) {
    const r = rng(s.seed)
    const [bg, trace, pad] = s.pal
    g.fillStyle = bg; g.fillRect(0, 0, TEX_W, TEX_H)
    g.strokeStyle = trace; g.lineWidth = 3; g.shadowColor = trace; g.shadowBlur = 8
    for (let i = 0; i < 70; i++) {
      let x = Math.round(r() * TEX_W / 16) * 16, y = Math.round(r() * TEX_H / 16) * 16
      g.beginPath(); g.moveTo(x, y)
      for (let k = 0; k < 4; k++) {
        if (r() < 0.5) x += (r() < 0.5 ? -1 : 1) * 16 * (2 + Math.floor(r() * 6))
        else y += (r() < 0.5 ? -1 : 1) * 16 * (2 + Math.floor(r() * 4))
        g.lineTo(x, y)
      }
      g.stroke()
      g.fillStyle = pad; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill()
    }
    g.shadowBlur = 0
  },

  /** Overlapping snake scales shaded light to dark. */
  scales(g, s) {
    const [bg, a, b] = s.pal
    g.fillStyle = bg; g.fillRect(0, 0, TEX_W, TEX_H)
    const R = 22
    for (let y = TEX_H + R; y > -R; y -= R * 0.8) {
      for (let x = -R, i = 0; x < TEX_W + R; x += R * 1.6, i++) {
        const cx = x + ((Math.round(y / (R * 0.8)) % 2) ? R * 0.8 : 0)
        const grad = g.createRadialGradient(cx, y - R * 0.4, 2, cx, y, R)
        grad.addColorStop(0, a); grad.addColorStop(1, b)
        g.fillStyle = grad
        g.beginPath(); g.arc(cx, y, R, Math.PI, 0); g.fill()
        g.strokeStyle = bg; g.lineWidth = 1.5; g.stroke()
      }
    }
  },

  /** Candy stripes. */
  stripes(g, s) {
    const cols = s.pal
    g.save(); g.translate(TEX_W / 2, TEX_H / 2); g.rotate(-0.6)
    const w = 38
    for (let x = -TEX_W, i = 0; x < TEX_W; x += w, i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(x, -TEX_W, w, TEX_W * 2) }
    g.restore()
  },

  /* ---- knife finishes ---- */

  /** Doppler / Gamma Doppler: smoky coloured clouds over black anodising. */
  doppler(g, s) {
    const n = noise2(s.seed)
    const pal = s.pal
    field(g, (u, v) => {
      const t = n(u * 4, v * 2.5, 5)
      const w = n(u * 9 + 3, v * 5, 3)
      return ramp(pal, Math.max(0, Math.min(1, (t - 0.28) * 2.1 + (w - 0.5) * 0.35)))
    })
  },

  /** Marble fade: fire-and-ice swirls. */
  marble(g, s) {
    const n = noise2(s.seed)
    field(g, (u, v) => {
      const warp = n(u * 3, v * 2, 4) * 3
      const t = 0.5 + 0.5 * Math.sin((u * 6 + v * 2 + warp) * 2.2)
      return ramp(s.pal, t)
    })
  },

  /** Tiger tooth: gold with flowing dark stripes. */
  tiger(g, s) {
    const n = noise2(s.seed)
    const [light, gold, dark] = s.pal.map(hex)
    field(g, (u, v) => {
      const w = Math.sin((u * 18 + n(u * 3, v * 3, 3) * 5 + v * 1.5) * 1.3)
      const shine = mix(gold, light, Math.max(0, v - 0.4))
      return w > 0.55 ? mix(shine, dark, Math.min(1, (w - 0.55) * 4)) : shine
    })
  },

  /** Crimson web: red lacquer with a black spider web. */
  web(g, s) {
    const [base, webc] = s.pal
    g.fillStyle = base; g.fillRect(0, 0, TEX_W, TEX_H)
    g.strokeStyle = webc; g.lineWidth = 3
    const cx = TEX_W * 0.45, cy = TEX_H * 0.5
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * TEX_W, cy + Math.sin(a) * TEX_W); g.stroke()
    }
    for (let ring = 30; ring < TEX_W; ring *= 1.35) {
      g.beginPath()
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI * 2
        const px = cx + Math.cos(a) * ring, py = cy + Math.sin(a) * ring
        if (k === 0) g.moveTo(px, py)
        else { const pa = ((k - 0.5) / 16) * Math.PI * 2; g.quadraticCurveTo(cx + Math.cos(pa) * ring * 0.85, cy + Math.sin(pa) * ring * 0.85, px, py) }
      }
      g.stroke()
    }
  },

  /** Slaughter: blotchy pink-red damascus. */
  slaughter(g, s) {
    const n = noise2(s.seed)
    field(g, (u, v) => ramp(s.pal, Math.max(0, Math.min(1, (n(u * 7, v * 4, 5) - 0.3) * 2.4))))
  },

  /** Case hardened: blue and gold patina. */
  /** Case Hardened: see caseHardenedField below. */
  caseHardened(g, s) {
    field(g, caseHardenedField(s.patternNo ?? s.seed, s.chSide ?? 0))
  },

  /** Digital camo: square pixels stepped out of smooth noise. */
  digital(g, s) {
    const n = noise2(s.seed), cell = 14
    for (let y = 0; y < TEX_H; y += cell) for (let x = 0; x < TEX_W; x += cell) {
      const t = n((x / TEX_W) * 7, (y / TEX_H) * 3.5, 4)
      const i = Math.min(s.pal.length - 1, Math.max(0, Math.floor(((t - 0.28) / 0.44) * s.pal.length)))
      g.fillStyle = s.pal[i]; g.fillRect(x, y, cell, cell)
    }
  },

  /** Topographic map: contour lines over a flat ground, every fourth heavier. */
  topo(g, s) {
    const n = noise2(s.seed), bg = hex(s.pal[0]), ln = hex(s.pal[1])
    field(g, (u, v) => {
      const t = n(u * 3, v * 1.5, 4) * 16
      const f = t - Math.floor(t), d = Math.min(f, 1 - f)
      const w = Math.floor(t) % 4 === 0 ? 0.1 : 0.05
      return d < w ? mix(bg, ln, 1 - (d / w) * 0.5) : mix(bg, ln, 0.06)
    })
  },

  /** Carbon fibre: a woven checker of sheened tows, with optional racing pinstripes. */
  carbon(g, s) {
    const [a, b, accent] = s.pal, c = 12
    for (let y = 0; y < TEX_H; y += c) for (let x = 0; x < TEX_W; x += c) {
      const across = ((x + y) / c) % 2 === 0
      const grad = g.createLinearGradient(x, y, across ? x + c : x, across ? y : y + c)
      grad.addColorStop(0, a); grad.addColorStop(0.5, b); grad.addColorStop(1, a)
      g.fillStyle = grad; g.fillRect(x, y, c, c)
    }
    if (accent) {
      g.fillStyle = accent
      g.fillRect(0, TEX_H * 0.62, TEX_W, 7); g.fillRect(0, TEX_H * 0.62 + 12, TEX_W, 2)
    }
  },

  /** Tartan: a repeating sett of bands woven both ways, with a fine twill. */
  tartan(g, s) {
    const [base, c1, c2, dark] = s.pal
    g.fillStyle = base; g.fillRect(0, 0, TEX_W, TEX_H)
    const sett = [[dark, 44], [c1, 14], [dark, 8], [c2, 5], [base, 30], [c1, 5]]
    g.globalAlpha = 0.55
    for (let o = 0; o < TEX_W;) for (const [col, w] of sett) {
      g.fillStyle = col
      g.fillRect(o, 0, w, TEX_H)
      if (o < TEX_H) g.fillRect(0, o, TEX_W, w)
      o += w
    }
    g.globalAlpha = 1
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1
    for (let d = -TEX_H; d < TEX_W; d += 4) { g.beginPath(); g.moveTo(d, TEX_H); g.lineTo(d + TEX_H, 0); g.stroke() }
  },

  /** Leopard / cheetah: broken dark rosettes around warm centres. */
  leopard(g, s) {
    const r = rng(s.seed), [base, dark, light] = s.pal
    g.fillStyle = base; g.fillRect(0, 0, TEX_W, TEX_H)
    g.lineCap = 'round'
    for (let i = 0; i < 230; i++) {
      const x = r() * TEX_W, y = r() * TEX_H, R = 8 + r() * 16
      g.globalAlpha = 0.6; g.fillStyle = light
      g.beginPath(); g.ellipse(x, y, R * 0.7, R * 0.55, r() * 3, 0, 7); g.fill()
      g.globalAlpha = 1; g.strokeStyle = dark; g.lineWidth = R * 0.35
      for (let k = 0; k < 3; k++) { const a0 = r() * 6.28; g.beginPath(); g.ellipse(x, y, R, R * 0.8, 0, a0, a0 + 1 + r() * 1.2); g.stroke() }
    }
  },

  /** Chevrons: bold zig-zag bands running the length of the weapon. */
  chevron(g, s) {
    const [bg, ...cols] = s.pal
    g.fillStyle = bg; g.fillRect(0, 0, TEX_W, TEX_H)
    const step = 46, amp = 20, half = 30, N = Math.ceil(TEX_W / half) + 1
    const zig = i => (i % 2 ? amp : -amp)
    for (let b = -1, k = 0; b * step < TEX_H + step; b++, k++) {
      g.fillStyle = cols[k % cols.length]
      const y0 = b * step
      g.beginPath()
      for (let i = 0; i <= N; i++) g.lineTo(i * half, y0 + zig(i))
      for (let i = N; i >= 0; i--) g.lineTo(i * half, y0 + step * 0.5 + zig(i))
      g.fill()
    }
  },

  /** Halftone: a dot screen swelling from nothing at the muzzle to solid at the stock. */
  halftone(g, s) {
    const [bg, dot] = s.pal, n = noise2(s.seed), c = 14
    g.fillStyle = bg; g.fillRect(0, 0, TEX_W, TEX_H)
    g.fillStyle = dot
    for (let y = 0, row = 0; y < TEX_H + c; y += c * 0.866, row++) for (let x = (row % 2) * c / 2; x < TEX_W + c; x += c) {
      const t = Math.min(1, Math.max(0, (x / TEX_W) * 0.9 + (n((x / TEX_W) * 4, (y / TEX_H) * 2, 3) - 0.5) * 0.8))
      const R = c * 0.58 * t
      if (R > 0.4) { g.beginPath(); g.arc(x, y, R, 0, 7); g.fill() }
    }
  },

  /** Street-racer livery (the silver-and-blue tuner car): metallic silver,
      twin racing stripes down the length, and a run of slanted blade decals
      along the bottom that grow taller toward the stock. */
  livery(g, s) {
    const [silver, blue, shade, light] = s.pal
    const grad = g.createLinearGradient(0, 0, 0, TEX_H)
    grad.addColorStop(0, '#f2f4f7'); grad.addColorStop(0.55, silver); grad.addColorStop(1, shade || '#8d949c')
    g.fillStyle = grad; g.fillRect(0, 0, TEX_W, TEX_H)
    const Y = v => (1 - v) * TEX_H
    // twin stripes, the upper one a touch wider
    g.fillStyle = blue
    g.fillRect(0, Y(0.3), TEX_W, 0.05 * TEX_H)
    g.fillRect(0, Y(0.235), TEX_W, 0.036 * TEX_H)
    const blade = (x, y0, w, h, lean) => {
      g.beginPath()
      g.moveTo(x, y0); g.lineTo(x + w, y0); g.lineTo(x + w - lean, y0 - h); g.lineTo(x - lean, y0 - h)
      g.closePath(); g.fill()
    }
    if (s.blades === false) return   // the blades come from a picture instead
    // the sill row: short light-blue slashes the whole length
    g.fillStyle = light || blue
    for (let u = 0.03; u < 1; u += 0.018) blade(u * TEX_W, Y(0.012), 0.008 * TEX_W, 0.055 * TEX_H, 0.03 * TEX_H)
    // the main blades: taller toward the stock (u = 1), tops leaning toward
    // the muzzle, each one cut through by a thin silver slice like the car's
    for (let u = 0.3; u < 1; u += 0.034) {
      const t = (u - 0.3) / 0.7
      const h = (0.05 + Math.pow(t, 1.4) * 0.2) * TEX_H, w = (0.014 + t * 0.01) * TEX_W, lean = h * 0.6
      const x = u * TEX_W, y0 = Y(0.075)
      g.fillStyle = blue
      blade(x, y0, w, h, lean)
      g.fillStyle = silver
      blade(x - lean * 0.55 - w * 0.2, y0 - h * 0.55, w * 1.4, h * 0.07, lean * 0.07)
    }
  },

  /** One flat colour: the ground for decals laid on top. */
  solid(g, s) {
    g.fillStyle = s.pal[0]; g.fillRect(0, 0, TEX_W, TEX_H)
  },

  /** Plain polished steel. */
  vanilla(g) {
    const grad = g.createLinearGradient(0, 0, 0, TEX_H)
    grad.addColorStop(0, '#e8ecf0'); grad.addColorStop(0.5, '#9aa3ad'); grad.addColorStop(1, '#d5dade')
    g.fillStyle = grad; g.fillRect(0, 0, TEX_W, TEX_H)
  },
}

/* Gem finishes are photographs, not procedures: the stone is cropped to the
   artwork's 2:1 at a seeded offset (so two gem skins never show the same
   patch), pushed a little richer, and given a polished highlight. The picture
   loads async, so the canvas starts as the stone's base colour and is painted
   over once it arrives; `skinReady` resolves then. */
const images = new Map()
function loadImage(src) {
  if (!images.has(src)) {
    images.set(src, new Promise(res => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => res(null)
      img.src = src
    }))
  }
  return images.get(src)
}

/* A banner finish (Lore): one long artwork laid end to end along the weapon,
   so the knotwork runs from the muzzle / blade root and the dragon's fire
   lands at the far end. The band is sized to the part's height on the
   artwork (`band`, a fraction of it) and repeated upward to cover any taller
   part rather than being stretched. */
function paintBand(g, skin, img) {
  const L = skin.layout
  // `ink` darkens and thickens fine line art so it still reads on the gun
  if (L?.ink) img = inked(img, L.ink)
  if (!L) {
    const h = TEX_H * (skin.band ?? 0.4)
    for (let y = TEX_H - h; y > -h; y -= h) g.drawImage(img, 0, y, TEX_W, h)
    return
  }
  // laid out on one weapon: the art spans only [u0,u1] x [v0,v1] (its body),
  // everything else (barrel, scope) wears the harlequin that frames the art,
  // or just the base colour for a plain layout
  if (L.plain) { g.fillStyle = skin.pal?.[0] || '#222'; g.fillRect(0, 0, TEX_W, TEX_H) }
  else harlequin(g, L.cell ?? 22)
  // `fill`: a patch of the same picture (its background) tiled over the whole
  // side first, mirrored every other tile so the seams meet, so the stock and
  // muzzle beyond the main art are not left bare
  if (L.fill) {
    const [f0, g0, f1, g1] = L.fill
    const fx = img.width * f0, fy = img.height * g0, fw = img.width * (f1 - f0), fh = img.height * (g1 - g0)
    // `fillH` sets the strip's height (in v) when it should be finer than the art
    const th = (L.fillH ?? L.v1 - L.v0) * TEX_H, tw = th * fw / fh * (L.fillStretch ?? 1)
    // `fillRows` repeats the strip down the rest of the side too (grip,
    // magazine), every other row upside down so the rows meet
    const top = (1 - L.v1) * TEX_H
    const rows = L.fillRows ? Math.ceil((TEX_H - top) / th) : 1
    for (let r = L.fillRows ? -Math.ceil(top / th) : 0; r < rows; r++) {
      const ty = top + r * th
      for (let x = 0, k = 0; x < TEX_W; x += tw, k++) {
        g.save()
        const up = Math.abs(r) % 2
        g.translate(k % 2 ? x + tw : x, up ? ty + th : ty)
        g.scale(k % 2 ? -1 : 1, up ? -1 : 1)
        g.drawImage(img, fx, fy, fw, fh, 0, 0, tw, th)
        g.restore()
      }
    }
  }
  // `polar`: a curved blade (the Karambit) straightened out: the picture is
  // read round a circle (centre `c` in px, radii `r`, angles `a` in degrees)
  // so u runs along the arc of the blade and v across it
  if (L.polar) {
    const P = L.polar
    const src = document.createElement('canvas')
    src.width = img.width; src.height = img.height
    const sg = src.getContext('2d', { willReadFrequently: true })
    sg.drawImage(img, 0, 0)
    const S = sg.getImageData(0, 0, img.width, img.height).data
    const out = g.getImageData(0, 0, TEX_W, TEX_H), O = out.data
    for (let Y = 0; Y < TEX_H; Y++) for (let X = 0; X < TEX_W; X++) {
      let u = X / TEX_W, v = 1 - Y / TEX_H
      if (L.flip) u = 1 - u
      if (L.flipV) v = 1 - v
      const th = (P.a[0] + u * (P.a[1] - P.a[0])) * Math.PI / 180, r = P.r[0] + v * (P.r[1] - P.r[0])
      const px = Math.round(P.c[0] + r * Math.cos(th)), py = Math.round(P.c[1] + r * Math.sin(th))
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue
      const k = (py * img.width + px) * 4
      if (S[k + 3] < 128) continue
      const o = (Y * TEX_W + X) * 4
      O[o] = S[k]; O[o + 1] = S[k + 1]; O[o + 2] = S[k + 2]; O[o + 3] = 255
    }
    g.putImageData(out, 0, 0)
    return
  }
  const [c0, c1] = L.crop ?? [0, 1]
  const [r0, r1] = L.cropV ?? [0, 1]
  const sx = img.width * c0, sw = img.width * (c1 - c0)
  const sy = img.height * r0, sh = img.height * (r1 - r0)
  const x = L.u0 * TEX_W, w = (L.u1 - L.u0) * TEX_W
  const y = (1 - L.v1) * TEX_H, h = (L.v1 - L.v0) * TEX_H
  g.save()
  // `flip` mirrors it along the weapon, `flipV` across it
  g.translate(L.flip ? x + w : x, L.flipV ? y + h : y)
  g.scale(L.flip ? -1 : 1, L.flipV ? -1 : 1)
  // `bleed`: the cut-out drawn shifted about underneath first, so its colours
  // run on a few pixels past its outline
  for (let d = L.bleed ?? 0; d > 0; d -= 2)
    for (const [dx, dy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d, -d], [d, -d], [-d, d], [d, d]]) g.drawImage(img, sx, sy, sw, sh, dx, dy, w, h)
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  g.restore()
}

/** Gold and olive diamonds, the Dragon Lore's barrel and scope. */
function harlequin(g, cell) {
  g.fillStyle = '#e0a526'; g.fillRect(0, 0, TEX_W, TEX_H)
  g.fillStyle = '#35300f'
  for (let y = 0; y < TEX_H + cell; y += cell) {
    for (let x = ((y / cell) % 2) * cell; x < TEX_W + cell; x += cell * 2) {
      g.beginPath()
      g.moveTo(x, y - cell / 2); g.lineTo(x + cell / 2, y); g.lineTo(x, y + cell / 2); g.lineTo(x - cell / 2, y)
      g.closePath(); g.fill()
    }
  }
}

/* A tiled finish (Wild Lotus, Gungnir): the artwork keeps its own aspect,
   one tile `tile` of the artwork tall, repeated along and up the weapon from
   a seeded start so the motif is whole rather than stretched. */
function paintTile(g, skin, img) {
  // `tileCrop` [x0, y0, x1, y1] (fractions) tiles just part of the picture,
  // e.g. the plain camo around a logo
  const [cx0, cy0, cx1, cy1] = skin.tileCrop ?? [0, 0, 1, 1]
  const sx = cx0 * img.width, sy = cy0 * img.height, sw = (cx1 - cx0) * img.width, sh = (cy1 - cy0) * img.height
  const th = TEX_H * (skin.tile ?? 0.45), tw = th * sw / sh
  const x0 = -tw * rng(skin.seed)()
  g.save()
  // `tileFlip` mirrors the pattern so lettering in it reads right on the side you see
  if (skin.tileFlip) { g.translate(TEX_W, 0); g.scale(-1, 1) }
  for (let y = TEX_H - th; y > -th; y -= th)
    for (let x = x0; x < TEX_W; x += tw) g.drawImage(img, sx, sy, sw, sh, x, y, tw, th)
  g.restore()
}

/* An emblem: one piece of the picture (a logo, a face) set once on the
   weapon at `at` [u, v], `h` of the artwork tall, keeping its own aspect
   (the artwork is square in weapon units, so pixels scale alike both ways).
   `flip` mirrors it so it reads right on the side you look at. */
/* Line art inked heavier: each dark stroke spread by `bold` source pixels
   (the darkest of the shifted copies wins), then the contrast raised by
   `contrast`, so hairlines on a light ground survive being scaled down. */
function inked(img, { bold = 1, contrast = 1.6 } = {}) {
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  const x = c.getContext('2d')
  x.drawImage(img, 0, 0)
  x.globalCompositeOperation = 'darken'
  for (let dy = -bold; dy <= bold; dy++)
    for (let dx = -bold; dx <= bold; dx++) if (dx || dy) x.drawImage(img, dx, dy)
  x.globalCompositeOperation = 'source-over'
  const out = document.createElement('canvas')
  out.width = img.width; out.height = img.height
  const o = out.getContext('2d')
  o.filter = `contrast(${contrast})`
  o.drawImage(c, 0, 0)
  return out
}

function tinted(img, sx, sy, sw, sh, color, bold) {
  const c = document.createElement('canvas')
  c.width = Math.ceil(sw); c.height = Math.ceil(sh)
  const t = c.getContext('2d')
  const steps = bold > 0 ? 12 : 1
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    t.drawImage(img, sx, sy, sw, sh, Math.cos(a) * bold, Math.sin(a) * bold, sw, sh)
  }
  t.globalCompositeOperation = 'source-in'
  t.fillStyle = color
  t.fillRect(0, 0, c.width, c.height)
  return c
}

function paintEmblem(g, E, img) {
  const [x0, y0, x1, y1] = E.crop
  const sw = (x1 - x0) * img.width, sh = (y1 - y0) * img.height
  // `w` (a fraction of the artwork's width) stretches a strip to a length;
  // otherwise it keeps its own aspect at height `h`
  const h = E.h * TEX_H, w = E.w ? E.w * TEX_W : h * sw / sh
  const cx = E.at[0] * TEX_W, cy = (1 - E.at[1]) * TEX_H
  g.save()
  g.translate(cx, cy)
  // `pad`: a clear field of `padColor` around it, so the tiled pattern doesn't crowd it
  if (E.pad) { g.fillStyle = E.padColor; g.fillRect(-w / 2 - E.pad * h, -h / 2 - E.pad * h, w + 2 * E.pad * h, h + 2 * E.pad * h) }
  // `disc`: a round field behind a round logo cut out of its own ground
  if (E.disc) { g.fillStyle = E.disc; g.beginPath(); g.arc(0, 0, Math.min(w, h) / 2 * 0.98, 0, Math.PI * 2); g.fill() }
  // `rot` (radians) turns a piece that sits sideways on the sheet
  if (E.rot) g.rotate(E.rot)
  // `flipY`: texture sheets taken off a model are often stored upside down
  g.scale(E.flip ? -1 : 1, E.flipY ? -1 : 1)
  // `tint` recolours a cut-out (a dark signature on a dark gun), thickened by
  // `bold` source pixels first so a hairline survives being scaled down
  if (E.tint) g.drawImage(tinted(img, x0 * img.width, y0 * img.height, sw, sh, E.tint, E.bold ?? 0), -w / 2, -h / 2, w, h)
  else g.drawImage(img, x0 * img.width, y0 * img.height, sw, sh, -w / 2, -h / 2, w, h)
  g.restore()
}

/* A decal finish (Fire Serpent): the picture is a side photo of the skinned
   weapon itself. The artwork is a side projection of the weapon too, so the
   photo lands on the model by lining up its muzzle, butt and lowest point
   (`decal`, in photo pixels) with the painted parts' ends: one scale fits
   both axes because the artwork is 2:1 over the weapon's length. Anything
   the photo doesn't cover stays the base colour. */
function paintDecal(g, skin, img) {
  const D = skin.decal
  const s = TEX_W / (D.right - D.left)
  g.fillStyle = skin.pal?.[0] || '#2a2c30'
  g.fillRect(0, 0, TEX_W, TEX_H)
  // `sy` stretches it upright when the model stands taller than the photo's weapon
  const sy = s * (D.sy ?? 1)
  const y = TEX_H - D.bottom * sy + (D.dy ?? 0), h = img.height * sy
  // `pins`: [photo x, u] pairs that pull a landmark of the photo onto the same
  // landmark of the model; the photo is stretched piecewise between them
  const pins = [[D.left, 0], ...(D.pins ?? []), [D.right, 1]]
  const lay = dy => {
    for (let i = 0; i < pins.length - 1; i++) {
      const [x0, u0] = pins[i], [x1, u1] = pins[i + 1]
      g.drawImage(img, x0, 0, x1 - x0, img.height, u0 * TEX_W, y + dy, (u1 - u0) * TEX_W, h)
    }
  }
  // `bleed`: copies nudged up and down underneath (px), so where a model part
  // stands a little proud of the photo's outline it picks up the art's edge
  // colour instead of the bare ground
  if (D.bleed) for (let k = D.bleed; k > 0; k -= Math.max(2, D.bleed / 4)) { lay(-k); lay(k) }
  lay(0)
}

/* A lettered sticker: `text` at `at` [u, v], `h` of the artwork tall, in
   `color` with an optional `outline`; `flip` mirrors it to read right on the
   side you see. */
function paintText(g, T) {
  const size = T.h * TEX_H
  g.save()
  g.translate(T.at[0] * TEX_W, (1 - T.at[1]) * TEX_H)
  if (T.flip) g.scale(-1, 1)
  if (T.skew) g.transform(1, 0, T.skew, 1, 0, 0)
  g.font = `${T.weight ?? 900} ${T.italic ? 'italic ' : ''}${size}px ${T.font ?? 'Arial Black, Arial, sans-serif'}`
  g.textAlign = 'center'; g.textBaseline = 'middle'
  if (T.box) {
    const w = g.measureText(T.text).width
    g.fillStyle = T.box; g.fillRect(-w / 2 - size * 0.25, -size * 0.62, w + size * 0.5, size * 1.24)
  }
  if (T.outline) { g.lineWidth = size * 0.16; g.strokeStyle = T.outline; g.strokeText(T.text, 0, 0) }
  g.fillStyle = T.color ?? '#1f4fb8'
  g.fillText(T.text, 0, 0)
  g.restore()
}

/** Swap a picture's dark ground for `color`, fading by brightness so the
    bright artwork (a flame's glow) keeps soft edges. */
function keyDark(g, color) {
  const [cr, cg, cb] = hex(color)
  const im = g.getImageData(0, 0, TEX_W, TEX_H), d = im.data
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]) / 255
    const t = Math.min(1, Math.max(0, (m - 0.07) / 0.13))
    const a = t * t * (3 - 2 * t)
    d[i] = cr + (d[i] - cr) * a; d[i + 1] = cg + (d[i + 1] - cg) * a; d[i + 2] = cb + (d[i + 2] - cb) * a
  }
  g.putImageData(im, 0, 0)
}

function paintGem(g, skin, img, extra = {}) {
  // `overlay`: a pattern painted in code, with pieces of the picture stuck on
  // top as decals (the street racer's sponsor stickers). An emblem can name
  // its own `image` when the pieces come from more than one picture.
  if (skin.fit === 'overlay') {
    ;(P[skin.base] || P.fade)(g, skin)
    for (const e of skin.emblems ?? []) {
      const src = e.image ? extra[e.image] : img
      if (src) paintEmblem(g, e, src)
    }
    for (const t of skin.texts ?? []) paintText(g, t)
    return
  }
  if (skin.fit === 'band') {
    paintBand(g, skin, img)
    // a band can carry patches of the picture too (a different cut on the stock)
    for (const e of skin.emblems ?? []) { const src = e.image ? extra[e.image] : img; if (src) paintEmblem(g, e, src) }
    return
  }
  if (skin.fit === 'decal') {
    paintDecal(g, skin, img)
    // stickers on top of the photo
    for (const e of skin.emblems ?? []) { const src = e.image ? extra[e.image] : img; if (src) paintEmblem(g, e, src) }
    return
  }
  if (skin.fit === 'tile') {
    g.filter = `saturate(${skin.sat ?? 1}) brightness(${skin.bright ?? 1})`
    paintTile(g, skin, img)
    g.filter = 'none'
    if (skin.keyDark) keyDark(g, skin.keyDark)
    if (skin.emblem) paintEmblem(g, skin.emblem, img)
    return
  }
  const r = rng(skin.seed)
  // cover-crop, zoomed in a touch so the seeded offset has room to move
  const k = Math.max(TEX_W / img.width, TEX_H / img.height) * (1.15 + r() * 0.35)
  const w = img.width * k, h = img.height * k
  g.filter = `saturate(${skin.sat ?? 1.35}) contrast(${skin.contrast ?? 1.12}) brightness(${skin.bright ?? 1}) hue-rotate(${skin.hue ?? 0}deg)`
  g.drawImage(img, -(w - TEX_W) * r(), -(h - TEX_H) * r(), w, h)
  g.filter = 'none'
  if (skin.gloss === false) return   // a weathered finish (Rust Coat) stays matte
  // polished stone: a soft band of light across the top, a darker belly
  const gl = g.createLinearGradient(0, 0, 0, TEX_H)
  gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)')
  gl.addColorStop(0.75, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.25)')
  g.fillStyle = gl; g.fillRect(0, 0, TEX_W, TEX_H)
}


function wear(g, skin) {
  // a faint wear pass: nothing leaves the factory perfect
  const r = rng(skin.seed + 99)
  g.fillStyle = '#000'
  for (let i = 0; i < 260; i++) { g.globalAlpha = 0.04 + r() * 0.06; g.fillRect(r() * TEX_W, r() * TEX_H, 1 + r() * 4, 1 + r() * 2) }
  g.globalAlpha = 1
}

/* Case Hardened, as in CS:GO: every drop carries a pattern number (1-1000)
   and the pattern decides the whole look. The steel is heat-blued in oily,
   domain-warped pools: blue where the metal cooled first, gold where it
   didn't, a dark violet rim where the two meet and a few silver flecks. The
   pattern also sets how much of the weapon ends up blue; most patterns are a
   blue/gold mix, and a few percent come out nearly all blue: the "Blue Gems". */

/** How blue a pattern is (0..1) and whether it counts as a Blue Gem. Cheap.
    A Blue Gem is all blue, not just mostly: no gold anywhere on the weapon.
    `sides` is the share of blue on each side (the one you look at, then the
    back): the two are heated apart, so they differ, and now and then the
    front comes out all blue over a patchy back (a "playside" blue, not a gem). */
export function caseHardenedInfo(patternNo) {
  const r = rng(patternNo * 31 + 7)
  const x = r()
  // ~3% of patterns are gems; the rest spread over a 20-70% blue mix
  const gem = x < 0.03
  const blue = gem ? 1 : 0.2 + r() * 0.5
  const playside = !gem && r() < 0.04
  const sides = gem ? [1, 1] : [playside ? 1 : blue, 0.15 + r() * 0.55]
  return { blue, gem, playside, sides }
}

const CH_BLUE_LIGHT = hex('#7cc0f5'), CH_BLUE = hex('#2f6fd8'), CH_BLUE_DEEP = hex('#18307f')
const CH_RIM = hex('#6b3aa6'), CH_RIM_DARK = hex('#26134a')
const CH_GOLD = hex('#c7861c'), CH_GOLD_LIGHT = hex('#f2c64e'), CH_SILVER = hex('#c9ced6')
const CH_PURPLE = hex('#8a5bb8')

function caseHardenedField(patternNo, side = 0) {
  // (the back is a pattern of its own, not the front seen through)
  const base = patternNo * 97 + 13 + side * 50021
  const n = noise2(base), wx = noise2(base + 1), wy = noise2(base + 2), tone = noise2(base + 3), fine = noise2(base + 4)
  const heat = (u, v) => {
    // warp the lookup by two other noises: that is what makes the pools run like oil
    const du = wx(u * 3, v * 1.5, 3) - 0.5, dv = wy(u * 3 + 5, v * 1.5, 3) - 0.5
    // plus a fine mottle, so the edges break up into specks and small islands
    return n(u * 4 + du * 4.4, v * 2 + dv * 4.4, 5) + (fine(u * 26, v * 13, 3) - 0.5) * 0.1
  }
  // pick the blue/gold threshold so the whole artwork (every weapon's parts,
  // tall pistols and knives included) comes out at this pattern's share of
  // blue; a gem puts it past the hottest point, so nothing turns gold
  const blue = caseHardenedInfo(patternNo).sides[side], gem = blue >= 1
  const RIM = 0.016
  const samples = []
  for (let j = 0; j < 48; j++) for (let i = 0; i < 128; i++) samples.push(heat((i + 0.5) / 128, (j + 0.5) / 48))
  samples.sort((a, b) => a - b)
  const cut = gem ? samples[samples.length - 1] + RIM * 3 : samples[Math.min(samples.length - 1, Math.floor(blue * samples.length))]
  return (u, v) => {
    const t = heat(u, v)
    const k = tone(u * 10, v * 5, 4)
    const d = t - cut
    if (d < -RIM) {
      // blue pools: deep at the rim, brighter inside, clouded by the tone noise
      const depth = Math.min(1, -d * 7)
      const m = fine(u * 18 + 3, v * 9, 3)
      let c = mix(CH_BLUE_DEEP, CH_BLUE, Math.min(1, depth * 1.6))
      c = mix(c, CH_BLUE_LIGHT, Math.min(0.85, Math.max(0, k - 0.55) * 4) * depth)
      return mix(c, CH_BLUE_DEEP, Math.min(0.8, Math.max(0, 0.46 - k) * 4 + Math.max(0, m - 0.6) * 2))
    }
    if (d < RIM) {
      // the tempered edge: violet fading to near-black
      return mix(CH_RIM, CH_RIM_DARK, Math.abs(d) / RIM)
    }
    // gold, bruised purple in places, with silver flecks
    const g = mix(CH_GOLD, CH_GOLD_LIGHT, Math.min(1, (d - RIM) * 5 + (k - 0.5)))
    if (k < 0.43) return mix(g, CH_PURPLE, Math.min(0.9, (0.43 - k) * 7))
    if (k > 0.6) return mix(g, CH_SILVER, Math.min(0.8, (k - 0.6) * 5))
    return g
  }
}

const cache = new Map()
const ready = new Map()
/** A canvas with the skin's artwork, painted once per skin. */
export function paintSkin(skin) {
  if (cache.has(skin.id)) return cache.get(skin.id)
  const c = document.createElement('canvas')
  c.width = TEX_W; c.height = TEX_H
  const g = c.getContext('2d')
  // `back`: a two-sided finish. The artwork is twice as tall: the gun's right
  // side (the one in the thumbnails and in your hands) on the top half, its
  // left side painted from `back` on the bottom; paintMeshes picks the half
  // by which way each face looks
  if (skin.back) {
    c.height = TEX_H * 2
    const front = { ...skin, id: `${skin.id}:front`, back: null }
    const back = { ...skin, ...skin.back, id: `${skin.id}:back`, back: null }
    // (two painted sides are there at once; only a photo has to be waited for)
    if (!front.image && !back.image) {
      g.drawImage(paintSkin(front), 0, 0); g.drawImage(paintSkin(back), 0, TEX_H)
      cache.set(skin.id, c)
      return c
    }
    ready.set(skin.id, Promise.all([skinReady(front), skinReady(back)]).then(([a, b]) => {
      g.drawImage(a, 0, 0); g.drawImage(b, 0, TEX_H)
      return c
    }))
    cache.set(skin.id, c)
    return c
  }
  if (skin.image) {
    g.fillStyle = skin.pal?.[0] || '#555'; g.fillRect(0, 0, TEX_W, TEX_H)
    const more = [...new Set((skin.emblems ?? []).map(e => e.image).filter(Boolean))]
    ready.set(skin.id, Promise.all([skin.image, ...more].map(loadImage)).then(([img, ...got]) => {
      const extra = Object.fromEntries(more.map((src, i) => [src, got[i]]))
      if (img) { paintGem(g, skin, img, extra); wear(g, skin) }
      return c
    }))
  } else {
    ;(P[skin.pattern] || P.fade)(g, skin)
    wear(g, skin)
  }
  cache.set(skin.id, c)
  return c
}

/** Resolves once the skin's canvas holds its final artwork. */
export function skinReady(skin) {
  paintSkin(skin)
  return ready.get(skin.id) || Promise.resolve(cache.get(skin.id))
}
