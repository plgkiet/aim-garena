import { compile } from './anim'

/* Channels, all relative to the idle stance:
   px/py/pz  hand translation  (+x right, +y up, -z away from the camera)
   rx        tumble around the blade's flat axis   (end-over-end flip)
   ry        spin around the blade's long axis     (pen-roll, showing both faces)
   rz        rotation inside the blade plane       (helicopter / twirl)
   open      butterfly handles opening (0 closed, 1 fully open)
   off       how far the open left hand is tucked away (0 in frame, 1 gone)
   blur      motion-blur trail opacity hint for the HUD

   `keepOff` says the move is calm enough to leave the off hand where it is and
   let the `off` channel decide; without it the hand ducks out for the whole
   move, which is what you want with a blade whipping through where it stands. */

const TAU = Math.PI * 2

export const MOVES = {
  /* Pulled out after a weapon switch. */
  deploy: compile({
    label: 'Deploy',
    keepOff: true,
    keys: [
      { t: 0, px: 0.14, py: -0.42, pz: 0.16, rz: -1.9, rx: 0.7, open: 0.9 },
      { t: 0.22, px: 0.04, py: -0.10, pz: 0.02, rz: -0.7, rx: 0.15, open: 0.55, e: 'outCubic' },
      { t: 0.42, px: -0.01, py: 0.02, pz: -0.02, rz: 0.18, rx: -0.06, open: 0.1, e: 'outCubic' },
      { t: 0.62, px: 0, py: 0, pz: 0, rz: 0, rx: 0, open: 0, e: 'outElastic' },
    ],
  }),

  /* V — the CS:GO look-over: stands the blade up and rolls it a full turn on
     its long axis so both faces pass the camera; the off hand drops out. */
  inspect: compile({
    label: 'Inspect',
    keepOff: true,
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, off: 0 },
      { t: 0.34, py: -0.012, pz: -0.020, rz: -0.55, ry: 0.55, off: 0.45, e: 'outCubic' },
      { t: 0.78, py: -0.035, pz: -0.030, rz: -1.26, ry: Math.PI / 2, open: 0.2, off: 1, e: 'inOutCubic' },
      { t: 1.32, py: -0.038, pz: -0.030, rz: -1.3, ry: Math.PI, open: 0.35, off: 1, e: 'inOutCubic' },
      { t: 1.80, py: -0.028, pz: -0.020, rz: -1.1, ry: 3 * Math.PI / 2, open: 0.2, off: 0.9, e: 'inOutCubic' },
      { t: 2.24, py: -0.005, pz: 0, rz: -0.25, ry: TAU, open: 0, off: 0.25, e: 'outCubic' },
      { t: 2.60, px: 0, py: 0, pz: 0, rz: 0, ry: TAU, rx: 0, off: 0, e: 'outBack' },
    ],
  }),

  /* V on the Butterfly, after the CS2 inspect: the hand comes up to the
     middle of the screen, the handles fan wide open into a V with the blade
     standing up out of them, it is held there swaying a little, then the
     handles snap shut with a flick and it drops back to the hold. */
  bflyInspect: compile({
    label: 'Inspect',
    keepOff: true,
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, open: 0, off: 0 },
      { t: 0.22, px: -0.02, py: 0.03, pz: -0.01, rz: -0.25, ry: 0.15, open: 0.25, off: 0.6, e: 'outCubic' },
      { t: 0.55, px: -0.05, py: 0.075, pz: -0.03, rz: -0.62, ry: 0.35, rx: -0.1, open: 1, off: 1, e: 'outBack' },
      { t: 1.15, px: -0.055, py: 0.085, pz: -0.035, rz: -0.7, ry: 0.5, rx: -0.14, open: 1, off: 1, e: 'inOut' },
      { t: 1.75, px: -0.045, py: 0.08, pz: -0.03, rz: -0.55, ry: 0.25, rx: -0.06, open: 1, off: 1, e: 'inOut' },
      { t: 2.05, px: -0.02, py: 0.05, pz: -0.01, rz: -0.3, ry: 0.1, rx: TAU * 0.5, open: 0.4, blur: 0.8, off: 1, e: 'inCubic' },
      { t: 2.3, px: 0.005, py: 0.0, pz: 0.01, rz: 0.05, ry: 0, rx: TAU, open: 0, blur: 0, off: 0.5, e: 'outCubic' },
      { t: 2.6, px: 0, py: 0, pz: 0, rz: 0, ry: 0, rx: TAU, open: 0, off: 0, e: 'outBack' },
    ],
  }),

  /* LMB — quick jab. */
  stab: compile({
    label: 'Stab',
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rx: 0, rz: 0 },
      { t: 0.09, px: 0.05, py: -0.02, pz: 0.10, rx: 0.30, rz: -0.22, e: 'outQuart' },
      { t: 0.18, px: -0.05, py: 0.03, pz: -0.20, rx: -0.42, rz: 0.10, blur: 1, e: 'inQuart' },
      { t: 0.30, px: 0.01, py: 0.0, pz: 0.03, rx: 0.10, rz: -0.04, e: 'outCubic' },
      { t: 0.44, px: 0, py: 0, pz: 0, rx: 0, rz: 0, e: 'outElastic' },
    ],
  }),

  /* RMB — heavy slash across the screen. */
  slash: compile({
    label: 'Slash',
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rz: 0, ry: 0 },
      { t: 0.13, px: 0.16, py: 0.10, pz: 0.09, rz: -1.15, ry: -0.4, rx: 0.2, e: 'outCubic' },
      { t: 0.29, px: -0.24, py: -0.09, pz: -0.14, rz: 1.55, ry: 0.5, rx: -0.15, blur: 1, e: 'inQuart' },
      { t: 0.46, px: 0.03, py: 0.02, pz: 0.02, rz: -0.25, ry: -0.08, e: 'outCubic' },
      { t: 0.62, px: 0, py: 0, pz: 0, rz: 0, ry: 0, e: 'outElastic' },
    ],
  }),

  /* 6 — helicopter: three fast turns in the blade plane. */
  twirl: compile({
    label: 'Helicopter',
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rz: 0 },
      { t: 0.14, px: 0.02, py: -0.05, pz: 0.04, rz: -0.55, open: 0.2, e: 'outCubic' },
      { t: 0.42, px: -0.02, py: 0.02, pz: -0.05, rz: -TAU, open: 0.85, blur: 1, e: 'linear' },
      { t: 0.70, rz: -2 * TAU, open: 0.85, blur: 1, e: 'linear' },
      { t: 1.00, rz: -3 * TAU, open: 0.5, blur: 0.8, e: 'linear' },
      { t: 1.22, px: 0.01, py: -0.02, pz: 0.02, rz: -3 * TAU - 0.5, open: 0.1, e: 'outCubic' },
      { t: 1.45, px: 0, py: 0, pz: 0, rz: -3 * TAU, open: 0, e: 'outElastic' },
    ],
  }),

  /* 7 — butterfly flip: handles fan open, blade tumbles end over end. */
  flip: compile({
    label: 'Butterfly Flip',
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rx: 0, open: 0 },
      { t: 0.16, px: 0.03, py: -0.06, rx: 0.5, open: 0.45, e: 'outCubic' },
      { t: 0.50, px: -0.02, py: 0.03, pz: -0.04, rx: TAU * 0.9, open: 1, blur: 1, e: 'linear' },
      { t: 0.86, px: 0.02, py: 0.01, rx: TAU * 1.8, open: 1, blur: 1, e: 'linear' },
      { t: 1.16, px: -0.01, py: -0.01, rx: TAU * 2.6, open: 0.6, blur: 0.7, e: 'outCubic' },
      { t: 1.40, px: 0.01, py: -0.04, pz: 0.03, rx: TAU * 3 + 0.25, open: 0.1, e: 'outCubic' },
      { t: 1.66, px: 0, py: 0, pz: 0, rx: TAU * 3, open: 0, e: 'outElastic' },
    ],
  }),

  /* 0 — finger roll: slow pen-roll across the knuckles, swaying with it. */
  fingerRoll: compile({
    label: 'Finger Roll',
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, ry: 0, rz: 0 },
      { t: 0.28, px: -0.05, py: -0.03, pz: -0.03, ry: TAU * 0.35, rz: 0.3, rx: -0.15, e: 'inOutCubic' },
      { t: 0.62, px: -0.02, py: 0.03, pz: -0.05, ry: TAU * 0.75, rz: -0.22, rx: 0.12, open: 0.4, e: 'inOutCubic' },
      { t: 0.98, px: 0.04, py: -0.02, pz: -0.02, ry: TAU * 1.25, rz: 0.28, rx: -0.1, open: 0.4, e: 'inOutCubic' },
      { t: 1.32, px: -0.02, py: 0.01, pz: 0.01, ry: TAU * 1.85, rz: -0.12, rx: 0.05, open: 0.15, e: 'inOutCubic' },
      { t: 1.62, px: 0, py: 0, pz: 0, ry: TAU * 2, rz: 0, rx: 0, open: 0, e: 'outBack' },
    ],
  }),

  /* T — palm spin: the knife rolls on its own long axis across the fingers. */
  palmSpin: compile({
    label: 'Palm Spin',
    keepOff: true,
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, ry: 0 },
      { t: 0.14, px: -0.01, py: 0.03, pz: -0.03, ry: 0.7, rz: -0.25, off: 0.5, e: 'outCubic' },
      { t: 0.5, ry: TAU * 1.5, blur: 0.7, off: 1, e: 'linear' },
      { t: 0.86, ry: TAU * 3, blur: 0.7, e: 'linear' },
      { t: 1.12, px: 0.005, py: 0.01, pz: -0.01, ry: TAU * 4 + 0.25, rz: -0.1, blur: 0, off: 0.6, e: 'outCubic' },
      { t: 1.42, px: 0, py: 0, pz: 0, ry: TAU * 4, rz: 0, off: 0, e: 'outElastic' },
    ],
  }),

  /* Y — flick into a reverse grip, show it off, flick back. */
  reverseFlick: compile({
    label: 'Reverse Flick',
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rx: 0, rz: 0 },
      { t: 0.14, px: 0.02, py: -0.03, pz: 0.02, rx: 0.45, e: 'outCubic' },
      { t: 0.34, px: -0.01, py: 0.02, pz: -0.02, rx: Math.PI + 0.25, blur: 1, e: 'outCubic' },
      { t: 0.62, px: -0.02, py: 0.03, pz: -0.03, rx: Math.PI, rz: 0.35, blur: 0, e: 'outBack' },
      { t: 0.98, px: -0.025, py: 0.035, pz: -0.03, rx: Math.PI + 0.08, rz: 0.4, e: 'inOut' },
      { t: 1.22, px: 0.01, py: -0.02, pz: 0.01, rx: TAU + 0.25, rz: 0, blur: 1, e: 'inOutCubic' },
      { t: 1.5, px: 0, py: 0, pz: 0, rx: TAU, e: 'outElastic' },
    ],
  }),

  /* U — two little tosses with a half turn each, caught every time. */
  juggle: compile({
    label: 'Juggle',
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rz: 0 },
      { t: 0.14, px: 0.01, py: -0.05, pz: 0.03, rz: 0.2, e: 'outCubic' },
      { t: 0.36, px: -0.02, py: 0.15, pz: -0.05, rz: -Math.PI * 0.6, open: 0.5, blur: 1, e: 'outCubic' },
      { t: 0.56, px: 0, py: -0.04, pz: 0.02, rz: -Math.PI, open: 0.1, blur: 0.2, e: 'inCubic' },
      { t: 0.78, px: -0.03, py: 0.18, pz: -0.06, rz: -Math.PI * 1.6, open: 0.6, blur: 1, e: 'outCubic' },
      { t: 1.0, px: 0.01, py: -0.05, pz: 0.03, rz: -TAU, open: 0, blur: 0.2, e: 'inCubic' },
      { t: 1.28, px: 0, py: 0, pz: 0, rz: -TAU, e: 'outElastic' },
    ],
  }),

  /* H — figure eight: the blade draws a slow lying-down 8 in front of you,
     leaning into each curve, the wrist doing all of it. Every key blends into
     the next (no stops), so it reads as one continuous flow. */
  flow: compile({
    label: 'Figure Eight',
    keepOff: true,
    keys: [
      { t: 0, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, off: 0 },
      { t: 0.35, px: -0.035, py: 0.025, pz: -0.02, rz: 0.45, ry: -0.35, rx: -0.12, off: 0.4, e: 'inOutCubic' },
      { t: 0.75, px: -0.01, py: -0.02, pz: -0.03, rz: 0.1, ry: -0.9, rx: 0.1, off: 0.7, blur: 0.3, e: 'inOut' },
      { t: 1.15, px: 0.03, py: 0.02, pz: -0.02, rz: -0.5, ry: -1.5, rx: -0.08, off: 0.7, blur: 0.4, e: 'inOut' },
      { t: 1.55, px: 0.01, py: -0.025, pz: -0.01, rz: -0.15, ry: -2.2, rx: 0.12, off: 0.6, blur: 0.3, e: 'inOut' },
      { t: 1.95, px: -0.03, py: 0.02, pz: -0.02, rz: 0.4, ry: -2.9, rx: -0.1, off: 0.5, blur: 0.3, e: 'inOut' },
      { t: 2.4, px: -0.005, py: 0.005, pz: 0, rz: 0.05, ry: -TAU + 0.15, rx: 0, off: 0.2, blur: 0, e: 'inOutCubic' },
      { t: 2.75, px: 0, py: 0, pz: 0, rz: 0, ry: -TAU, rx: 0, off: 0, e: 'outCubic' },
    ],
  }),
}

