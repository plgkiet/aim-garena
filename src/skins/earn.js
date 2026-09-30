import { game, on } from '../game/state'
import { inventory } from './inventory'

/* Every enemy the local player kills earns one case opening, in every mode and
   with any weapon (knife and grenade kills included). Team kills and deaths
   to the world earn nothing. */
on('kill', ({ victim, attacker }) => {
  const me = game.local
  if (!me || attacker !== me || victim === me || victim.team === me.team) return
  inventory.addSpins(1)
  game.spinToast = game.time
})
