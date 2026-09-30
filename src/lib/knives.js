import { KNIFE_SKINS, KNIFE_TYPES } from "../skins/catalog";
/* Per-model tuning.

   A CS:GO knife has one stance, not two: the idle *is* the fighting hold. The
   blade is presented out into the scene, running up and across to the left with
   its flat toward the camera, the gripping hand low on the right, and the empty
   off hand open at the bottom of the frame. Stabs, slashes and the flourishes
   are all offsets from there.

   `pose` is given relative to the CS:GO viewmodel origin, which already carries
   viewmodel_offset_x/y/z. Its rotation is applied in view space, XYZ order:
     r[0]  pitch: negative swings the tip away from the camera
     r[1]  yaw:   turns the blade's flat toward the screen
     r[2]  roll:  positive leans the tip left, negative leans it right.
             Near 1.16 the blade lies across the frame at the angle the
             game holds it; near -0.17 it stands upright instead.
   `roll` (per knife, not part of `pose`) turns the blade about its *own* long
   axis: it sets both how much of the flat faces you and which way the cutting
   edge looks, without moving where the blade points, and costs the arm nothing,
   since the direction the haft runs — and so the cone the forearm can sweep — is
   exactly what a roll leaves alone. The half turn on top of the 0.9 puts the
   edge up and outboard rather than down at the floor; drop it to see the other
   face of the blade with the edge underneath. It is baked into the model rather
   than applied to the pose on purpose: the trick channels rotate in the knife's
   own frame, so a roll sitting *above* them tilts the plane rz swings in and the
   inspect stops standing the blade upright.

   `hand` nudges the gripping hand along the haft — the grip *is* the origin, so
   this is a small offset plus whatever twist the model's knuckle line needs.

   `offhand` places the open left hand, in *view* space rather than on the knife:
   it hangs off the player's own chest and does not ride the blade around.

   `pick` selects one sub-tree when a GLB ships several weapons in one scene —
   knives_m9_bayonet.glb contains two finished knives side by side. */

/** The stance: blade out and across, flat to the camera, grip low right. */
/* Matched to the CS2 M9 idle: blade from the bottom-right corner, tip pointing
   away into the scene toward the crosshair, serrated spine underneath. */
export const POSE = { p: [0.1, -0.068, -0.29], r: [-0.7, -0.45, 0.88] };
/** Where the gripping hand sits on the haft. `r` is a live offset on top of the
    solve, so it moves the whole arm — the static supination lives in WRIST
    instead, which turns the hand inside its own sleeve and leaves the arm be. */
export const HAND = { p: [0, -0.004, 0], r: [0, 0, 0] };
/** How far the fist is rolled on the handle, in radians about the haft itself.
    Zero, and it should stay there: this is a real bend of a real wrist, applied
    to the bone, and the hand only has to be turned a little before it reads as
    broken. The fist's roll on the handle is already set — for free, and without
    bending anything — by which point of the cone SHOULDER.right picks, since
    that same roll is what aims the forearm. Kept as a knob only for a knife
    whose handle genuinely wants a different hold. */
export const WRIST_TWIST = 0;

/** How far a finger *bone* must come to the haft's centre line to count as
    holding it, in metres. Not the handle's radius: the bone runs up the middle
    of the finger, so a finger resting on the surface still has its bone a half
    thickness clear of it. Measured off this model that is 13 mm of handle plus
    about 8 of finger. Set it to the handle alone — the obvious reading, and the
    one that was here first — and contact is defined as the bone being *inside*
    the handle, which no finger can reach: every one of them drives to its limit,
    stops short anyway, and the knife sits in a fist that never closes on it. */
export const HAFT_RADIUS = 0.021;
/** Where the open off hand rides, in view space, and how it is turned. */
export const OFFHAND = { p: [-0.172, -0.132, -0.294], r: [0, 0, 0] };

/* Spread, not share: the dev console tunes one knife's pose at a time
   (KNIVES.m9a.pose.r[2] = ...), which a shared array would leak to the rest. */
const copy = (base, over = {}) => ({ p: [...base.p], r: [...base.r], ...over });

