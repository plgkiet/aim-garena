import { useState } from 'react'
import { game } from '../game/state'
import { startMatch } from '../game/rules'
import { KNIVES, KNIFE_ORDER } from '../lib/knives'
import { knife } from '../lib/knifeController'
import { isMuted, setMuted, unlockAudio } from '../lib/audio'
import { Scoreboard } from './Scoreboard'
import { NAV } from '../game/nav'
import { loadLevel } from '../world/level'
import { W } from '../game/weapons'

const DIFFS = [
  { key: 'easy', label: 'Dễ' },
  { key: 'normal', label: 'Thường' },
  { key: 'hard', label: 'Khó' },
  { key: 'expert', label: 'Chuyên gia' },
]

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem('csgo-bots-prefs') || '{}') } catch { return {} }
}
function savePrefs(p) {
  try { localStorage.setItem('csgo-bots-prefs', JSON.stringify(p)) } catch { /* private mode */ }
}

function Controls() {
  return (
    <div className="controls">
      <div><kbd>WASD</kbd> di chuyển · <kbd>Shift</kbd>/<kbd>Ctrl</kbd> ngồi (không kêu) · <kbd>Space</kbd> nhảy</div>
      <div><kbd>Q</kbd>/<kbd>E</kbd> nghiêng trái/phải · <kbd>LMB</kbd> bắn · <kbd>RMB</kbd> ngắm (ADS) / scope / đâm dao · <kbd>R</kbd> nạp đạn</div>
      <div><kbd>1</kbd>–<kbd>5</kbd> đổi súng · <kbd>X</kbd> súng trước · <kbd>G</kbd> vứt súng · <kbd>F</kbd> nhặt / gỡ bom · <kbd>V</kbd> inspect</div>
      <div>Cầm dao: <kbd>6</kbd> <kbd>7</kbd> <kbd>0</kbd> <kbd>T</kbd> <kbd>Y</kbd> <kbd>U</kbd> <kbd>H</kbd> múa dao</div>
      <div><kbd>B</kbd> mua đồ · <kbd>Tab</kbd> bảng điểm · <kbd>M</kbd> tắt tiếng · <kbd>Esc</kbd> tạm dừng</div>
    </div>
  )
}

export function MainMenu({ onStart }) {
  const prefs = loadPrefs()
  const [team, setTeam] = useState(prefs.team || 'CT')
  const [diff, setDiff] = useState(prefs.difficulty || 'normal')
  const [rounds, setRounds] = useState(prefs.maxRounds || 16)
  const [size, setSize] = useState(prefs.teamSize || 5)
  const [sens, setSens] = useState(prefs.sensitivity || 2)
  const [knifeKey, setKnifeKey] = useState(prefs.knife || KNIFE_ORDER[0])
  const [name, setName] = useState(prefs.name || 'Bạn')
  const [mode, setMode] = useState(prefs.mode || 'comp')
  const [aimWeapon, setAimWeapon] = useState(prefs.aimWeapon || 'ak47')
  const [aimBots, setAimBots] = useState(prefs.aimBots || 1)
  const [aimRounds, setAimRounds] = useState(prefs.aimRounds || 10)
  const [loading, setLoading] = useState(false)

  const start = async () => {
    const aim = mode === 'aim'
    const settings = {
      mode, team: aim ? 'CT' : team, difficulty: diff, teamSize: size, sensitivity: sens, playerName: name.trim() || 'Bạn',
      maxRounds: aim ? aimRounds * 2 - 1 : rounds, aimWeapon, aimBots,
    }
    savePrefs({ team, difficulty: diff, maxRounds: rounds, teamSize: size, sensitivity: sens, knife: knifeKey, name, mode, aimWeapon, aimBots, aimRounds })
    knife.setKnife(knifeKey)
    unlockAudio()
    setLoading(true)
    await loadLevel(aim ? 'aim' : 'dust2')
    setLoading(false)
    startMatch(settings)
    onStart()
  }

  return (
    <div className="menu">
      <div className="menu-card">
        <div className="logo">COUNTER<span>-</span>STRIKE <em>bot match</em></div>
        <p className="sub">de_dust2 · Competitive · bắn với máy</p>

        <div className="row">
          <label>Chế độ</label>
          <div className="seg">
            <button className={mode === 'comp' ? 'on' : ''} onClick={() => setMode('comp')}>Competitive · de_dust2</button>
            <button className={mode === 'aim' ? 'on' : ''} onClick={() => setMode('aim')}>Solo aim · aim_arena</button>
          </div>
        </div>
        {mode === 'aim' && (<>
          <div className="row">
            <label>Súng</label>
            <div className="seg">
              {['ak47', 'm4a1s', 'awp', 'ssg08', 'deagle', 'usp'].map(id => (
                <button key={id} className={aimWeapon === id ? 'on' : ''} onClick={() => setAimWeapon(id)}>{W[id].name}</button>
              ))}
            </div>
          </div>
          <div className="row">
            <label>Số bot</label>
            <div className="seg">
              {[1, 2, 3, 5].map(n => <button key={n} className={aimBots === n ? 'on' : ''} onClick={() => setAimBots(n)}>1 vs {n}</button>)}
            </div>
          </div>
          <div className="row">
            <label>Thắng khi đạt</label>
            <div className="seg">
              {[5, 10, 15].map(n => <button key={n} className={aimRounds === n ? 'on' : ''} onClick={() => setAimRounds(n)}>{n} round</button>)}
            </div>
          </div>
        </>)}
        {mode === 'comp' && (<>
        <div className="row">
          <label>Phe</label>
          <div className="seg">
            <button className={`ct ${team === 'CT' ? 'on' : ''}`} onClick={() => setTeam('CT')}>Counter-Terrorist</button>
            <button className={`t ${team === 'T' ? 'on' : ''}`} onClick={() => setTeam('T')}>Terrorist</button>
          </div>
        </div>
        <div className="row">
          <label>Số round</label>
          <div className="seg">
            <button className={rounds === 16 ? 'on' : ''} onClick={() => setRounds(16)}>MR8 (ngắn)</button>
            <button className={rounds === 30 ? 'on' : ''} onClick={() => setRounds(30)}>MR15 (đầy đủ)</button>
          </div>
        </div>
        <div className="row">
          <label>Số người mỗi đội</label>
          <div className="seg">
            {[2, 3, 5].map(n => <button key={n} className={size === n ? 'on' : ''} onClick={() => setSize(n)}>{n}v{n}</button>)}
          </div>
        </div>
        </>)}
        <div className="row">
          <label>Độ khó bot</label>
          <div className="seg">
            {DIFFS.map(d => <button key={d.key} className={diff === d.key ? 'on' : ''} onClick={() => setDiff(d.key)}>{d.label}</button>)}
          </div>
        </div>
        <div className="row">
          <label>Độ nhạy chuột <b>{sens.toFixed(2)}</b></label>
          <input type="range" min="0.3" max="6" step="0.05" value={sens} onChange={e => setSens(+e.target.value)} />
        </div>
        <div className="row">
          <label>Dao</label>
          <div className="seg">
            {KNIFE_ORDER.map(k => <button key={k} className={knifeKey === k ? 'on' : ''} onClick={() => setKnifeKey(k)}>{KNIVES[k].name} {KNIVES[k].skin.replace('★ | ', '')}</button>)}
          </div>
        </div>
        <div className="row">
          <label>Tên</label>
          <input className="name" value={name} maxLength={16} onChange={e => setName(e.target.value)} />
        </div>

        <button className="play" onClick={start} disabled={!NAV.ready || loading}>{NAV.ready && !loading ? 'VÀO TRẬN' : 'ĐANG TẢI MAP…'}</button>
        <Controls />
      </div>
    </div>
  )
}

