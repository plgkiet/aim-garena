import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CASE, drawItem, tierBySlug } from '../skins/catalog'
import { inventory } from '../skins/inventory'
import { thumbnail, cachedThumb } from '../skins/thumbs'
import { W } from '../game/weapons'
import { playOpen, playReveal, playTick, unlock } from '../lib/caseSound'

/* Case opening — the plgk gift wheel, carried over whole: the same reel, the
   same braking curve, the same stop-anywhere-but-dead-centre, the same rules
   for what may show on the strip, and the same reveal. The prizes are now the
   skins from skins/catalog.js, and the draw happens here (CS:GO odds) since
   there is no shop server behind it. */

// Tile width is measured off the DOM, not hard-coded: CSS shrinks tiles on
// narrow screens, and a hard-coded width stops the reel off-tile on a phone.
const FALLBACK_TILE = 240
const FALLBACK_GAP = 14

function measureTile(track) {
  const tile = track?.querySelector('.spin-tile')
  if (!tile) return { tile: FALLBACK_TILE, gap: FALLBACK_GAP }
  const gap = parseFloat(getComputedStyle(track).columnGap)
  return { tile: tile.getBoundingClientRect().width, gap: Number.isFinite(gap) ? gap : FALLBACK_GAP }
}

// The idle strip only shows the everyday grades — the rare stuff is kept back
// so it means something when it flashes past during a spin.
const IDLE_TIERS = ['milspec', 'restricted']
// The spinning strip is filled at the case's own odds for the lower grades,
// so it is mostly blue with the odd purple. Pink and red are
// teases on top of that: at most one of each per spin, and not every spin.
// Never a knife — a gold tile on the reel means you won it.
const FILLER_TIERS = ['milspec', 'restricted']
/* How the filler is mixed on the strip. This is only what the reel shows —
   the real draw still uses the case odds (skins/catalog.js). At the true
   80/16 split the reel reads as a wall of blue, so purple gets a bigger share. */
const STRIP_MIX = { milspec: 0.65, restricted: 0.35 }
const TEASES = [
  { tier: 'classified', chance: 0.3 },
  { tier: 'covert', chance: 0.12 },
]

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function spinProfile(reduced) {
  if (reduced) return { durationMs: 3600 + Math.floor(Math.random() * 900), tiles: 10 + Math.floor(Math.random() * 4), friction: 2.7 + Math.random() * 0.6 }
  return { durationMs: 7400 + Math.floor(Math.random() * 2000), tiles: 30 + Math.floor(Math.random() * 11), friction: 2.7 + Math.random() * 0.6 }
}

/** Brakes evenly to zero at the end — the higher the power, the lazier the finish. */
const ease = (p, friction) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), friction)
/** Stop somewhere in 10–90% of the tile, never dead centre. */
const stopFraction = () => (Math.floor(Math.random() * 81) + 10) / 100

export const itemTitle = it => (it.kind === 'knife' ? it.weaponName : W[it.weapon]?.name || it.weapon)
export const itemLabel = it => `${itemTitle(it)} | ${it.name}`

/** Thumbnail for an item, rendered on first use. */
export function useThumb(item) {
  const [url, setUrl] = useState(() => (item ? cachedThumb(item.id) : null))
  useEffect(() => {
    if (!item) return
    let live = true
    const hit = cachedThumb(item.id)
    if (hit) { setUrl(hit); return }
    thumbnail(item).then(u => { if (live) setUrl(u) }).catch(() => {})
    return () => { live = false }
  }, [item])
  return url
}

function Tile({ item }) {
  const url = useThumb(item)
  return (
    <div className={`spin-tile spin-tile--${item.tier}`}>
      {url ? <img className="spin-tile__img spin-tile__img--wide" src={url} alt="" /> : <div className="spin-tile__img spin-tile__img--wide" />}
      <span className="spin-tile__name"><small>{itemTitle(item)}</small>{item.name}</span>
    </div>
  )
}

