import { game, on } from '../game/state'
import { inventory } from './inventory'

/* Every enemy the local player kills earns one case opening (two for a headshot), in every mode and
   with any weapon (knife and grenade kills included). Team kills and deaths
   to the world earn nothing. */
on('kill', ({ victim, attacker, info }) => {
  const me = game.local
  if (!me || attacker !== me || victim === me || victim.team === me.team) return
  // a headshot is worth two
  const n = info?.headshot ? 2 : 1
  inventory.addSpins(n)
  game.spinToast = game.time
  game.spinToastN = n
})
