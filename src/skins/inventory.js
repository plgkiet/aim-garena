import { LEGACY_IDS, LEGACY_PATTERN, TRADE_COUNT, drawFromTier, itemById, nextTier, rollPattern, variantOf } from './catalog'

/* What you own and what you have equipped, kept in this browser.

   Items are stored by catalog id with a unique drop id, so opening the same
   skin twice gives two entries. `equipped` maps a weapon id (or 'knife') to
   the drop you carry into matches. */

const KEY = 'aimgarena.inventory.v1'

/** The slot an item is equipped in: its weapon, or 'knife' / 'gloves'. */
const slotFor = item => (item.kind === 'knife' ? 'knife' : item.kind === 'glove' ? 'gloves' : item.weapon)
const listeners = new Set()

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    // drops of skins since taken out of the catalog are dropped, and unequipped
    const items = (Array.isArray(raw.items) ? raw.items : [])
      // (a renamed item is a new id; one folded into a phased finish is an id and its phase)
      .map(d => { const to = LEGACY_IDS[d.id]; return !to ? d : typeof to === 'string' ? { ...d, id: to } : { ...d, id: to.id, pattern: to.pattern } })
      .map(d => (LEGACY_PATTERN[d.id] && !d.pattern ? { ...d, pattern: LEGACY_PATTERN[d.id] } : d))
      .filter(d => itemById(d.id))
    const uids = new Set(items.map(d => d.uid))
    // a drop stays equipped only in its own slot (an item may have moved weapon)
    const slotOfDrop = uid => { const it = itemById(items.find(d => d.uid === uid)?.id); return it && slotFor(it) }
    const equipped = {}
    for (const [, uid] of Object.entries(raw.equipped || {})) if (uids.has(uid)) equipped[slotOfDrop(uid)] = uid
    return {
      items, equipped, opened: raw.opened || 0,
      spins: Number.isFinite(raw.spins) ? raw.spins : 0, traded: raw.traded || 0,
    }
  } catch { return { items: [], equipped: {}, opened: 0, spins: 0, traded: 0 } }
}

let state = load()

/* A drop of a pattern-seeded finish keeps its pattern number; drops from
   before patterns existed get a steady one from their uid. */
function patternFor(drop) {
  if (drop.pattern) return drop.pattern
  let h = 0
  for (const ch of drop.uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 1 + (h % 1000)
}
const withPattern = (itemId, drop) => (itemById(itemId)?.seeded && !drop.pattern ? { ...drop, pattern: rollPattern(itemById(itemId)) } : drop)

const newUid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode: keep it in memory */ }
  for (const fn of listeners) fn(state)
}

export const inventory = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },

  /** Case keys: one is earned per kill, one is spent per opening. */
  addSpins(n = 1) {
    state = { ...state, spins: state.spins + n }
    save()
  },
  /** Take one key; false when there is none left. */
  spendSpin() {
    if (state.spins <= 0) return false
    state = { ...state, spins: state.spins - 1 }
    save()
    return true
  },

  /** Add a fresh drop and return it (`extra.pattern` pins a seeded finish's pattern). */
  add(itemId, extra = {}) {
    const drop = withPattern(itemId, { uid: newUid(), id: itemId, at: Date.now(), ...extra })
    state = { ...state, items: [drop, ...state.items], opened: state.opened + 1 }
    save()
    return drop
  },

  /** Trade five drops of one grade for a random item of the next grade.
      Returns the new drop, or null if the five don't make a valid contract. */
  tradeUp(uids) {
    const gone = new Set(uids)
    const drops = state.items.filter(d => gone.has(d.uid))
    if (gone.size !== TRADE_COUNT || drops.length !== TRADE_COUNT) return null
    const tiers = new Set(drops.map(d => itemById(d.id)?.tier))
    const up = tiers.size === 1 && nextTier([...tiers][0])
    if (!up) return null
    const prize = drawFromTier(up.slug)
    if (!prize) return null
    // (a jackpot stone comes drawn at its phase already)
    const pid = prize.baseId || prize.id
    const drop = withPattern(pid, { uid: newUid(), id: pid, at: Date.now(), via: 'tradeup', ...(prize.patternNo && { pattern: prize.patternNo }) })
    const equipped = Object.fromEntries(Object.entries(state.equipped).filter(([, uid]) => !gone.has(uid)))
    state = { ...state, items: [drop, ...state.items.filter(d => !gone.has(d.uid))], equipped, traded: state.traded + 1 }
    save()
    return drop
  },

  /** What a drop actually is: its catalog item, at its own pattern if seeded. */
  itemOf(drop) {
    const item = drop && itemById(drop.id)
    return item?.seeded ? variantOf(item, patternFor(drop)) : item
  },

  /** Empty the inventory and unequip everything; spins are kept. */
  clear() {
    state = { ...state, items: [], equipped: {} }
    save()
  },

  slotOf: slotFor,

  equip(uid) {
    const drop = state.items.find(d => d.uid === uid)
    const item = drop && itemById(drop.id)
    if (!item) return
    state = { ...state, equipped: { ...state.equipped, [inventory.slotOf(item)]: uid } }
    save()
  },

  unequip(slot) {
    const equipped = { ...state.equipped }
    delete equipped[slot]
    state = { ...state, equipped }
    save()
  },

  isEquipped(uid) { return Object.values(state.equipped).includes(uid) },

  /** The catalog item equipped in a slot ('ak47', 'knife', ...), or null. */
  equippedItem(slot) {
    const uid = state.equipped[slot]
    const drop = uid && state.items.find(d => d.uid === uid)
    return drop ? inventory.itemOf(drop) : null
  },
}
