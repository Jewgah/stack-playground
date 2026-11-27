import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import {
  CuboidCollider,
  Physics,
  RigidBody,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import { SKILLS, colorOf, type Skill } from './stack'
import { makeLabelTexture } from './labels'

export type GravityMode = 'earth' | 'moon' | 'zero'

const GRAVITY: Record<GravityMode, [number, number, number]> = {
  earth: [0, -9.81, 0],
  moon: [0, -1.62, 0],
  zero: [0, 0, 0],
}

export type PlaygroundApi = {
  buildTower: () => void
  explode: () => void
  reset: () => void
}

// Brick size (x = length, y = height, z = depth). Three bricks side by
// side are as wide as one brick is long, so the tower interlocks like Jenga.
const BRICK: [number, number, number] = [2, 0.6, 0.66]
const ARENA = { x: 8, z: 4.5, top: 14 }
const TOWER_YAW = -0.5

const tmpVec = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()
const tmpEuler = new THREE.Euler()

function scatterPose(i: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const cols = 6
  const x = ((i % cols) - (cols - 1) / 2) * 2.3 + (Math.random() - 0.5) * 0.6
  const z = (Math.random() - 0.5) * 4
  const y = 1.2 + Math.floor(i / cols) * 1.3 + Math.random() * 0.8
  return {
    position: [x, y, z],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
  }
}

type BlockProps = {
  skill: Skill
  index: number
  geometry: THREE.BoxGeometry
  register: (i: number, body: RapierRigidBody | null) => void
  onGrab: (i: number, point: THREE.Vector3, pointerId: number) => void
}

function Block({ skill, index, geometry, register, onGrab }: BlockProps) {
  const gl = useThree((s) => s.gl)
  const initial = useMemo(() => scatterPose(index), [index])
  const materials = useMemo(() => {
    const tex = makeLabelTexture(skill, gl.capabilities.getMaxAnisotropy())
    const color = new THREE.Color(colorOf(skill))
    const face = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: '#ffffff',
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.05,
    })
    const cap = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    })
    const bottom = new THREE.MeshStandardMaterial({ color: '#0c0824', roughness: 0.8 })
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    return [cap, cap, face, bottom, face, face]
  }, [skill, gl])

  useEffect(
    () => () => {
      const seen = new Set<THREE.Material>()
      for (const m of materials) {
        if (seen.has(m)) continue
        seen.add(m)
        ;(m as THREE.MeshStandardMaterial).map?.dispose()
        m.dispose()
      }
    },
    [materials],
  )

  return (
    <RigidBody
      ref={(b) => register(index, b)}
      position={initial.position}
      rotation={initial.rotation}
      colliders="cuboid"
      friction={0.85}
      restitution={0.12}
      linearDamping={0.08}
      angularDamping={0.15}
      ccd
      canSleep
    >
      <mesh
        geometry={geometry}
        material={materials}
        castShadow
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation()
          onGrab(index, e.point.clone(), e.pointerId)
        }}
        onPointerOver={() => {
          if (document.body.style.cursor !== 'grabbing') document.body.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          if (document.body.style.cursor !== 'grabbing') document.body.style.cursor = ''
        }}
      />
    </RigidBody>
  )
}

type Drag = {
  index: number
  pointerId: number
  plane: THREE.Plane
  offset: THREE.Vector3
  ndc: THREE.Vector2
}