export function PauseMenu({ onResume }) {
  const [muted, setM] = useState(isMuted())
  const [sens, setSens] = useState(game.settings.sensitivity)
  return (
    <div className="menu pause" onClick={onResume}>
      <div className="menu-card small" onClick={e => e.stopPropagation()}>
        <div className="logo small">TẠM DỪNG</div>
        <div className="row">
          <label>Độ nhạy chuột <b>{sens.toFixed(2)}</b></label>
          <input type="range" min="0.3" max="6" step="0.05" value={sens} onChange={e => { setSens(+e.target.value); game.settings.sensitivity = +e.target.value }} />
        </div>
        <div className="row">
          <label>Âm thanh</label>
          <div className="seg">
            <button className={!muted ? 'on' : ''} onClick={() => { setMuted(false); setM(false) }}>Bật</button>
            <button className={muted ? 'on' : ''} onClick={() => { setMuted(true); setM(true) }}>Tắt</button>
          </div>
        </div>
        <button className="play" onClick={onResume}>TIẾP TỤC</button>
        <button className="ghost" onClick={() => { game.phase = 'menu'; game.local = null; game.agents = []; game.paused = false; document.exitPointerLock?.() }}>Thoát ra menu</button>
        <Controls />
      </div>
    </div>
  )
}

export function MatchEnd({ onRestart }) {
  const me = game.local
  const mine = game.score[me.team], theirs = game.score[me.team === 'T' ? 'CT' : 'T']
  const res = mine > theirs ? 'THẮNG' : mine < theirs ? 'THUA' : 'HOÀ'
  return (
    <div className="menu">
      <div className="menu-card wide">
        <div className={`logo result ${mine > theirs ? 'win' : mine < theirs ? 'lose' : ''}`}>{res} {mine} : {theirs}</div>
        <Scoreboard />
        <button className="play" onClick={() => { startMatch({ ...game.settings, maxRounds: game.maxRounds, teamSize: game.agents.filter(a => a.team === 'T').length, team: game.settings.team }); onRestart() }}>ĐÁNH LẠI</button>
        <button className="ghost" onClick={() => { game.phase = 'menu'; game.local = null; game.agents = [] }}>Về menu</button>
      </div>
    </div>
  )
}
