/* Source engine constants, converted once to metres.

   CS:GO measures everything in Hammer units (1 unit = 1 inch). The gameplay
   code runs in metres so it can share the three.js scene, but every number
   below is the engine's own value multiplied by U, so it can be checked against
   the CS:GO console one for one. */

export const U = 0.0254
export const D2R = Math.PI / 180
export const R2D = 180 / Math.PI

/** Movement cvars (competitive defaults). */
export const MOVE = {
  sv_gravity: 800 * U,
  sv_friction: 5.2,
  sv_accelerate: 5.5,
  sv_airaccelerate: 12,
  sv_stopspeed: 80 * U,
  sv_air_max_wishspeed: 30 * U,
  sv_jump_impulse: 301.993377 * U,
  sv_maxspeed: 320 * U,
  walk_modifier: 0.52,          // shift
  duck_modifier: 0.34,          // ctrl
  step: 18 * U + 0.01,
  radius: 16 * U,               // hull half width
  height: 72 * U,
  heightDuck: 54 * U,
  eye: 64.06 * U,
  eyeDuck: 46.04 * U,
  duckSpeed: 8,                 // 1/s — full duck in ~0.125s, like the game's snap
}

/** Round and economy rules. */
export const RULES = {
  mp_freezetime: 10,            // competitive uses 15; shortened for a bot match
  mp_buytime: 20,
  mp_roundtime: 115,            // 1:55
  mp_c4timer: 40,
  mp_round_restart_delay: 6,
  mp_startmoney: 800,
  mp_maxmoney: 16000,
  plantTime: 3.2,
  defuseTime: 10,
  defuseTimeKit: 5,
  reward: {
    eliminationWin: 3250,
    bombWin: 3500,
    defuseWin: 3500,
    timeWin: 3250,
    lossBase: 1400,
    lossStep: 500,
    lossMax: 3400,
    plantBonus: 800,            // Ts who lose after planting
    plant: 300,
    defuse: 300,
  },
  friendlyFire: false,
}

/** Weapon feel cvars. */
export const RECOIL = {
  weapon_recoil_scale: 2,
  view_recoil_tracking: 0.55,     // stock 0.45: the screen climbs a little more with the spray
  /* The game's 8 / 18 act on its punch *velocity* model; applied straight to
     the angle, as here, they snap a spray back in ~0.1 s. These give the same
     ~0.3 s return you see in game. Deviation, named on purpose. */
  weapon_recoil_decay2_exp: 5,
  weapon_recoil_decay2_lin: 4,
  /* Everything kicks harder than stock CS:GO — asked for, so it is a named
     multiplier on the spray curves rather than edited patterns. 1 = stock. */
  kick_scale: 2.2,
  view_kick_scale: 2,            // how hard the viewmodel itself jumps per shot
}

/** Horizontal FOV quoted at 4:3, as the game does, to a vertical FOV. */
export function hfovToVfov(hfov) {
  return 2 * Math.atan(Math.tan((hfov * D2R) / 2) * 0.75) * R2D
}
export const BASE_FOV = 90
