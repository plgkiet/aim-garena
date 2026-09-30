import { useEffect, useState } from 'react'
import { game } from '../game/state'
import { W, GEAR, BUY_MENU } from '../game/weapons'
import { buy, priceOf, canBuy, buyTimeLeft } from '../game/rules'
import { uiClick } from '../lib/audio'

/* The buy menu. Categories on the left like CS:GO's, number keys work too:
   B 4 2 buys an AK/M4 exactly the way muscle memory expects. */

const CATS = [
  { key: 'pistols', label: 'Súng lục' },
  { key: 'smgs', label: 'SMG' },
  { key: 'rifles', label: 'Súng trường' },
  { key: 'gear', label: 'Trang bị' },
  { key: 'grenades', label: 'Lựu đạn' },
]
const CAT_KEY = { pistols: 1, smgs: 3, rifles: 4, gear: 5, grenades: 6 }

function Stat({ label, v, max }) {
  return (
    <div className="stat"><span>{label}</span><i><b style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></i></div>
  )
}

export function BuyMenu({ onClose }) {
  const me = game.local
  const [cat, setCat] = useState('rifles')
  const [msg, setMsg] = useState(null)
  const list = BUY_MENU[me.team][cat]

  const doBuy = id => {
    const err = buy(me, id)
    if (err) { setMsg(err); uiClick(false) } else setMsg(null)
  }

  useEffect(() => {
    const onKey = e => {
      if (e.code === 'Escape' || e.code === 'KeyB') { game.buyOpen = false; onClose(); return }
      const n = e.code.startsWith('Digit') ? +e.code.slice(5) : 0
      if (!n) return
      // first digit picks the category, the second the item, as in the old menu
      if (!game.buyCat) {
        const c = Object.entries(CAT_KEY).find(([, k]) => k === n)?.[0]
        if (c) { setCat(c); game.buyCat = c }
      } else {
        const id = BUY_MENU[me.team][game.buyCat][n - 1]
        if (id) doBuy(id)
        game.buyCat = null
      }
    }
    game.buyCat = null
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!canBuy(me)) { game.buyOpen = false; onClose() }
  })

  return (
    <div className="buymenu" onMouseDown={e => e.stopPropagation()}>
      <div className="bm-head">
        <h2>MUA ĐỒ</h2>
        <div className="bm-money">${me.money}</div>
        <div className="bm-time">còn {Math.ceil(buyTimeLeft())}s</div>
        <button className="bm-close" onClick={() => { game.buyOpen = false; onClose() }}>✕</button>
      </div>
      <div className="bm-body">
        <div className="bm-cats">
          {CATS.map(c => (
            <button key={c.key} className={cat === c.key ? 'on' : ''} onClick={() => setCat(c.key)}>
              <kbd>{CAT_KEY[c.key]}</kbd>{c.label}
            </button>
          ))}
        </div>
        <div className="bm-items">
          {list.map((id, i) => {
            const w = W[id], g = GEAR[id]
            const def = w || g
            const price = priceOf(me, id)
            const owned = w ? (w.slot === 4 ? me.inv[4].filter(x => x.id === id).length >= (w.max ?? 1) : me.inv[w.slot]?.id === id)
              : id === 'defuser' ? me.defuser : id === 'vest' ? me.armor >= 100 : me.armor >= 100 && me.helmet
            const poor = me.money < price
            return (
              <button key={id} className={`bm-item${owned ? ' owned' : ''}${poor ? ' poor' : ''}`} onClick={() => doBuy(id)}>
                <kbd>{i + 1}</kbd>
                <div className="bm-name">{def.name}</div>
                <div className="bm-price">${price}</div>
                {w?.damage && (
                  <div className="bm-stats">
                    <Stat label="Sát thương" v={w.damage} max={115} />
                    <Stat label="Tốc bắn" v={60 / w.cycle} max={900} />
                    <Stat label="Chính xác" v={100 - Math.min(100, w.inacc.stand * 3)} max={100} />
                    <Stat label="Giáp xuyên" v={w.armorRatio} max={2} />
                    <div className="bm-meta">{w.clip}/{w.reserve} · thưởng kill ${w.killAward}</div>
                  </div>
                )}
                {owned && <div className="bm-owned">ĐÃ CÓ</div>}
              </button>
            )
          })}
        </div>
      </div>
      {msg && <div className="bm-msg">{msg}</div>}
      <div className="bm-foot">B / Esc để đóng · phím số: nhóm rồi món (vd. 4 → 2)</div>
    </div>
  )
}