export function CaseOpen({ onBack, onInventory }) {
  const items = CASE.items
  const [idle, setIdle] = useState([])
  const [strip, setStrip] = useState([])
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState('idle')        // idle | spinning | done
  const [revealed, setRevealed] = useState(false)
  const [result, setResult] = useState(null)
  const [sound, setSound] = useState(true)
  const [equipped, setEquipped] = useState(false)

  const window_ = useRef(null)
  const track = useRef(null)
  const frame = useRef(0)
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  // warm the thumbnails of everything that can show on the strip
  useEffect(() => { for (const it of items) if (it.tier !== 'gold') thumbnail(it).catch(() => {}) }, [items])

  /** The resting strip: enough tiles to overflow the window, not just one of each. */
  const buildIdle = useCallback(() => {
    const pool = items.filter(p => IDLE_TIERS.includes(p.tier))
    const list = pool.length ? pool : items
    const width = window_.current?.clientWidth || 900
    const count = Math.ceil(width / (FALLBACK_TILE + FALLBACK_GAP)) + 3
    const bag = [...list].sort(() => Math.random() - 0.5)
    setIdle(Array.from({ length: count }, (_, i) => bag[i % bag.length]))
  }, [items])

  useLayoutEffect(() => {
    buildIdle()
    window.addEventListener('resize', buildIdle)
    return () => window.removeEventListener('resize', buildIdle)
  }, [buildIdle])

  function run(winner) {
    const width = window_.current?.clientWidth || 900
    const { tile: TILE, gap: GAP } = measureTile(track.current)
    const STEP = TILE + GAP
    const profile = spinProfile(prefersReducedMotion())

    const winnerAt = profile.tiles
    const filler = () => {
      let p = Math.random()
      const tier = FILLER_TIERS.find(t => (p -= STRIP_MIX[t]) < 0) || FILLER_TIERS[0]
      const pool = items.filter(i => i.tier === tier)
      return pool[(Math.random() * pool.length) | 0]
    }
    const list = Array.from({ length: winnerAt + 10 }, (_, i) => (i === winnerAt ? winner : filler()))

    // teases go before the winning tile, so they pass while the reel is still quick
    const taken = new Set([winnerAt])
    for (const { tier, chance } of TEASES) {
      const pool = items.filter(p => p.tier === tier)
      if (!pool.length || winner.tier === tier || Math.random() >= chance) continue
      let at
      do { at = 3 + Math.floor(Math.random() * Math.max(1, winnerAt - 4)) } while (taken.has(at))
      taken.add(at)
      list[at] = pool[(Math.random() * pool.length) | 0]
    }
    setStrip(list)

    const from = width / 2 - TILE / 2
    const to = width / 2 - (winnerAt * STEP + TILE * stopFraction())
    let lastIndex = -1
    const start = performance.now()

    const step = now => {
      const t = Math.min(1, (now - start) / profile.durationMs)
      const x = from + (to - from) * ease(t, profile.friction)
      setOffset(x)
      // one tick per tile crossing the marker — it thins out by itself as the reel slows
      const index = Math.round((width / 2 - x - TILE / 2) / STEP)
      if (index !== lastIndex) {
        lastIndex = index
        if (soundRef.current && t < 0.995) playTick()
      }
      if (t < 1) frame.current = requestAnimationFrame(step)
      else {
        setPhase('done')
        setRevealed(true)
        if (soundRef.current) playReveal(winner.tier)
      }
    }
    frame.current = requestAnimationFrame(step)
  }

  function open() {
    // unlock audio right in the click, before anything async (Safari)
    if (soundRef.current) { unlock(); playOpen() }
    setEquipped(false)
    setPhase('spinning')
    const item = drawItem(items)
    const drop = inventory.add(item.id)
    setResult({ item, drop })
    // the winning tile's picture must exist before it slides into view
    thumbnail(item).catch(() => {}).finally(() => run(item))
  }

  function again() {
    setResult(null)
    setStrip([])
    setOffset(0)
    setPhase('idle')
    setRevealed(false)
  }

  const shown = strip.length ? strip : idle
  const winUrl = useThumb(result?.item)

  return (
    <div className="plgk case-screen">
      <div className="spin-shell" aria-hidden="true" />
      <div className="wrap page spin-page">
        <div className="case-top">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>← Menu</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onInventory}>Kho đồ ({inventory.get().items.length})</button>
        </div>
        <div className="page-head">
          <span className="eyebrow">{CASE.name}</span>
          <h1 style={{ marginTop: 10 }}>Mở hòm vũ khí</h1>
        </div>

        <div className="case-bar">
          <button type="button" className="case-sound" onClick={() => setSound(v => !v)} aria-pressed={sound}>
            {sound ? 'Âm thanh bật' : 'Âm thanh tắt'}
          </button>
          <span className="case-credit">
            SFX: Valve / <a href="https://github.com/sourcesounds/csgo" target="_blank" rel="noreferrer noopener">SourceSounds</a>
          </span>
        </div>

        <div className="case-panel">
          <div className="reel-window" ref={window_}>
            <span className="reel-marker" aria-hidden="true" />
            <div className="reel-track" ref={track} style={{ transform: `translate3d(${offset}px,0,0)` }}>
              {shown.map((p, i) => <Tile key={i} item={p} />)}
            </div>
            <span className="reel-fade reel-fade--l" aria-hidden="true" />
            <span className="reel-fade reel-fade--r" aria-hidden="true" />
          </div>
        </div>

        {phase === 'done' && result ? (
          <div className={'result-card spin-tile--' + result.item.tier}>
            {winUrl && <img className="result-card__img result-card__img--wide" src={winUrl} alt="" />}
            <div style={{ minWidth: 0 }}>
              <h2>{itemLabel(result.item)}</h2>
              <p>{tierBySlug(result.item.tier).label} · đã vào kho đồ</p>
            </div>
            <button type="button" className="btn btn--ghost" onClick={again}>Mở tiếp</button>
          </div>
        ) : (
          <div className="card spin-form">
            <button type="button" className="btn btn--primary btn--lg btn--block" disabled={phase === 'spinning'} onClick={open}>
              {phase === 'spinning' ? 'Đang quay…' : 'Mở hòm'}
            </button>
            <p className="faint" style={{ fontSize: 12, textAlign: 'center' }}>Miễn phí, mở bao nhiêu lần cũng được. Tỉ lệ đúng như hòm CS:GO.</p>
          </div>
        )}

      </div>

      {revealed && result && (
        <div className={'winner-modal spin-tile--' + result.item.tier} role="dialog" aria-modal="true" onClick={() => setRevealed(false)}>
          <div className="winner-modal__inner" onClick={e => e.stopPropagation()}>
            <span className="winner-modal__label">Bạn nhận được</span>
            <h2 className="winner-modal__title">{itemLabel(result.item)}</h2>
            <p className="winner-modal__desc">{tierBySlug(result.item.tier).label} · {tierBySlug(result.item.tier).vi}</p>
            <div className="winner-modal__art">{winUrl && <img src={winUrl} alt="" />}</div>
            <div className="winner-modal__actions">
              <span className="faint">Đồ đã nằm trong kho. Trang bị để mang vào trận.</span>
              <div className="row gap-8">
                <button type="button" className="btn btn--ghost" disabled={equipped}
                  onClick={() => { inventory.equip(result.drop.uid); setEquipped(true) }}>
                  {equipped ? 'Đã trang bị' : 'Trang bị ngay'}
                </button>
                <button type="button" className="btn btn--primary" onClick={() => setRevealed(false)}>Tiếp tục</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function MiniItem({ item, children, onClick, active }) {
  const url = useThumb(item)
  return (
    <div className={`mini-item spin-tile--${item.tier}${active ? ' is-on' : ''}`} onClick={onClick}>
      {url ? <img src={url} alt="" /> : <div className="mini-item__ph" />}
      <small>{itemTitle(item)}</small>
      <span>{item.name}</span>
      {children}
    </div>
  )
}