function World({
  apiRef,
  gravityMode,
  onAwake,
}: {
  apiRef: React.RefObject<PlaygroundApi | null>
  gravityMode: GravityMode
  onAwake: (n: number) => void
}) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const bodies = useRef<(RapierRigidBody | null)[]>([])
  const drag = useRef<Drag | null>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const geometry = useMemo(() => new THREE.BoxGeometry(...BRICK), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const register = (i: number, b: RapierRigidBody | null) => {
    bodies.current[i] = b
  }

  const forEachBody = (fn: (b: RapierRigidBody, i: number) => void) => {
    bodies.current.forEach((b, i) => {
      if (b) fn(b, i)
    })
  }

  const toNdc = (clientX: number, clientY: number, out: THREE.Vector2) => {
    const rect = gl.domElement.getBoundingClientRect()
    out.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  }

  const onGrab = (i: number, point: THREE.Vector3, pointerId: number) => {
    const body = bodies.current[i]
    if (!body) return
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point)
    const pos = body.translation()
    const offset = point.clone().sub(tmpVec.set(pos.x, pos.y, pos.z))
    const projected = point.clone().project(camera)
    const ndc = new THREE.Vector2(projected.x, projected.y)
    drag.current = { index: i, pointerId, plane, offset, ndc }
    body.wakeUp()
    document.body.style.cursor = 'grabbing'
    invalidate()
  }

  // Pointer tracking lives on window so a fast flick that leaves the block
  // (or the canvas) keeps steering it until release.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      toNdc(e.clientX, e.clientY, d.ndc)
      bodies.current[d.index]?.wakeUp()
    }
    const up = (e: PointerEvent) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      drag.current = null
      document.body.style.cursor = ''
    }
    // Releasing the mouse outside the window may never fire pointerup.
    const blur = () => {
      drag.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('blur', blur)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])

  // Spring the grabbed body toward the pointer by driving its velocity.
  // On release the last velocity is kept, which is what makes a throw.
  useBeforePhysicsStep(() => {
    const d = drag.current
    if (!d) return
    const body = bodies.current[d.index]
    if (!body) return
    raycaster.setFromCamera(d.ndc, camera)
    const hit = raycaster.ray.intersectPlane(d.plane, tmpVec)
    if (!hit) return
    const target = hit.sub(d.offset)
    target.x = THREE.MathUtils.clamp(target.x, -ARENA.x + 1.2, ARENA.x - 1.2)
    target.y = THREE.MathUtils.clamp(target.y, BRICK[1] / 2, ARENA.top - 1)
    target.z = THREE.MathUtils.clamp(target.z, -ARENA.z + 0.8, ARENA.z - 0.8)
    const p = body.translation()
    const v = new THREE.Vector3(target.x - p.x, target.y - p.y, target.z - p.z).multiplyScalar(14)
    const maxSpeed = 28
    if (v.length() > maxSpeed) v.setLength(maxSpeed)
    body.setLinvel(v, true)
    const w = body.angvel()
    body.setAngvel({ x: w.x * 0.85, y: w.y * 0.85, z: w.z * 0.85 }, true)
  })

  useEffect(() => {
    apiRef.current = {
      buildTower: () => {
        drag.current = null
        forEachBody((b, i) => {
          const layer = Math.floor(i / 3)
          const slot = (i % 3) - 1
          const odd = layer % 2 === 1
          const y = BRICK[1] / 2 + layer * (BRICK[1] + 0.004) + 0.002
          const spread = BRICK[2] + 0.01
          // Local layout, then yawed so both layer orientations face the camera a bit.
          const lx = odd ? slot * spread : 0
          const lz = odd ? 0 : slot * spread
          const c = Math.cos(TOWER_YAW)
          const s = Math.sin(TOWER_YAW)
          b.setTranslation({ x: lx * c + lz * s, y, z: -lx * s + lz * c }, true)
          tmpQuat.setFromEuler(tmpEuler.set(0, (odd ? Math.PI / 2 : 0) + TOWER_YAW, 0))
          b.setRotation(tmpQuat, true)
          b.setLinvel({ x: 0, y: 0, z: 0 }, true)
          b.setAngvel({ x: 0, y: 0, z: 0 }, true)
        })
        invalidate()
      },
      explode: () => {
        drag.current = null
        // Blast from just below the pile's centroid. Per-block jitter keeps a
        // neat tower from lifting off as one column.
        const centroid = new THREE.Vector3()
        let n = 0
        forEachBody((b) => {
          const p = b.translation()
          centroid.add(tmpVec.set(p.x, p.y, p.z))
          n++
        })
        if (n === 0) return
        centroid.divideScalar(n)
        const origin = new THREE.Vector3(centroid.x, Math.max(0.1, centroid.y - 1.5), centroid.z)
        forEachBody((b) => {
          const p = b.translation()
          const dir = new THREE.Vector3(p.x, p.y, p.z).sub(origin)
          const dist = dir.length()
          dir.x += (Math.random() - 0.5) * 1.6
          dir.z += (Math.random() - 0.5) * 1.6
          dir.y = Math.abs(dir.y) * 0.5 + 0.7
          dir.normalize()
          const strength = (b.mass() * (8 + Math.random() * 6)) / (1 + dist * 0.1)
          b.applyImpulse({ x: dir.x * strength, y: dir.y * strength, z: dir.z * strength }, true)
          const t = b.mass() * 0.6
          b.applyTorqueImpulse(
            { x: (Math.random() - 0.5) * t, y: (Math.random() - 0.5) * t, z: (Math.random() - 0.5) * t },
            true,
          )
        })
        invalidate()
      },
      reset: () => {
        drag.current = null
        forEachBody((b, i) => {
          const pose = scatterPose(i)
          const [x, y, z] = pose.position
          b.setTranslation({ x, y, z }, true)
          tmpQuat.setFromEuler(tmpEuler.set(...pose.rotation))
          b.setRotation(tmpQuat, true)
          b.setLinvel({ x: 0, y: 0, z: 0 }, true)
          b.setAngvel({ x: 0, y: 0, z: 0 }, true)
        })
        invalidate()
      },
    }
    return () => {
      apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRef, invalidate])

  // Sleeping bodies ignore a gravity change until something touches them,
  // so wake everything when the mode flips.
  useEffect(() => {
    forEachBody((b) => b.wakeUp())
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gravityMode])

  useEffect(() => {
    const id = window.setInterval(() => {
      let awake = 0
      forEachBody((b) => {
        if (!b.isSleeping()) awake++
      })
      onAwake(awake)
    }, 400)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAwake])

  return (
    <>
      {SKILLS.map((s, i) => (
        <Block key={s.name} skill={s} index={i} geometry={geometry} register={register} onGrab={onGrab} />
      ))}

      {/* Floor, walls and ceiling: invisible except the floor, they keep zero-g blocks in view. */}
      <RigidBody type="fixed" colliders={false} friction={0.9}>
        <CuboidCollider args={[ARENA.x + 2, 0.5, ARENA.z + 2]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[0.5, ARENA.top, ARENA.z + 2]} position={[-ARENA.x - 0.5, ARENA.top, 0]} />
        <CuboidCollider args={[0.5, ARENA.top, ARENA.z + 2]} position={[ARENA.x + 0.5, ARENA.top, 0]} />
        <CuboidCollider args={[ARENA.x + 2, ARENA.top, 0.5]} position={[0, ARENA.top, -ARENA.z - 0.5]} />
        <CuboidCollider args={[ARENA.x + 2, ARENA.top, 0.5]} position={[0, ARENA.top, ARENA.z + 0.5]} />
        <CuboidCollider args={[ARENA.x + 2, 0.5, ARENA.z + 2]} position={[0, ARENA.top + 0.5, 0]} />
      </RigidBody>
    </>
  )
}

