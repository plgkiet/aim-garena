import * as THREE from 'three'
import { RULES, U } from './constants'
import { game, emit, makeAgent, alive, centerMessage, eyePos } from './state'
import { W, GEAR } from './weapons'
import { giveWeapon, switchTo, bestSlot, newInstance, clearTimers } from './weaponLogic'
import { armorDamage, applyDamage } from './combat'
import { SPAWNS, BUY_ZONES, inZone, siteAt, map, setMap } from '../world/mapData'
import { groundHeight, lineClear } from '../world/collision'
import { initBot, botsRoundStart } from './bots'

/* Competitive rules: freeze time, buy time, 1:55 rounds, the bomb, CS:GO's
   economy with its loss bonus ladder, halftime side swap and MR15. */

const BOT_NAMES = [
  'Albert', 'Bert', 'Cecil', 'Clarence', 'Elliot', 'Elmer', 'Ernie', 'Fergus', 'Frank', 'Graham',
  'Harvey', 'Irwin', 'Lester', 'Marvin', 'Neil', 'Opie', 'Ringo', 'Shark', 'Ulric', 'Vinny',
  'Wade', 'Xavier', 'Yanni', 'Zach', 'Brett', 'Kurt', 'Moe', 'Pete', 'Rock', 'Walt',
]

/* Per-mode timings. The aim duel keeps rounds short and snappy. */
const MODE = {
  comp: { freeze: RULES.mp_freezetime, round: RULES.mp_roundtime, restart: RULES.mp_round_restart_delay, halftime: true, bomb: true, buy: true },
  aim: { freeze: 2, round: 60, restart: 2.5, halftime: false, bomb: false, buy: false },
}
const cfg = () => MODE[game.mode] || MODE.comp

export function startMatch(settings) {
  Object.assign(game.settings, settings)
  game.mode = settings.mode === 'aim' ? 'aim' : 'comp'
  setMap(game.mode === 'aim' ? 'aim' : 'dust2')
  clearTimers()
  game.agents = []
  game.time = 0
  game.round = 0
  game.maxRounds = settings.maxRounds
  game.score = { T: 0, CT: 0 }
  game.lossStreak = { T: 1, CT: 1 }
  game.history = []
  game.killfeed = []
  game.drops = []
  game.grenades = []
  game.smokes = []
  game.center = null
  game.hitConfirm = -10
  game.damageDirs = []

  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5)
  const me = makeAgent({ name: settings.playerName || 'Bạn', team: settings.team, isBot: false })
  game.local = me
  game.agents.push(me)
  for (const team of ['T', 'CT']) {
    // solo aim: just you against the bots
    const count = game.mode === 'aim'
      ? (team === settings.team ? 0 : settings.aimBots || 1)
      : team === settings.team ? settings.teamSize - 1 : settings.teamSize
    for (let i = 0; i < count; i++) {
      const b = makeAgent({ name: names.pop(), team, isBot: true })
      initBot(b, settings.difficulty)
      game.agents.push(b)
    }
  }
  for (const a of game.agents) a.money = RULES.mp_startmoney
  startRound(true)
}

function defaultPistol(team) { return team === 'T' ? 'glock' : 'usp' }

function resetLoadout(a) {
  a.inv = { 1: null, 2: newInstance(defaultPistol(a.team)), 3: { id: 'knife' }, 4: [], 5: null }
  a.armor = 0; a.helmet = false; a.defuser = false
  if (game.mode === 'aim') {
    // everyone gets the chosen gun, full armour, every round
    const id = game.settings.aimWeapon || 'ak47'
    if (W[id].slot === 1) a.inv[1] = newInstance(id)
    else a.inv[2] = newInstance(id)
    a.armor = 100; a.helmet = true
  }
}

