import { MOVES, flourishesFor } from './moves'
import { KNIFE_ORDER } from './knives'

/* Tiny event bus so the HUD, the input layer and the viewmodel agree on
   which trick is playing without re-rendering the canvas every frame. */
const listeners = new Set()

export const knife = {
  move: null,      // key into MOVES
  t: 0,            // seconds into the move
  seq: 0,          // bumped on every playback start — replaying the *same* move
                   // still has to re-arm its sound cues and its hit trace
  knifeKey: KNIFE_ORDER[0],
  flourish: 0,     // which of this knife's flourishes R plays next
  play(name, { force = false } = {}) {
    // R: the next flourish in turn, from this knife's own list
    const list = flourishesFor(knife.knifeKey)
    if (name === 'next') name = list[knife.flourish % list.length]
    // a knife can have its own inspect (the Butterfly's fan-open)
    if (name === 'inspect' && MOVES[`${knife.knifeKey}Inspect`]) name = `${knife.knifeKey}Inspect`
    if (!MOVES[name]) return false
    // light actions can interrupt long flourishes, tricks cannot cut each other off
    const heavy = knife.move && MOVES[knife.move].duration - knife.t > 0.12
    const interruptible = ['stab', 'slash'].includes(name)
    if (heavy && !force && !interruptible) return false
    if (list.includes(name)) knife.flourish = list.indexOf(name) + 1
    knife.move = name
    knife.t = 0
    knife.seq++
    emit()
    return true
  },
  stop() { knife.move = null; knife.t = 0; emit() },
  setKnife(key) {
    if (knife.knifeKey === key) return
    knife.knifeKey = key
    knife.flourish = 0
    knife.move = 'deploy'
    knife.t = 0
    knife.seq++
    emit()
  },
  /** Tell the view a knife's finish changed (a new Case Hardened pattern). */
  refresh() { emit() },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
}

function emit() { for (const fn of listeners) fn(knife) }
export const notify = emit
