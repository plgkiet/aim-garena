/* Shared mutable state written by the Player each frame and read by the viewmodel/HUD. */
export const player = {
  yaw: 0, pitch: 0,
  dYaw: 0, dPitch: 0,      // smoothed look delta -> viewmodel sway
  speed: 0,                // horizontal speed, m/s
  strafe: 0,               // -1 left .. +1 right, drives the viewmodel shift
  bob: 0,                  // accumulated bob phase
  grounded: true,
  crouching: false,
  sprinting: false,
  landImpulse: 0,          // spikes when you touch down
  locked: false,
  sensitivity: 0.0022,
}