export function startRound(fresh = false) {
  game.round++
  clearTimers()
  game.drops = []
  game.grenades = []
  game.smokes = []
  game.roundWinner = null
  game.spectate = null

  const spawnIdx = { T: 0, CT: 0 }
  const spawnOrder = { T: [...SPAWNS.T].sort(() => Math.random() - 0.5), CT: [...SPAWNS.CT].sort(() => Math.random() - 0.5) }
  for (const a of game.agents) {
    if (fresh || !a.alive || game.mode === 'aim') resetLoadout(a)
    a.inv[5] = null
    a.alive = true
    a.hp = 100
    const [x, z, y] = spawnOrder[a.team][spawnIdx[a.team]++ % spawnOrder[a.team].length]
    a.pos.set(x, groundHeight(x, z, 0.2, y + 1), z)
    a.vel.set(0, 0, 0)
    a.yaw = map.SPAWN_YAW[a.team]
    a.pitch = 0
    a.duck = 0; a.ducking = false; a.onGround = true
    a.velMod = 1
    a.lean = 0
    a.planting = 0; a.defusing = 0
    a.flashUntil = 0; a.flashAmount = 0
    a.damageBy.clear()
    a.killedBy = null
    const ws = a.w
    ws.punch.x = ws.punch.y = 0
    ws.penalty = 0; ws.shots = 0; ws.zoom = 0; ws.reloadEnd = 0; ws.throwing = 0; ws.knifePending = null
    ws.nextAttack = 0
    a.active = -1
    switchTo(a, bestSlot(a), { quiet: true })
  }

  // one T carries the bomb (competitive only)
  const ts = game.agents.filter(a => a.team === 'T')
  const carrier = cfg().bomb ? ts[Math.floor(Math.random() * ts.length)] : null
  game.bomb = carrier
    ? { state: 'carried', carrier, pos: carrier.pos.clone(), site: null, plantedAt: 0, defuser: null, nextBeep: 0 }
    : null
  if (carrier) carrier.inv[5] = { id: 'c4' }

  game.phase = 'freeze'
  game.phaseEnd = game.time + cfg().freeze
  game.flash = 0
  botsRoundStart()
  emit('roundStart', { round: game.round })
}

/* ----------------------------------------------------------------- buy --- */

export function inBuyZone(a) {
  return inZone(BUY_ZONES[a.team], a.pos.x, a.pos.z)
}
export function canBuy(a) {
  if (!cfg().buy) return false
  if (!a.alive || !inBuyZone(a)) return false
  if (game.phase === 'freeze') return true
  return (game.phase === 'live') && game.time - game.roundStart < RULES.mp_buytime
}
export function buyTimeLeft() {
  if (game.phase === 'freeze') return RULES.mp_buytime + (game.phaseEnd - game.time)
  if (game.phase === 'live') return Math.max(0, RULES.mp_buytime - (game.time - game.roundStart))
  return 0
}

export function priceOf(a, item) {
  if (item === 'vesthelm' && a.armor >= 100 && !a.helmet) return 350
  return (W[item] ?? GEAR[item]).price
}

/** @returns {string|null} a reason it failed, or null on success */
export function buy(a, item) {
  if (!canBuy(a)) return 'Không ở trong vùng mua'
  const w = W[item], g = GEAR[item]
  const def = w || g
  if (!def) return 'Không có'
  if (def.team && def.team !== 'both' && def.team !== a.team) return 'Sai phe'
  const price = priceOf(a, item)
  if (a.money < price) return 'Không đủ tiền'
  if (g) {
    if (item === 'vest') { if (a.armor >= 100) return 'Đã có giáp'; a.armor = 100 }
    if (item === 'vesthelm') { if (a.armor >= 100 && a.helmet) return 'Đã có giáp'; a.armor = 100; a.helmet = true }
    if (item === 'defuser') { if (a.defuser) return 'Đã có kit'; a.defuser = true }
    a.money -= price
    emit('buy', { agent: a, item })
    return null
  }
  if (w.slot === 4) {
    const same = a.inv[4].filter(x => x.id === item).length
    if (same >= (w.max ?? 1)) return 'Đã đủ'
    if (a.inv[4].length >= 4) return 'Hết chỗ lựu đạn'
  } else if (a.inv[w.slot]?.id === item) return 'Đã có'
  a.money -= price
  const old = giveWeapon(a, item)
  if (old) dropWeapon(a, old, false)
  if (w.slot !== 4) switchTo(a, w.slot)
  emit('buy', { agent: a, item })
  return null
}

/* --------------------------------------------------------------- drops --- */

