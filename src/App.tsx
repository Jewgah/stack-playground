import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene, type GravityMode, type PlaygroundApi } from './Scene'
import { CATEGORIES, SKILLS } from './stack'

const MODES: { id: GravityMode; label: string }[] = [
  { id: 'earth', label: 'Earth' },
  { id: 'moon', label: 'Moon' },
  { id: 'zero', label: 'Zero-g' },
]

function useFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        setReady(true)
      }
    }
    // The block labels are drawn into canvases, so the webfont must be
    // loaded first. Never block the scene for more than 2.5 s on it.
    Promise.all([
      document.fonts.load('500 54px "Space Grotesk"'),
      document.fonts.load('700 46px "Space Grotesk"'),
    ])
      .catch(() => undefined)
      .finally(finish)
    const t = window.setTimeout(finish, 2500)
    return () => window.clearTimeout(t)
  }, [])
  return ready
}

export default function App() {
  const apiRef = useRef<PlaygroundApi | null>(null)
  const [gravity, setGravity] = useState<GravityMode>('earth')
  const [awake, setAwake] = useState(SKILLS.length)
  const fontsReady = useFontsReady()
  const onAwake = useCallback((n: number) => setAwake(n), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'b') apiRef.current?.buildTower()
      else if (k === 'e') apiRef.current?.explode()
      else if (k === 'r') apiRef.current?.reset()
      else if (k === 'g') setGravity((g) => MODES[(MODES.findIndex((m) => m.id === g) + 1) % MODES.length].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <div className="stage">
        {fontsReady && (
          <Canvas
            shadows="percentage"
            frameloop="demand"
            dpr={[1, 1.75]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            camera={{ fov: 42, near: 0.1, far: 80, position: [0, 4.2, 12] }}
          >
            <Suspense fallback={null}>
              <Scene apiRef={apiRef} gravityMode={gravity} onAwake={onAwake} />
            </Suspense>
          </Canvas>
        )}
      </div>

      <header className="hud top">
        <div>
          <p className="eyebrow">jordanperez.dev / lab</p>
          <h1>Stack Playground</h1>
          <p className="sub">My stack as physics blocks. Grab one, throw it, build a tower, blow it up.</p>
        </div>
        <ul className="legend" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <span className="dot" style={{ background: c.color }} />
              {c.label}
            </li>
          ))}
        </ul>
      </header>

      <div className="hud bottom">
        <div className="controls" role="toolbar" aria-label="Playground controls">
          <button id="btn-tower" type="button" className="primary" onClick={() => apiRef.current?.buildTower()}>
            Build tower
          </button>
          <button id="btn-explode" type="button" onClick={() => apiRef.current?.explode()}>
            Explode
          </button>
          <button id="btn-reset" type="button" onClick={() => apiRef.current?.reset()}>
            Reset
          </button>
          <div className="seg" role="radiogroup" aria-label="Gravity">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={gravity === m.id}
                className={gravity === m.id ? 'on' : ''}
                onClick={() => setGravity(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="status">
          <span className={awake === 0 ? 'idle' : 'live'} />
          {SKILLS.length} blocks, {awake === 0 ? 'all asleep' : `${awake} awake`}
          <span className="keys">B tower, E explode, R reset, G gravity</span>
        </div>
        <footer>
          Built by{' '}
          <a href="https://jordanperez.dev" target="_blank" rel="noreferrer">
            Jordan Perez
          </a>{' '}
          with{' '}
          <a href="https://github.com/pmndrs/react-three-rapier" target="_blank" rel="noreferrer">
            react-three-rapier
          </a>{' '}
          (pmndrs, MIT)
        </footer>
      </div>
    </div>
  )
}
