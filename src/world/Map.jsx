import { useEffect, useState } from 'react'
import { Sky } from '@react-three/drei'
import { level, onLevelChange } from './level'

/* de_dust2. The map's textures carry baked lighting, so it is drawn unlit and
   untonemapped — exactly as lit in Hammer. The lights below only exist for the
   players and the viewmodel-free props that walk around on it. */

export function Map() {
  const [version, setVersion] = useState(level.ready ? level.version : 0)
  useEffect(() => onLevelChange(l => setVersion(l.version)), [])
  const ready = version > 0 && level.ready

  return (
    <group>
      <Sky distance={450000} sunPosition={[40, 30, -60]} turbidity={5} rayleigh={1.1} mieCoefficient={0.005} mieDirectionalG={0.86} />
      <hemisphereLight args={['#dfe9ff', '#b3926a', 1.1]} />
      <directionalLight position={[40, 60, -30]} intensity={2.2} color="#ffe6c4" />
      <ambientLight intensity={0.25} color="#ffe0bd" />
      {ready && level.meshes.map((m, i) => (
        <mesh key={`${version}-${i}`} geometry={m.geometry} material={m.material} receiveShadow={!!m.lit} />
      ))}
    </group>
  )
}