const _eye = new THREE.Vector3()
export function dropWeapon(a, inst, thrown = true) {
  eyePos(a, _eye)
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw)
  const pos = thrown ? _eye.clone().add(new THREE.Vector3(fx * 0.4, -0.25, fz * 0.4)) : a.pos.clone().setY(a.pos.y + 0.9)
  const vel = thrown ? new THREE.Vector3(fx * 3.4 + a.vel.x, 1.8, fz * 3.4 + a.vel.z) : new THREE.Vector3((Math.random() - 0.5) * 1.5, 1, (Math.random() - 0.5) * 1.5)
  const d = { key: Math.random(), inst, pos, vel, rotY: a.yaw + (Math.random() - 0.5), t: game.time, by: a.id }
  game.drops.push(d)
  if (inst.id === 'c4' && game.bomb) {
    game.bomb.state = 'dropped'
    game.bomb.carrier = null
    game.bomb.drop = d
    emit('bombDropped', { agent: a })
  }
  return d
}

/** G — throw away the held weapon. */
export function dropActive(a) {
  if (!a.alive) return
  const slot = a.active
  if (slot === 3) return
  let inst
  if (slot === 4) inst = a.inv[4].shift()
  else { inst = a.inv[slot]; a.inv[slot] = null }
  if (!inst) return
  dropWeapon(a, inst, true)
  switchTo(a, slot === 4 && a.inv[4].length ? 4 : bestSlot(a), { quiet: true })
}

function takeDrop(a, d) {
  const w = W[d.inst.id]
  if (w.slot === 4) {
    if (a.inv[4].length >= 4 || a.inv[4].filter(x => x.id === d.inst.id).length >= (w.max ?? 1)) return false
    a.inv[4].push(d.inst)
  } else {
    if (a.inv[w.slot]) return false
    a.inv[w.slot] = d.inst
  }
  game.drops.splice(game.drops.indexOf(d), 1)
  if (d.inst.id === 'c4' && game.bomb) {
    game.bomb.state = 'carried'; game.bomb.carrier = a; game.bomb.drop = null
    emit('bombPickup', { agent: a })
  }
  emit('pickup', { agent: a, weapon: d.inst.id })
  if (a.isBot && w.slot < a.active) switchTo(a, w.slot)
  return true
}

/** E — swap the weapon you are looking at for the one in its slot. */
export function pickupAimed(a) {
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw)
  let best = null, bestScore = Infinity
  for (const d of game.drops) {
    if (d.inst.id === 'c4' && a.team !== 'T') continue
    const dx = d.pos.x - a.pos.x, dz = d.pos.z - a.pos.z
    const dist = Math.hypot(dx, dz)
    if (dist > 2) continue
    const facing = (dx * fx + dz * fz) / (dist || 1)
    if (facing < 0.3 && dist > 0.8) continue
    const s = dist - facing
    if (s < bestScore) { bestScore = s; best = d }
  }
  if (!best) return false
  const w = W[best.inst.id]
  if (w.slot !== 4 && a.inv[w.slot]) {
    const old = a.inv[w.slot]
    a.inv[w.slot] = null
    dropWeapon(a, old, true)
  }
  const ok = takeDrop(a, best)
  if (ok && w.slot !== 4) switchTo(a, w.slot)
  return ok
}

function updateDrops(dt) {
  for (const d of game.drops) {
    if (d.rest) continue
    d.vel.y -= 20 * dt
    d.pos.addScaledVector(d.vel, dt)
    const g = groundHeight(d.pos.x, d.pos.z, 0.05, d.pos.y + 0.3)
    if (d.pos.y <= g + 0.04) {
      d.pos.y = g + 0.04
      d.vel.multiplyScalar(0.3); d.vel.y = 0
      if (d.vel.lengthSq() < 0.01) d.rest = true
    }
  }
  // walking over a weapon picks it up if the slot is free
  for (const a of game.agents) {
    if (!a.alive) continue
    for (const d of [...game.drops]) {
      if (game.time - d.t < (d.by === a.id ? 1.2 : 0.3)) continue
      if (Math.hypot(d.pos.x - a.pos.x, d.pos.z - a.pos.z) > 0.8 || Math.abs(d.pos.y - a.pos.y) > 1.2) continue
      if (d.inst.id === 'c4' && a.team !== 'T') continue
      takeDrop(a, d)
    }
  }
}

