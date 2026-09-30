import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SAMPLES = 22

/** Ribbon swept between two points on the blade — the classic knife-trick streak. */
export function Trail({ tipRef, baseRef, strengthRef, color = '#bfe4ff' }) {
  const meshRef = useRef()
  const buf = useRef({ tip: [], base: [], filled: 0 })

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3))
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(SAMPLES * 2), 1))
    const idx = []
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1
      idx.push(a, b, c, b, d, c)
    }
    g.setIndex(idx)
    for (let i = 0; i < SAMPLES; i++) { buf.current.tip.push(new THREE.Vector3()); buf.current.base.push(new THREE.Vector3()) }
    return g
  }, [])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: 0 } },
    vertexShader: `attribute float alpha; varying float vA;
      void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vA;
      void main(){ float a = vA * uStrength; if (a < 0.004) discard; gl_FragColor = vec4(uColor * (0.5 + a), a); }`,
  }), [color])

  useFrame(() => {
    const tip = tipRef.current, base = baseRef.current, mesh = meshRef.current
    if (!tip || !base || !mesh) return
    const s = strengthRef.current
    mat.uniforms.uStrength.value = s

    const b = buf.current
    // shift ring buffer
    const oldTip = b.tip.pop(), oldBase = b.base.pop()
    tip.getWorldPosition(oldTip); base.getWorldPosition(oldBase)
    b.tip.unshift(oldTip); b.base.unshift(oldBase)
    if (b.filled < SAMPLES) { b.filled++; if (b.filled < 3) return }

    const pos = geo.attributes.position.array
    const al = geo.attributes.alpha.array
    for (let i = 0; i < SAMPLES; i++) {
      const j = Math.min(i, b.filled - 1)
      const t = b.tip[j], ba = b.base[j]
      pos[i * 6] = t.x; pos[i * 6 + 1] = t.y; pos[i * 6 + 2] = t.z
      pos[i * 6 + 3] = ba.x; pos[i * 6 + 4] = ba.y; pos[i * 6 + 5] = ba.z
      const fade = Math.pow(1 - i / (SAMPLES - 1), 1.7)
      al[i * 2] = fade
      al[i * 2 + 1] = fade * 0.35
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.alpha.needsUpdate = true
    mesh.visible = s > 0.01
  })

  return <mesh ref={meshRef} geometry={geo} material={mat} frustumCulled={false} renderOrder={2} />
}
