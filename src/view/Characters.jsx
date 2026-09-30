import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { game } from '../game/state'
import { buildCharacter, prepareTemplate, pose } from './characterPose'

const MODEL = { T: '/models/t_phoenix.glb', CT: '/models/ct_sas.glb' }

/* Third-person players: Phoenix for T, the CS2 SAS agent for CT.
   Everything is animated here: two-bone IK puts the feet on the floor and the
   hands on the gun, the spine bends with the aim pitch and the lean, a stride
   cycle drives the feet from the ground speed, and a death is a fall over
   backwards. The rendered head and torso also become the hitboxes, so the shot
   you see land is the shot that counts. */

export function Characters() {
  // meshopt-compressed agent models, one per side
  const t = useGLTF(MODEL.T, false, true)
  const ct = useGLTF(MODEL.CT, false, true)
  const models = useMemo(() => ({
    T: { gltf: t, tpl: prepareTemplate(t) },
    CT: { gltf: ct, tpl: prepareTemplate(ct) },
  }), [t, ct])
  const group = useRef()
  const pool = useRef(new Map())   // agent id -> character

  useEffect(() => () => pool.current.clear(), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const g = group.current
    if (!g) return
    const seen = new Set()
    for (const a of game.agents) {
      seen.add(a.id)
      let ch = pool.current.get(a.id)
      // (re)build on first sight and when the side changes at halftime
      if (!ch || ch.team !== a.team) {
        if (ch) g.remove(ch.root)
        ch = buildCharacter(models[a.team].gltf, models[a.team].tpl, a.team)
        pool.current.set(a.id, ch)
        g.add(ch.root)
      }
      // the local player is the camera while alive
      const hidden = a === game.local && a.alive
      ch.root.visible = !hidden && game.phase !== 'menu'
      if (!ch.root.visible) continue
      pose(ch, a, dt)
    }
    for (const [id, ch] of pool.current) {
      if (!seen.has(id)) { g.remove(ch.root); pool.current.delete(id) }
    }
  }, -1)

  return <group ref={group} />
}

useGLTF.preload(MODEL.T, false, true)
useGLTF.preload(MODEL.CT, false, true)