/* ---------------------------------------------------------------- bomb --- */

export function canPlant(a) {
  return a.alive && a.inv[5]?.id === 'c4' && a.onGround && !!siteAt(a.pos.x, a.pos.z) &&
    (game.phase === 'live')
}

function plantBomb(a) {
  const b = game.bomb
  a.inv[5] = null
  b.state = 'planted'
  b.carrier = null
  b.pos = a.pos.clone()
  b.pos.x += -Math.sin(a.yaw) * 0.35
  b.pos.z += -Math.cos(a.yaw) * 0.35
  b.pos.y = groundHeight(b.pos.x, b.pos.z, 0.05, a.pos.y + 0.3)
  b.site = siteAt(a.pos.x, a.pos.z)
  b.plantedAt = game.time
  b.planter = a
  b.nextBeep = game.time
  a.money = Math.min(RULES.mp_maxmoney, a.money + RULES.reward.plant)
  a.score += 2
  a.planting = 0
  switchTo(a, bestSlot(a), { quiet: true })
  centerMessage('Bom đã được đặt', 3, 'T')
  emit('bombPlanted', { agent: a, site: b.site })
}

function explodeBomb() {
  const b = game.bomb
  b.state = 'exploded'
  emit('explode', { pos: b.pos.clone(), type: 'c4' })
  const radius = 1100 * U, sigma = radius / 3
  for (const a of game.agents) {
    if (!a.alive) continue
    const d = a.pos.distanceTo(b.pos)
    if (d > radius) continue
    const dmg = 500 * Math.exp(-(d * d) / (2 * sigma * sigma))
    const [hp, ap] = armorDamage(dmg, a, 'chest', 1)
    applyDamage(a, null, hp, ap, { weapon: 'c4', group: 'chest', dir: a.pos.clone().sub(b.pos).normalize() })
  }
  endRound('T', 'bomb')
}

function updateBomb(dt) {
  const b = game.bomb
  if (!b) return
  if (b.state === 'carried' && b.carrier) {
    b.pos.copy(b.carrier.pos)
    if (!b.carrier.alive) {
      // the carrier died holding it: it falls where they fell
      const inst = b.carrier.inv[5]
      b.carrier.inv[5] = null
      if (inst) dropWeapon(b.carrier, inst, false)
    }
  }
  if (b.state === 'dropped' && b.drop) b.pos.copy(b.drop.pos)

  // planting
  for (const a of game.agents) {
    if (!a.alive) continue
    if (a.wantPlant && a.active === 5 && canPlant(a)) {
      if (a.planting === 0) emit('plantStart', { agent: a })
      a.planting += dt
      if (a.planting >= RULES.plantTime) plantBomb(a)
    } else a.planting = 0
  }

  if (b.state !== 'planted') return
  // beeps speed up as the timer runs down
  const left = b.plantedAt + RULES.mp_c4timer - game.time
  if (game.time >= b.nextBeep && left > 0) {
    emit('bombBeep', { pos: b.pos, left })
    b.nextBeep = game.time + THREE.MathUtils.clamp(left / 40, 0.12, 1)
  }
  // defusing
  let defuser = null
  for (const a of game.agents) {
    if (!a.alive || a.team !== 'CT') { a.defusing = 0; continue }
    const eye = eyePos(a, _eye)
    const near = eye.distanceTo(b.pos) < 1.9 && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.4
    if (a.wantUse && near && a.onGround && lineClear(eye.x, eye.y, eye.z, b.pos.x, b.pos.y + 0.15, b.pos.z)) {
      if (a.defusing === 0) emit('defuseStart', { agent: a })
      a.defusing += dt
      defuser = a
      const need = a.defuser ? RULES.defuseTimeKit : RULES.defuseTime
      if (a.defusing >= need) {
        b.state = 'defused'
        b.defuserFinal = a
        a.money = Math.min(RULES.mp_maxmoney, a.money + RULES.reward.defuse)
        a.score += 2
        emit('bombDefused', { agent: a })
        endRound('CT', 'defuse')
        return
      }
    } else a.defusing = 0
  }
  b.defuser = defuser
  if (left <= 0) explodeBomb()
}

/* --------------------------------------------------------------- round --- */