function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const aspect = size.width / size.height
    // Portrait screens need to back off so the whole arena width fits.
    const base = 12
    const distance = aspect >= 1.3 ? base : base * Math.min(2.2, 1.3 / aspect)
    camera.position.set(0, 4.2 + (distance - base) * 0.3, distance)
    camera.lookAt(0, 2.2, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size, invalidate])
  return null
}

export function Scene({
  apiRef,
  gravityMode,
  onAwake,
}: {
  apiRef: React.RefObject<PlaygroundApi | null>
  gravityMode: GravityMode
  onAwake: (n: number) => void
}) {
  return (
    <>
      <color attach="background" args={['#050310']} />
      <fog attach="fog" args={['#050310', 18, 42]} />
      <CameraRig />
      <hemisphereLight args={['#9adcff', '#1a0b3a', 0.55]} />
      <directionalLight
        position={[6, 14, 8]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      <pointLight position={[-7, 5, 4]} intensity={30} color="#4cc9f0" distance={22} />
      <pointLight position={[7, 3, -3]} intensity={22} color="#7c3aed" distance={20} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0a0720" roughness={0.95} />
      </mesh>
      <Grid
        position={[0, 0.002, 0]}
        args={[60, 60]}
        cellSize={0.66}
        cellThickness={0.6}
        cellColor="#1d2a55"
        sectionSize={3.3}
        sectionThickness={1}
        sectionColor="#4cc9f0"
        fadeDistance={34}
        fadeStrength={1.4}
        infiniteGrid
      />

      <Physics gravity={GRAVITY[gravityMode]} updateLoop="independent">
        <World apiRef={apiRef} gravityMode={gravityMode} onAwake={onAwake} />
      </Physics>
    </>
  )
}
