import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { CacheSimulator, CACHE_CONFIG } from './engine/cacheEngine';
import { WORKLOADS, WORKLOAD_LIST, DEFAULT_WORKLOAD } from './engine/traceData';
import L1Grid from './components/L1Grid';
import VCGrid from './components/VCGrid';
import L2Pool from './components/L2Pool';
import FlowArrow from './components/FlowArrow';
import AccessLog from './components/AccessLog';
import MetricsCharts from './components/MetricsCharts';
const HeroScene = lazy(() => import('./components/HeroScene'));
const CompareMode = lazy(() => import('./components/CompareMode'));
const ArchitectureGuide = lazy(() => import('./components/ArchitectureGuide'));
import './App.css';

// =============================================================================
// App — Root Component
// =============================================================================
// Manages the simulation state and provides it to all child components.
// Phase 1 renders a skeleton layout with working engine controls.
// =============================================================================

function App() {
  // ─── Simulation State ─────────────────────────────────────────────────
  const [workloadId, setWorkloadId] = useState(DEFAULT_WORKLOAD);
  const [useVC, setUseVC] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3); // steps per second (1–20)
  const [history, setHistory] = useState([]); // array of metrics snapshots for charts
  const [snapshots, setSnapshots] = useState([]); // full snapshots for access log
  const [showHero, setShowHero] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const simulatorRef = useRef(null);
  const playIntervalRef = useRef(null);

  // ─── Initialize Simulator ─────────────────────────────────────────────
  const initSimulator = useCallback(
    (wId = workloadId, vc = useVC) => {
      const sim = new CacheSimulator({ useVC: vc });
      sim.loadTrace(WORKLOADS[wId].trace);
      simulatorRef.current = sim;
      setSnapshot(null);
      setHistory([]);
      setSnapshots([]);
      setIsPlaying(false);
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    },
    [workloadId, useVC]
  );

  // Init on mount
  useEffect(() => {
    initSimulator();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Step ─────────────────────────────────────────────────────────────
  const handleStep = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim || sim.isComplete()) return;

    const snap = sim.step();
    if (snap) {
      setSnapshot(snap);
      setHistory((prev) => [...prev, { ...snap.metrics, step: snap.stepIndex }]);
      setSnapshots((prev) => [...prev, snap]);
    }

    if (sim.isComplete()) {
      setIsPlaying(false);
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
  }, []);

  // ─── Play / Pause ─────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    } else {
      const sim = simulatorRef.current;
      if (!sim || sim.isComplete()) return;

      setIsPlaying(true);
      playIntervalRef.current = setInterval(() => {
        const s = simulatorRef.current;
        if (!s || s.isComplete()) {
          setIsPlaying(false);
          clearInterval(playIntervalRef.current);
          playIntervalRef.current = null;
          return;
        }
        const snap = s.step();
        if (snap) {
          setSnapshot(snap);
          setHistory((prev) => [...prev, { ...snap.metrics, step: snap.stepIndex }]);
          setSnapshots((prev) => [...prev, snap]);
        }
      }, 1000 / speed);
    }
  }, [isPlaying, speed]);

  // Update interval speed when speed slider changes during playback
  useEffect(() => {
    if (isPlaying && playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = setInterval(() => {
        const s = simulatorRef.current;
        if (!s || s.isComplete()) {
          setIsPlaying(false);
          clearInterval(playIntervalRef.current);
          playIntervalRef.current = null;
          return;
        }
        const snap = s.step();
        if (snap) {
          setSnapshot(snap);
          setHistory((prev) => [...prev, { ...snap.metrics, step: snap.stepIndex }]);
          setSnapshots((prev) => [...prev, snap]);
        }
      }, 1000 / speed);
    }
  }, [speed, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, []);

  // ─── Reset ────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    initSimulator();
  }, [initSimulator]);

  // ─── Workload Change ──────────────────────────────────────────────────
  const handleWorkloadChange = useCallback(
    (newId) => {
      setWorkloadId(newId);
      initSimulator(newId, useVC);
    },
    [useVC, initSimulator]
  );

  // ─── VC Toggle ────────────────────────────────────────────────────────
  const handleVCToggle = useCallback(() => {
    const newVC = !useVC;
    setUseVC(newVC);
    initSimulator(workloadId, newVC);
  }, [useVC, workloadId, initSimulator]);

  // ─── Derived Data ─────────────────────────────────────────────────────
  const workload = WORKLOADS[workloadId];
  const metrics = snapshot?.metrics || null;
  const progress = snapshot?.progress || { current: 0, total: workload.trace.length, percent: 0 };
  const isComplete = simulatorRef.current?.isComplete() ?? false;

  // ─── Format hex helper ────────────────────────────────────────────────
  const hex = (n) => (n !== undefined && n !== null ? `0x${n.toString(16).toUpperCase()}` : '—');

  return (
    <div className="app">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header__title-group">
          <div className="app-header__icon">🏗</div>
          <div>
            <div className="app-header__title">Cache Architecture Simulator</div>
            <div className="app-header__subtitle">
              L1 Direct-Mapped ({CACHE_CONFIG.L1_SIZE} blocks) · Victim Cache (
              {CACHE_CONFIG.VICTIM_CACHE_SIZE} entries) · L2 Perfect
            </div>
          </div>
        </div>
        <div className="app-header__meta">
          <button className="app-header__action" onClick={() => setShowHero(true)}>
            🧊 3D View
          </button>
          <button className="app-header__action" onClick={() => setShowCompare(true)}>
            ⚖️ Compare
          </button>
          <button className="app-header__action" onClick={() => setShowGuide(true)}>
            📖 Guide
          </button>
          <div className="app-header__chip">
            <span className="app-header__chip-dot" />
            Block Size: {CACHE_CONFIG.BLOCK_SIZE}B
          </div>
          <div className="app-header__chip">
            L1 Hit: {CACHE_CONFIG.CYCLES_L1_HIT}cyc · VC Probe: {CACHE_CONFIG.CYCLES_VC_PROBE}cyc ·
            L2: {CACHE_CONFIG.CYCLES_L2_FETCH}cyc
          </div>
        </div>
      </header>

      {/* ── Main Grid ────────────────────────────────────────────────── */}
      <main className="app-main">
        {/* ── Control Bar (top, full width) ───────────────────────── */}
        <div className="app-main__controls">
          <div className="section-card" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
              {/* Playback buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="ctrl-btn" onClick={handlePlayPause} disabled={isComplete}>
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button className="ctrl-btn" onClick={handleStep} disabled={isPlaying || isComplete}>
                  ⏭ Step
                </button>
                <button className="ctrl-btn ctrl-btn--secondary" onClick={handleReset}>
                  ⏮ Reset
                </button>
              </div>

              {/* Speed slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Speed:</span>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="speed-slider"
                />
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '35px' }}>
                  {speed}×
                </span>
              </div>

              {/* Workload dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Workload:</span>
                <select
                  className="workload-select"
                  value={workloadId}
                  onChange={(e) => handleWorkloadChange(e.target.value)}
                >
                  {WORKLOAD_LIST.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.icon} {w.shortName}
                    </option>
                  ))}
                </select>
              </div>

              {/* VC Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Victim Cache:</span>
                <button
                  className={`vc-toggle ${useVC ? 'vc-toggle--on' : 'vc-toggle--off'}`}
                  onClick={handleVCToggle}
                >
                  {useVC ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Progress */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {progress.current}/{progress.total}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Left Sidebar ───────────────────────────────────────────── */}
        <div className="app-main__sidebar-left">
          {/* Workload Info */}
          <div className="section-card">
            <div className="section-card__header">
              <span className="section-card__title">Workload</span>
              <span style={{ fontSize: '1.2rem' }}>{workload.icon}</span>
            </div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
              {workload.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-md)' }}>
              {workload.description}
            </p>
            <div
              style={{
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--surface-elevated)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem',
                color: workload.color,
                fontWeight: 500,
              }}
            >
              {workload.expectedResult}
            </div>
          </div>

          {/* Current Access Info */}
          <div className="section-card">
            <div className="section-card__header">
              <span className="section-card__title">Current Access</span>
            </div>
            {snapshot ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Operation</span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {snapshot.access.op === 'R' ? '📖 Read' : '✏️ Write'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Address</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{hex(snapshot.access.addr)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tag</span>
                  <span className="mono">{hex(snapshot.access.tag)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>L1 Index</span>
                  <span className="mono">{snapshot.access.index}</span>
                </div>
                <div style={{ marginTop: 'var(--space-sm)' }}>
                  <span
                    className={`badge ${
                      snapshot.result === 'L1_HIT'
                        ? 'badge--l1-hit'
                        : snapshot.result === 'VC_HIT'
                        ? 'badge--vc-hit'
                        : 'badge--l2-fetch'
                    }`}
                  >
                    {snapshot.result === 'L1_HIT'
                      ? '✦ L1 HIT'
                      : snapshot.result === 'VC_HIT'
                      ? '✦ VC HIT'
                      : '✦ L2 FETCH'}
                  </span>
                  <span className="mono" style={{ marginLeft: 'var(--space-sm)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    +{snapshot.cyclesCost} cyc
                  </span>
                </div>
              </div>
            ) : (
              <div className="placeholder">
                <div className="placeholder__icon">💤</div>
                <span>Press Play or Step to begin</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Cache Visualization ────────────────────────────── */}
        <div className="app-main__center">
          <div className="section-card" style={{ flex: 1 }}>
            <div className="section-card__header">
              <span className="section-card__title">Cache State</span>
              {useVC && (
                <span className="badge badge--vc-hit">VC Enabled</span>
              )}
            </div>

            <L1Grid snapshot={snapshot} />
            <FlowArrow snapshot={snapshot} from="L1" to="VC" />
            <VCGrid snapshot={snapshot} useVC={useVC} />
            <FlowArrow snapshot={snapshot} from="VC" to="L2" />
            <L2Pool snapshot={snapshot} />
          </div>
        </div>

        {/* ── Right Sidebar: Metrics ─────────────────────────────────── */}
        <div className="app-main__sidebar-right">
          <div className="section-card">
            <div className="section-card__header">
              <span className="section-card__title">Metrics</span>
            </div>
            {metrics ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <MetricRow label="Total Accesses" value={metrics.totalAccesses} />
                <MetricRow label="Read / Write" value={`${metrics.readOps} / ${metrics.writeOps}`} />
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: 'var(--space-xs) 0' }} />
                <MetricRow label="L1 Hits" value={metrics.l1Hits} color="var(--color-l1-hit)" />
                <MetricRow
                  label="L1 Hit Rate"
                  value={`${((metrics.l1Hits / (metrics.totalAccesses || 1)) * 100).toFixed(1)}%`}
                  color="var(--color-l1-hit)"
                />
                <MetricRow label="VC Hits" value={metrics.vcHits} color="var(--color-vc-hit)" />
                <MetricRow
                  label="VC Hit Rate"
                  value={`${((metrics.vcHits / (metrics.totalAccesses || 1)) * 100).toFixed(1)}%`}
                  color="var(--color-vc-hit)"
                />
                <MetricRow label="L2 Fetches" value={metrics.l2Fetches} color="var(--color-l2-fetch)" />
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: 'var(--space-xs) 0' }} />
                <MetricRow label="Total Cycles" value={metrics.totalClockCycles} />
                <MetricRow
                  label="AMAT"
                  value={`${(metrics.totalClockCycles / (metrics.totalAccesses || 1)).toFixed(2)} cyc`}
                  color="var(--accent-primary)"
                  bold
                />
                <MetricRow label="Write-backs" value={metrics.totalWritebacks} color="var(--color-writeback)" />
              </div>
            ) : (
              <div className="placeholder">
                <div className="placeholder__icon">📊</div>
                <span>Metrics appear after first step</span>
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="section-card" style={{ flex: 1 }}>
            <div className="section-card__header">
              <span className="section-card__title">Charts</span>
            </div>
            <MetricsCharts history={history} />
          </div>
        </div>

        {/* ── Access Log (bottom, full width) ────────────────────────── */}
        <div className="app-main__log">
          <div className="section-card">
            <AccessLog history={history} snapshots={snapshots} />
          </div>
        </div>
      </main>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        {showHero && <HeroScene onClose={() => setShowHero(false)} />}
        {showCompare && <CompareMode onClose={() => setShowCompare(false)} />}
        {showGuide && <ArchitectureGuide onClose={() => setShowGuide(false)} />}
      </Suspense>
    </div>
  );
}

// ─── Small Helper Component ────────────────────────────────────────────────
function MetricRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span
        className="mono"
        style={{
          fontWeight: bold ? 700 : 600,
          color: color || 'var(--text-primary)',
          fontSize: bold ? '0.9rem' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default App;
