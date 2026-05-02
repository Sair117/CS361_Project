import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { Float, Text, RoundedBox, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import '../styles/hero.css';

// =============================================================================
// HeroScene — 3D Architecture Overview using React Three Fiber
// =============================================================================
// A spatial "hero shot" showing the cache hierarchy as stacked floating layers.
// CPU → L1 → Victim Cache → L2/Memory, with animated data particles.
// =============================================================================

function CacheLayer({ position, size, color, label, sublabel, opacity = 0.15 }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3 + position[1]) * 0.02;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3} floatingRange={[-0.05, 0.05]}>
      <group position={position} ref={meshRef}>
        {/* Solid layer */}
        <RoundedBox args={size} radius={0.08} smoothness={4}>
          <meshStandardMaterial
            color={color}
            transparent
            opacity={opacity}
            roughness={0.3}
            metalness={0.1}
          />
        </RoundedBox>

        {/* Wireframe overlay */}
        <RoundedBox args={size} radius={0.08} smoothness={4}>
          <meshStandardMaterial
            color={color}
            wireframe
            transparent
            opacity={0.08}
          />
        </RoundedBox>

        {/* Label */}
        <Text
          position={[0, 0.02, size[2] / 2 + 0.05]}
          fontSize={0.14}
          color={color}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>

        {sublabel && (
          <Text
            position={[0, -0.12, size[2] / 2 + 0.05]}
            fontSize={0.065}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            {sublabel}
          </Text>
        )}
      </group>
    </Float>
  );
}

function DataParticle({ startPos, endPos, color, speed = 1, delay = 0 }) {
  const ref = useRef();
  const progress = useRef(delay);
  const startVec = useMemo(() => new THREE.Vector3(...startPos), [startPos]);
  const endVec = useMemo(() => new THREE.Vector3(...endPos), [endPos]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    progress.current += delta * speed * 0.5;
    const t = (progress.current % 2) / 2;

    ref.current.position.lerpVectors(startVec, endVec, t);
    ref.current.material.opacity = Math.sin(t * Math.PI) * 0.8;
    ref.current.scale.setScalar(0.5 + Math.sin(t * Math.PI) * 0.5);
  });

  return (
    <mesh ref={ref} position={startPos}>
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0}
        emissive={color}
        emissiveIntensity={2}
      />
    </mesh>
  );
}

function ConnectionBeam({ start, end, color }) {
  const ref = useRef();

  const midY = (start[1] + end[1]) / 2;
  const length = Math.abs(start[1] - end[1]);

  return (
    <mesh position={[start[0], midY, start[2]]} ref={ref}>
      <cylinderGeometry args={[0.003, 0.003, length, 6]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.2}
        emissive={color}
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 3]} intensity={0.8} color="#a78bfa" />
      <pointLight position={[-3, -2, 2]} intensity={0.4} color="#6c63ff" />

      {/* OrbitControls for interactivity */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 4}
      />

      {/* CPU */}
      <CacheLayer
        position={[0, 1.2, 0]}
        size={[0.8, 0.15, 0.6]}
        color="#e2e8f0"
        label="CPU"
        sublabel="Processor Core"
        opacity={0.2}
      />

      {/* L1 Cache */}
      <CacheLayer
        position={[0, 0.6, 0]}
        size={[1.6, 0.15, 0.8]}
        color="#4ade80"
        label="L1 CACHE"
        sublabel="Direct-Mapped · 8 blocks · 1 cyc"
        opacity={0.12}
      />

      {/* Victim Cache */}
      <CacheLayer
        position={[0, 0, 0]}
        size={[1.2, 0.15, 0.7]}
        color="#facc15"
        label="VICTIM CACHE"
        sublabel="Fully Associative · 4 entries · 1 cyc probe"
        opacity={0.12}
      />

      {/* L2 / Memory */}
      <CacheLayer
        position={[0, -0.7, 0]}
        size={[2.2, 0.2, 1.0]}
        color="#f87171"
        label="L2 / MEMORY"
        sublabel="Perfect · 15 cycle penalty"
        opacity={0.08}
      />

      {/* Connection beams (using cylinders instead of <line> which conflicts with HTML) */}
      <ConnectionBeam start={[0, 1.05, 0]} end={[0, 0.75, 0]} color="#94a3b8" />
      <ConnectionBeam start={[0, 0.45, 0]} end={[0, 0.15, 0]} color="#94a3b8" />
      <ConnectionBeam start={[0, -0.15, 0]} end={[0, -0.55, 0]} color="#94a3b8" />

      {/* Animated data particles */}
      <DataParticle startPos={[0, 1.05, 0]} endPos={[0, 0.75, 0]} color="#4ade80" speed={0.8} delay={0} />
      <DataParticle startPos={[0, 0.45, 0]} endPos={[0, 0.15, 0]} color="#facc15" speed={0.6} delay={0.7} />
      <DataParticle startPos={[0, -0.15, 0]} endPos={[0, -0.55, 0]} color="#f87171" speed={0.5} delay={1.4} />
      <DataParticle startPos={[0.3, 0.75, 0]} endPos={[0.3, 1.05, 0]} color="#4ade80" speed={0.9} delay={0.3} />
      <DataParticle startPos={[-0.2, 0.15, 0]} endPos={[-0.2, 0.45, 0]} color="#facc15" speed={0.7} delay={1.0} />
    </>
  );
}

export default function HeroScene({ onClose }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="hero-overlay" onClick={onClose}>
        <div className="hero-scene" onClick={(e) => e.stopPropagation()}>
          <div className="hero-scene__header">
            <h2 className="hero-scene__title">Cache Architecture Overview</h2>
            <button className="hero-scene__close" onClick={onClose}>✕ Close</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <span>3D rendering requires WebGL support.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-overlay" onClick={onClose}>
      <div className="hero-scene" onClick={(e) => e.stopPropagation()}>
        <div className="hero-scene__header">
          <h2 className="hero-scene__title">Cache Architecture Overview</h2>
          <p className="hero-scene__subtitle">
            Power-Aware Memory Hierarchy with Victim Cache
          </p>
          <button className="hero-scene__close" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="hero-scene__canvas">
          <Canvas
            camera={{ position: [0, 0.3, 3], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            onError={() => setHasError(true)}
            fallback={
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
                Loading 3D scene...
              </div>
            }
          >
            <Scene />
          </Canvas>
        </div>

        <div className="hero-scene__legend">
          <div className="hero-legend__item">
            <span className="hero-legend__dot" style={{ background: '#4ade80' }} />
            <span>L1 Hit — 1 cycle</span>
          </div>
          <div className="hero-legend__item">
            <span className="hero-legend__dot" style={{ background: '#facc15' }} />
            <span>VC Hit — 1+1 cycle probe</span>
          </div>
          <div className="hero-legend__item">
            <span className="hero-legend__dot" style={{ background: '#f87171' }} />
            <span>L2 Fetch — 1+1+15 cycles</span>
          </div>
        </div>
      </div>
    </div>
  );
}