/* Held knife only, two keys as in CS: V looks the knife over, R plays the
   next flourish in turn (the knife has nothing to reload). */
export const FLOURISHES = ['twirl', 'flip', 'fingerRoll', 'palmSpin', 'reverseFlick', 'juggle', 'flow']
export const BINDINGS = [
  { key: 'KeyV', move: 'inspect', label: 'V', name: 'Inspect' },
  { key: 'KeyR', move: 'next', label: 'R', name: 'Múa (đổi kiểu mỗi lần bấm)' },
]

/* Sound cues: fired once when playback crosses `t`. */
export const CUES = {
  deploy: [{ t: 0.05, s: 'swoosh', v: 0.6 }, { t: 0.44, s: 'clack', v: 1 }],
  bflyInspect: [{ t: 0.2, s: 'clack', v: 0.7 }, { t: 0.5, s: 'clack', v: 0.9 }, { t: 2.0, s: 'swoosh', v: 0.8 }, { t: 2.28, s: 'clack', v: 1.1 }],
  inspect: [{ t: 0.12, s: 'swoosh', v: 0.45 }, { t: 0.78, s: 'clack', v: 0.35 }, { t: 1.32, s: 'clack', v: 0.45 }, { t: 2.3, s: 'clack', v: 0.7 }],
  // no thud here: the impact sound only fires when the trace actually lands
  stab: [{ t: 0.1, s: 'swoosh', v: 1 }],
  slash: [{ t: 0.14, s: 'swoosh', v: 1.3 }],
  twirl: [{ t: 0.14, s: 'swoosh', v: 1 }, { t: 0.42, s: 'swoosh', v: 0.9 }, { t: 0.7, s: 'swoosh', v: 0.9 }, { t: 1.0, s: 'swoosh', v: 0.8 }, { t: 1.24, s: 'clack', v: 1 }],
  flip: [{ t: 0.16, s: 'clack', v: 0.7 }, { t: 0.5, s: 'swoosh', v: 1 }, { t: 0.86, s: 'clack', v: 0.6 }, { t: 1.16, s: 'swoosh', v: 0.8 }, { t: 1.42, s: 'clack', v: 1.1 }],
  fingerRoll: [{ t: 0.28, s: 'swoosh', v: 0.5 }, { t: 0.98, s: 'swoosh', v: 0.5 }, { t: 1.6, s: 'clack', v: 0.6 }],
  flow: [{ t: 0.4, s: 'swoosh', v: 0.35 }, { t: 1.2, s: 'swoosh', v: 0.4 }, { t: 1.95, s: 'swoosh', v: 0.35 }, { t: 2.5, s: 'clack', v: 0.4 }],
  palmSpin: [{ t: 0.16, s: 'swoosh', v: 0.4 }, { t: 0.5, s: 'swoosh', v: 0.45 }, { t: 0.86, s: 'swoosh', v: 0.45 }, { t: 1.14, s: 'clack', v: 0.6 }],
  reverseFlick: [{ t: 0.2, s: 'swoosh', v: 0.8 }, { t: 0.36, s: 'clack', v: 0.9 }, { t: 1.1, s: 'swoosh', v: 0.8 }, { t: 1.26, s: 'clack', v: 1 }],
  juggle: [{ t: 0.24, s: 'swoosh', v: 0.6 }, { t: 0.56, s: 'clack', v: 0.7 }, { t: 0.66, s: 'swoosh', v: 0.7 }, { t: 1.0, s: 'clack', v: 0.9 }],
}