export const KNIVES = {
  m9a: {
    id: "m9a",
    file: "/models/m9_bayonet.glb",
    pick: ["group001"],
    // the blade mesh, for repainting it with a finish from a case
    blade: ["box001"],
    // guard and pommel cap: they wear the finish with the blade
    accent: ["cylinder01", "box002"],
    name: "M9 Bayonet",
    skin: "★ | Doppler",
    rarity: "Covert",
    length: 0.315,
    gripAt: 0.2,
    roll: 6.96 + Math.PI,
    pose: copy(POSE),
    hand: copy(HAND),
    offhand: copy(OFFHAND),
    wings: null,
  },
  m9b: {
    id: "m9b",
    file: "/models/m9_bayonet.glb",
    pick: ["group002"],
    blade: ["box003"],
    accent: ["cylinder003", "box004"],
    name: "M9 Bayonet",
    skin: "★ | Autotronic",
    rarity: "Covert",
    length: 0.315,
    gripAt: 0.2,
    roll: 1.86 + Math.PI,
    pose: copy(POSE),
    hand: copy(HAND),
    offhand: copy(OFFHAND),
    wings: null,
  },
  bfly: {
    id: "bfly",
    file: "/models/butterfly.glb",
    name: "Butterfly Knife",
    skin: "★ | Crimson Web",
    rarity: "Covert",
    length: 0.295,
    gripAt: 0.22,
    roll: 1.86 + Math.PI,
    // a closed balisong reads longer than a bayonet, so it sits further out
    pose: copy(POSE, { p: [0.112, -0.064, -0.305] }),
    hand: copy(HAND),
    offhand: copy(OFFHAND),
    blade: ["blade_"],
    // with a finish, the Crimson Web inlays and blade bolts take its colour
    accent: ["butterfly_knife2_grip_br_red_grip", "screw_blade"],
    // the blade bolts come tinted pink in the file; show them as plain steel
    silver: ["screw_blade"],
    // handles pivot on the two blade bolts, exactly like a real balisong.
    // The file merges both handles into each mesh, so the rig splits the
    // meshes into pieces and sorts them by side (see rigButterflySplit).
    wings: {
      split: true,
      frame: "base_handle_mat",
      keep: ["blade_blade", "screw_blade"],
      bolts: [
        { bolt: ["screw_blade_t"], sign: 1 },
        { bolt: ["screw_blade_b"], sign: -1 },
      ],
    },
  },
};

/* Case knives that come as real models: the finish is painted on the named
   blade meshes. Huntsman and Bowie are one mesh each, cut at the guard. */
const glbKnife = (id, file, name, blade, extra = {}) => ({
  id, file, name, blade, skin: "★", rarity: "Covert",
  length: 0.3, gripAt: 0.22, roll: Math.PI,
  pose: copy(POSE), hand: copy(HAND), offhand: copy(OFFHAND), wings: null,
  ...extra,
});
Object.assign(KNIVES, {
  karambit: glbKnife("karambit", "/models/karambit.glb", "Karambit", ["plane001_lamina"], {
    accent: ["plane001_material003"],   // the red pivot screw
    // held reverse like CS: ring out over the thumb, the blade under the fist
    // curling up. The handle end is the "tip" of the stance, grip on the handle.
    length: 0.24, gripAt: 0.63, roll: 0,
    reverse: true,
    pose: { p: [0, -0.035, -0.29], r: [-0.4, -0.3, 2.0] },
    // the curved handle sits off the stance axis: slide the fist onto it
    hand: { p: [-0.045, -0.004, 0], r: [0, 0, 0] },
  }),
  huntsman: glbKnife("huntsman", "/models/huntsman.glb", "Huntsman Knife", ["blade_split"], { bladeSplit: 0.045, roll: 0 }),
  bowie: glbKnife("bowie", "/models/bowie.glb", "Bowie Knife", ["blade_split"], { bladeSplit: 0.045, roll: 0 }),
  skeleton: glbKnife("skeleton", "/models/skeleton.glb", "Skeleton Knife", ["pcube15_knife_main"]),
});
export const GLB_KNIVES = ["karambit", "huntsman", "bowie", "skeleton"];

/* The case knives built in code (skins/knives.js): one entry per knife + finish,
   held in the same stance as the model knives. */
for (const it of KNIFE_SKINS) {
  if (it.model) continue;
  KNIVES[it.id] = {
    id: it.id,
    build: it.knife,
    finish: it,
    name: KNIFE_TYPES[it.knife].name,
    skin: `★ | ${it.name}`,
    rarity: "Covert",
    pose: copy(POSE),
    hand: copy(HAND),
    offhand: copy(OFFHAND),
    wings: null,
  };
}

/* The stock knife: what everyone holds until a case gives them better. */
KNIVES.default = {
  id: "default",
  build: "default",
  finish: null,
  name: "Knife",
  skin: "Mặc định",
  rarity: "Stock",
  pose: copy(POSE),
  hand: copy(HAND),
  offhand: copy(OFFHAND),
  wings: null,
};

export const KNIFE_ORDER = ["default", "m9a", "m9b", "bfly", ...GLB_KNIVES, ...KNIFE_SKINS.filter((k) => !k.model).map((k) => k.id)];
/** Every other knife comes out of a case. */
export const DEFAULT_KNIFE = "default";