export function endRound(winner, reason) {
  if (game.phase === 'roundEnd' || game.phase === 'matchEnd') return
  const loser = winner === 'T' ? 'CT' : 'T'
  game.phase = 'roundEnd'
  game.roundWinner = winner
  game.roundReason = reason
  game.phaseEnd = game.time + cfg().restart
  game.score[winner]++
  game.history.push({ winner, reason })

  const R = RULES.reward
  const winMoney = reason === 'bomb' ? R.bombWin : reason === 'defuse' ? R.defuseWin : reason === 'time' ? R.timeWin : R.eliminationWin
  const lossBonus = Math.min(R.lossBase + R.lossStep * (game.lossStreak[loser] - 1), R.lossMax)
  const planted = game.bomb?.plantedAt > 0 && game.bomb.state !== 'carried' && game.bomb.state !== 'dropped'
  for (const a of game.agents) {
    let add = 0
    if (a.team === winner) add = winMoney
    else {
      add = lossBonus
      if (a.team === 'T' && planted) add += R.plantBonus
      // Ts still alive when the clock runs out get nothing
      if (a.team === 'T' && reason === 'time' && a.alive) add = 0
    }
    a.money = Math.min(RULES.mp_maxmoney, a.money + add)
  }
  game.lossStreak[loser] = Math.min(5, game.lossStreak[loser] + 1)
  game.lossStreak[winner] = Math.max(1, game.lossStreak[winner] - 1)

  // MVP: most kills on the winning side, or the planter / defuser
  let mvp = null
  if (reason === 'defuse') mvp = game.bomb.defuserFinal || game.agents.find(a => a.team === 'CT' && a.defusing > 0)
  if (reason === 'bomb') mvp = game.bomb.planter
  if (!mvp) {
    const roundKills = new Map()
    for (const k of game.killfeed) if (k.killer && k.t >= game.roundStart) roundKills.set(k.killer, (roundKills.get(k.killer) || 0) + 1)
    let best = 0
    for (const [a, n] of roundKills) if (a.team === winner && n > best) { best = n; mvp = a }
  }
  if (mvp) mvp.mvps++
  game.mvp = mvp

  const text = winner === 'T' ? 'Terrorists Win' : 'Counter-Terrorists Win'
  const aimText = winner === game.local?.team ? 'Bạn thắng round' : 'Bot thắng round'
  centerMessage(game.mode === 'aim' ? aimText : text, cfg().restart - 0.5, winner)
  emit('roundEnd', { winner, reason, mvp })
}

function checkRound() {
  if (game.phase !== 'live') return
  const tAlive = alive('T').length, ctAlive = alive('CT').length
  const planted = game.bomb?.state === 'planted'
  if (ctAlive === 0) return endRound('T', 'elimination')
  if (tAlive === 0 && !planted) return endRound('CT', 'elimination')
  if (!planted && game.time >= game.phaseEnd) return endRound('CT', 'time')
}

function swapSides() {
  for (const a of game.agents) {
    a.team = a.team === 'T' ? 'CT' : 'T'
    a.money = RULES.mp_startmoney
    a.alive = false                      // forces a fresh loadout
  }
  game.score = { T: game.score.CT, CT: game.score.T }
  game.lossStreak = { T: 1, CT: 1 }
  game.settings.team = game.local.team
}

export function updateRules(dt) {
  switch (game.phase) {
    case 'freeze':
      if (game.time >= game.phaseEnd) {
        game.phase = 'live'
        game.roundStart = game.time
        game.phaseEnd = game.time + cfg().round
        emit('roundLive', {})
      }
      break
    case 'live':
      updateBomb(dt)
      checkRound()
      break
    case 'roundEnd': {
      updateBomb(dt)
      if (game.time < game.phaseEnd) break
      const half = game.maxRounds / 2
      const played = game.score.T + game.score.CT
      if (game.score.T > half || game.score.CT > half || played >= game.maxRounds) {
        game.phase = 'matchEnd'
        emit('matchEnd', {})
        break
      }
      if (played === half && cfg().halftime) {
        swapSides()
        centerMessage('Đổi phe — Hết hiệp 1', 4)
        emit('halftime', {})
        startRound(true)
        break
      }
      startRound()
      break
    }
    default:
      break
  }
  updateDrops(dt)
}
