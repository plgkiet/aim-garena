/* Queue of blade impacts. The trace runs wherever the swing is timed; the
   renderer drains this every frame, so nothing in the FX path re-renders React. */
export const impactQueue = []

/** @param {{point:THREE.Vector3, normal:THREE.Vector3, mat:string, heavy?:boolean}} hit */
export function spawnImpact(hit) {
  impactQueue.push(hit)
  if (impactQueue.length > 8) impactQueue.shift()
}

/* Hitmarker pulse for the HUD — same idea, one listener. */
const marks = new Set()
export function onHitmark(fn) { marks.add(fn); return () => marks.delete(fn) }
export function hitmark(heavy = false) { for (const fn of marks) fn(heavy) }
