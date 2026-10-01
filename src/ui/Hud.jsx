import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { game, activeWeapon, eyePos } from '../game/state'
import { W } from '../game/weapons'
import { RULES } from '../game/constants'
import { canBuy, buyTimeLeft, inBuyZone } from '../game/rules'
import { input } from '../game/input'
import { siteAt } from '../world/mapData'
import { Radar } from './Radar'
import { BINDINGS } from '../lib/moves'
import { knife } from '../lib/knifeController'
import { BuyMenu } from './BuyMenu'
import { Scoreboard } from './Scoreboard'
import { MainMenu, PauseMenu, MatchEnd } from './Menus'
import { CaseOpen } from './CaseOpen'
import { Gallery } from './Gallery'
import { useScreen } from '../lib/route'
import { inventory } from '../skins/inventory'
import { Inventory } from './Inventory'
import { TradeUp } from './TradeUp'
import { ItemDetail } from './ItemDetail'

/* The HUD reads the shared game state on its own clock (~30 Hz): nothing in the
   simulation pushes React updates, so the canvas never re-renders for a number. */

function useTick(hz = 30) {
  const [, set] = useState(0)
  useEffect(() => {
    let raf, last = 0
    const loop = t => {
      raf = requestAnimationFrame(loop)
      if (t - last > 1000 / hz) { last = t; set(n => (n + 1) & 0xffff) }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [hz])
}

const fmt = s => {
  s = Math.max(0, Math.ceil(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const WEAPON_ICON = {
  knife: '🔪', he: '●', flash: '◐', smoke: '◍', molotov: '♨', incgrenade: '♨', c4: '▣',
}

export function Hud({ locked, onRequestLock }) {
  useTick(30)
  const [screen, go, param] = useScreen()   // 'menu' | 'case' | 'inventory' | 'tradeup' | 'item', mirrored in the URL
  const me = game.local
  const phase = game.phase

  if (phase === 'menu' || !me) {
    return (
      <div className="hud">
        {screen === 'case' ? <CaseOpen onBack={() => go('menu')} onInventory={() => go('inventory')} />
          : screen === 'inventory' ? <Inventory onBack={() => go('menu')} onCase={() => go('case')} onTradeUp={() => go('tradeup')} onGallery={() => go('gallery')} onOpen={uid => go('item', uid)} />
          : screen === 'item' ? <ItemDetail uid={param} onBack={() => go('inventory')} />
          : screen === 'gallery' ? <Gallery onBack={() => go('inventory')} />
          : screen === 'tradeup' ? <TradeUp onBack={() => go('menu')} onInventory={() => go('inventory')} onCase={() => go('case')} />
          : <MainMenu onStart={onRequestLock} onCase={() => go('case')} onInventory={() => go('inventory')} onTradeUp={() => go('tradeup')} />}
      </div>
    )
  }
  if (phase === 'matchEnd') return <div className="hud"><MatchEnd onRestart={onRequestLock} /></div>

  const view = me.alive ? me : game.spectate
  const inst = me.alive ? activeWeapon(me) : view ? activeWeapon(view) : null
  const w = inst ? W[inst.id] : null
  const scoped = me.alive && me.w.zoom > 0 && w?.zoom
  const tabHeld = !!input.keys.Tab && locked

  return (
    <div className="hud">
      {/* ----- overlays ----- */}
      {scoped && <ScopeOverlay />}
      <FlashOverlay />
      {game.smokeFog > 0.02 && <div className="smokefog" style={{ opacity: game.smokeFog }} />}
      {me.alive && !scoped && <Crosshair />}
      {me.alive && <DamageDirs />}
      <NameTags />

      {/* ----- top ----- */}
      <div className="topbar">
        <TeamAlive team={me.team === 'CT' ? 'CT' : 'T'} side="left" />
        <div className={`score ${me.team === 'CT' ? 'ct' : 't'}`}>{game.score[me.team]}</div>
        <RoundClock />
        <div className={`score ${me.team === 'CT' ? 't' : 'ct'}`}>{game.score[me.team === 'CT' ? 'T' : 'CT']}</div>
        <TeamAlive team={me.team === 'CT' ? 'T' : 'CT'} side="right" />
      </div>

      <div className="radar-wrap">
        <Radar />
        <div className="money">
          <span className="dollar">$</span>{me.money}
          {canBuy(me) && <span className="buyhint">B · mua đồ ({Math.ceil(buyTimeLeft())}s)</span>}
        </div>
        <div className="locname">{siteAt(me.pos.x, me.pos.z) ? `Bombsite ${siteAt(me.pos.x, me.pos.z)}` : game.mode !== 'aim' && inBuyZone(me) ? `${me.team} Spawn` : ''}</div>
      </div>

      <KillFeed />
      <Radio me={me} />
      {game.time - (game.spinToast ?? -10) < 1.6 && (
        <div className="spin-toast" key={game.spinToast}>+1 lượt quay hòm</div>
      )}
      <CenterText />

      {/* ----- bottom ----- */}
      {view && (
        <div className="vitals">
          <div className="hp"><span className="icon">✚</span><b className={view.hp <= 25 ? 'low' : ''}>{view.hp}</b></div>
          <div className="armor"><span className="icon">{view.helmet ? '⛑' : '🛡'}</span><b>{view.armor}</b></div>
          {view.defuser && <div className="kit">✂ KIT</div>}
        </div>
      )}
      {view && inst && (
        <div className="ammo">
          {w?.clip ? (<><b className={inst.clip <= Math.ceil(w.clip * 0.2) ? 'low' : ''}>{inst.clip}</b><span>/ {inst.reserve}</span></>) : <b className="wname-only">{w?.name}</b>}
          <div className="wname">{w?.name}{view === me && inventory.equippedItem(inst.id) ? ` | ${inventory.equippedItem(inst.id).name}` : ''}{view.w.reloadEnd ? ' · đang nạp…' : ''}</div>
        </div>
      )}
      {me.alive && <WeaponList me={me} />}
      {me.alive && me.active === 3 && <KnifeTricks />}
      {me.alive && <ProgressBar me={me} />}
      {me.alive && <ContextHint me={me} />}
      {!me.alive && <Spectating view={view} />}

      {tabHeld && <Scoreboard />}
      {game.buyOpen && me.alive && <BuyMenu onClose={onRequestLock} />}
      {!locked && !game.buyOpen && <PauseMenu onResume={onRequestLock} />}
    </div>
  )
}

/* ------------------------------------------------------------ pieces ---- */

function Crosshair() {
  // classic static (cl_crosshairstyle 4): the crosshair never blooms while you spray
  const gap = 4
  // a confirmed hit turns the crosshair red for a moment
  const sinceHit = game.time - game.hitConfirm
  const hit = sinceHit < 0.22
  const color = hit ? '#ff2a2a' : (game.settings.crosshair || '#4ee36e')
  const len = 7
  const style = (x, y, wdt, h) => ({ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, width: wdt, height: h, background: color })
  const g = gap
  // on the iron sights the sights are the crosshair: keep only a small dot
  const ads = game.local?.w.ads
  return (
    <div className="xhair">
      {ads ? <i style={style(-1.5, -1.5, 3, 3)} /> : (<>
        <i style={style(-1, -g - len, 2, len)} />
        <i style={style(-1, g, 2, len)} />
        <i style={style(-g - len, -1, len, 2)} />
        <i style={style(g, -1, len, 2)} />
      </>)}
      {hit && (
        <div className={`hitx${game.hitKill ? ' kill' : ''}`} style={{ opacity: 1 - sinceHit / 0.22 }}>
          <b /><b /><b /><b />
        </div>
      )}
    </div>
  )
}

function ScopeOverlay() {
  return (
    <div className="scope">
      <div className="scope-ring" />
      <div className="scope-h" />
      <div className="scope-v" />
    </div>
  )
}

function FlashOverlay() {
  const me = game.local
  let a = 0
  if (me?.alive && me.flashUntil > game.time) {
    const left = me.flashUntil - game.time
    const total = me.flashUntil - (me.flashStart ?? game.time)
    // full white, then fades over the last part like the game
    // a real flash (not one caught facing away) turns the whole screen white
    a = Math.min(1, left / Math.max(0.6, total * 0.55)) * Math.min(1, me.flashAmount * 2.5)
  }
  if (a <= 0.01) return null
  return <div className="flash" style={{ opacity: a }} />
}

function DamageDirs() {
  const me = game.local
  const list = game.damageDirs.filter(d => d.until > game.time)
  return (
    <div className="dmgdirs">
      {list.map((d, i) => {
        const rel = d.angle - me.yaw
        const alpha = Math.min(1, (d.until - game.time) / 0.6)
        return <i key={i} style={{ transform: `rotate(${-rel}rad) translateY(-120px)`, opacity: alpha }} />
      })}
    </div>
  )
}

const _p = new THREE.Vector3()
function NameTags() {
  const me = game.local
  const cam = game.camera
  if (!cam || !me) return null
  const tags = []
  for (const a of game.agents) {
    if (!a.alive || a === me || a.team !== me.team) continue
    eyePos(a, _p)
    _p.y += 0.45
    const d = _p.distanceTo(cam.position)
    _p.project(cam)
    if (_p.z > 1 || Math.abs(_p.x) > 1.1 || Math.abs(_p.y) > 1.1) continue
    tags.push(
      <div key={a.id} className={`nametag ${a.team.toLowerCase()}`} style={{ left: `${(_p.x * 0.5 + 0.5) * 100}%`, top: `${(-_p.y * 0.5 + 0.5) * 100}%`, opacity: d > 40 ? 0.5 : 0.95 }}>
        {a.name}
      </div>,
    )
  }
  return <>{tags}</>
}

function TeamAlive({ team, side }) {
  const list = game.agents.filter(a => a.team === team)
  return (
    <div className={`alive ${side} ${team.toLowerCase()}`}>
      {list.map(a => <i key={a.id} className={a.alive ? '' : 'dead'} title={a.name} />)}
    </div>
  )
}

function RoundClock() {
  const b = game.bomb
  if (b?.state === 'planted') {
    return <div className="clock bomb"><span className="c4">💣</span></div>
  }
  let t = 0, cls = ''
  if (game.phase === 'freeze') { t = game.phaseEnd - game.time; cls = 'freeze' }
  else if (game.phase === 'live') { t = game.phaseEnd - game.time; if (t < 10) cls = 'low' }
  else if (game.phase === 'roundEnd') t = 0
  return <div className={`clock ${cls}`}>{fmt(t)}<small>Round {game.round}/{game.maxRounds}</small></div>
}

function KillFeed() {
  const me = game.local
  const items = game.killfeed.filter(k => game.time - k.t < 7)
  return (
    <div className="killfeed">
      {items.map((k, i) => (
        <div key={i} className={`kf ${k.killer === me || k.victim === me ? 'me' : ''}`}>
          {k.killer && <span className={k.killer.team.toLowerCase()}>{k.killer.name}</span>}
          {k.assister && <span className="assist">+ {k.assister.name}</span>}
          <span className="gun">{W[k.weapon]?.name ?? (k.weapon === 'c4' ? 'C4' : k.weapon)}</span>
          {k.penetrated && <span className="tag">⟂</span>}
          {k.headshot && <HeadshotIcon />}
          <span className={k.victim.team.toLowerCase()}>{k.victim.name}</span>
        </div>
      ))}
    </div>
  )
}

function CenterText() {
  const c = game.center
  if (!c || c.until < game.time) return null
  return (
    <div className={`center ${c.tone === 'T' ? 't' : c.tone === 'CT' ? 'ct' : ''}`}>
      <div>{c.text}</div>
      {game.phase === 'roundEnd' && game.mvp && <small>MVP: {game.mvp.name}</small>}
    </div>
  )
}

/* The killfeed's headshot mark: a head in profile with a bullet through it,
   in the spirit of CS:GO's icon. */
function HeadshotIcon() {
  return (
    <svg className="hsicon" viewBox="0 0 32 24" aria-label="headshot">
      <path d="M13 3c-4.8 0-8 3.4-8 7.8 0 2.4 1 4.2 2.4 5.4V21h7.4v-2.6h2.6c1.1 0 1.9-.9 1.9-2v-2.2l1.8-.6c.5-.2.6-.7.3-1.1L19.8 9.8C19.2 5.8 16.6 3 13 3z" fill="currentColor" />
      <path d="M1 9.5h8.5M22 12h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12.5" cy="10.5" r="2.4" fill="#141414" />
    </svg>
  )
}

/* The team radio: the bots' calls for your side (the tactic, the entry, rotations). */
function Radio({ me }) {
  const lines = (game.radio || []).filter(r => r.side === me.team && game.time - r.t < 7)
  if (!lines.length) return null
  return (
    <div className="radio">
      {lines.map((r, i) => <div key={i} style={{ opacity: Math.min(1, (7 - (game.time - r.t)) / 1.5) }}><b>RADIO</b>{r.text}</div>)}
    </div>
  )
}

function KnifeTricks() {
  return (
    <div className="tricks">
      <div className="tricks-title">MÚA DAO</div>
      {BINDINGS.map(b => (
        <div key={b.key} className={(b.move === 'next' ? knife.move && !/inspect|deploy|stab|slash/i.test(knife.move) : /inspect/i.test(knife.move || '')) ? 'on' : ''}><kbd>{b.label}</kbd>{b.name}</div>
      ))}
    </div>
  )
}

function WeaponList({ me }) {
  const rows = []
  for (const s of [1, 2, 3]) {
    const inst = me.inv[s]
    if (inst) rows.push({ s, name: W[inst.id].name, id: inst.id })
  }
  if (me.inv[4].length) rows.push({ s: 4, name: me.inv[4].map(g => WEAPON_ICON[g.id]).join(' '), id: me.inv[4][0].id })
  if (me.inv[5]) rows.push({ s: 5, name: 'C4', id: 'c4' })
  return (
    <div className="wlist">
      {rows.map(r => (
        <div key={r.s} className={me.active === r.s ? 'on' : ''}>
          <span>{r.name}</span><kbd>{r.s}</kbd>
        </div>
      ))}
    </div>
  )
}

function ProgressBar({ me }) {
  let frac = 0, label = ''
  if (me.planting > 0) { frac = me.planting / RULES.plantTime; label = 'Đang đặt bom…' }
  if (me.defusing > 0) { frac = me.defusing / (me.defuser ? RULES.defuseTimeKit : RULES.defuseTime); label = me.defuser ? 'Đang gỡ bom (có kit)…' : 'Đang gỡ bom…' }
  if (me.active === 5 && me.inv[5] && !siteAt(me.pos.x, me.pos.z) && input.mouse[0]) label = 'Phải đứng trong bombsite để đặt bom'
  if (!label) return null
  return (
    <div className="progress">
      <div className="label">{label}</div>
      {frac > 0 && <div className="bar"><i style={{ width: `${Math.min(100, frac * 100)}%` }} /></div>}
    </div>
  )
}

function ContextHint({ me }) {
  const b = game.bomb
  let hint = null
  if (me.team === 'CT' && b?.state === 'planted' && me.pos.distanceTo(b.pos) < 2 && !me.defusing) hint = 'Giữ F để gỡ bom'
  if (me.inv[5] && siteAt(me.pos.x, me.pos.z) && me.active !== 5 && game.phase === 'live') hint = 'Bấm 5 rồi giữ chuột trái để đặt bom'
  if (me.inv[5] && siteAt(me.pos.x, me.pos.z) && me.active === 5 && !me.planting && game.phase === 'live') hint = 'Giữ chuột trái để đặt bom'
  if (game.phase === 'freeze') hint = game.mode === 'aim' ? `Chuẩn bị — ${Math.ceil(game.phaseEnd - game.time)}s` : `Freeze time — ${Math.ceil(game.phaseEnd - game.time)}s · B để mua đồ`
  const near = game.drops.find(d => Math.hypot(d.pos.x - me.pos.x, d.pos.z - me.pos.z) < 1.6 && (d.inst.id !== 'c4' || me.team === 'T'))
  if (!hint && near) hint = `F · nhặt ${W[near.inst.id].name}`
  if (!hint) return null
  return <div className="hint">{hint}</div>
}

function Spectating({ view }) {
  if (!view) return <div className="spec">Bạn đã chết · chờ round sau</div>
  return (
    <div className="spec">
      <small>Đang xem</small>
      <b className={view.team.toLowerCase()}>{view.name}</b>
      <small>Click chuột trái để đổi người</small>
    </div>
  )
}

export { useTick }
