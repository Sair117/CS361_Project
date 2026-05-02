import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CacheSimulator } from '../engine/cacheEngine';
import { WORKLOADS, WORKLOAD_LIST } from '../engine/traceData';
import '../styles/compare.css';

// =============================================================================
// CompareMode — Side-by-side VC ON vs OFF comparison
// =============================================================================
// Runs the same workload simultaneously with and without Victim Cache
// to visually demonstrate the performance difference.
// =============================================================================

function runFullTrace(workloadId, useVC) {
  const sim = new CacheSimulator({ useVC });
  sim.loadTrace(WORKLOADS[workloadId].trace);

  const snapshots = [];
  while (!sim.isComplete()) {
    const snap = sim.step();
    if (snap) snapshots.push(snap);
  }

  return snapshots;
}

export default function CompareMode({ onClose }) {
  const [workloadId, setWorkloadId] = useState('conflict_loop');
  const [results, setResults] = useState(null);

  const runComparison = useCallback(() => {
    const withVC = runFullTrace(workloadId, true);
    const withoutVC = runFullTrace(workloadId, false);
    setResults({ withVC, withoutVC });
  }, [workloadId]);

  // Run on mount and workload change
  useEffect(() => {
    runComparison();
  }, [runComparison]);

  const metricsVC = results?.withVC?.[results.withVC.length - 1]?.metrics;
  const metricsNoVC = results?.withoutVC?.[results.withoutVC.length - 1]?.metrics;
  const workload = WORKLOADS[workloadId];

  const computeAMAT = (m) => m ? (m.totalClockCycles / (m.totalAccesses || 1)).toFixed(2) : '—';
  const computeRate = (hits, total) => total ? ((hits / total) * 100).toFixed(1) + '%' : '—';
  const computeSavings = () => {
    if (!metricsVC || !metricsNoVC) return null;
    const diff = metricsNoVC.totalClockCycles - metricsVC.totalClockCycles;
    const pct = ((diff / metricsNoVC.totalClockCycles) * 100).toFixed(1);
    return { diff, pct };
  };

  const savings = computeSavings();

  return (
    <div className="compare-overlay">
      <div className="compare-modal">
        {/* Header */}
        <div className="compare-header">
          <div>
            <h2 className="compare-header__title">Comparison Mode</h2>
            <p className="compare-header__subtitle">
              Side-by-side: With Victim Cache vs Without
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <select
              className="workload-select"
              value={workloadId}
              onChange={(e) => setWorkloadId(e.target.value)}
            >
              {WORKLOAD_LIST.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.shortName}
                </option>
              ))}
            </select>
            <button className="hero-scene__close" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        {!results ? (
          <div className="placeholder" style={{ flex: 1 }}>
            <span className="placeholder__icon">⏳</span>
            <span>Running comparison...</span>
          </div>
        ) : (
          <>
            {/* Savings Banner */}
            {savings && (
              <motion.div
                className={`compare-savings ${Number(savings.diff) > 0 ? 'compare-savings--positive' : Number(savings.diff) < 0 ? 'compare-savings--negative' : 'compare-savings--neutral'}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {Number(savings.diff) > 0 ? (
                  <>
                    <span className="compare-savings__icon">🚀</span>
                    <span>
                      Victim Cache saved <strong>{savings.diff} cycles</strong> ({savings.pct}% reduction)
                    </span>
                  </>
                ) : Number(savings.diff) < 0 ? (
                  <>
                    <span className="compare-savings__icon">⚠️</span>
                    <span>
                      Victim Cache added <strong>{Math.abs(savings.diff)} cycles</strong> overhead ({Math.abs(Number(savings.pct))}% increase)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="compare-savings__icon">➡️</span>
                    <span>No difference — Victim Cache had no impact</span>
                  </>
                )}
              </motion.div>
            )}

            {/* Side by Side */}
            <div className="compare-grid">
              {/* With VC */}
              <div className="compare-side compare-side--vc">
                <div className="compare-side__header">
                  <span className="compare-side__badge compare-side__badge--on">VC ON</span>
                  <span className="compare-side__title">With Victim Cache</span>
                </div>
                {metricsVC && <CompareMetrics metrics={metricsVC} highlight="vc" />}
              </div>

              {/* VS divider */}
              <div className="compare-divider">
                <span className="compare-divider__text">VS</span>
              </div>

              {/* Without VC */}
              <div className="compare-side compare-side--novc">
                <div className="compare-side__header">
                  <span className="compare-side__badge compare-side__badge--off">VC OFF</span>
                  <span className="compare-side__title">Without Victim Cache</span>
                </div>
                {metricsNoVC && <CompareMetrics metrics={metricsNoVC} highlight="novc" />}
              </div>
            </div>

            {/* Workload Description */}
            <div className="compare-footer">
              <span style={{ fontSize: '1rem' }}>{workload.icon}</span>
              <span className="compare-footer__name">{workload.name}</span>
              <span className="compare-footer__desc">{workload.description}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CompareMetrics({ metrics, highlight }) {
  const total = metrics.totalAccesses || 1;
  const amat = (metrics.totalClockCycles / total).toFixed(2);
  const l1Rate = ((metrics.l1Hits / total) * 100).toFixed(1);
  const vcRate = ((metrics.vcHits / total) * 100).toFixed(1);

  return (
    <div className="compare-metrics">
      <div className="compare-metric compare-metric--big">
        <span className="compare-metric__label">AMAT</span>
        <span className="compare-metric__value mono" style={{ color: 'var(--accent-secondary)' }}>
          {amat} <small>cyc</small>
        </span>
      </div>

      <div className="compare-metric">
        <span className="compare-metric__label">Total Cycles</span>
        <span className="compare-metric__value mono">{metrics.totalClockCycles}</span>
      </div>

      <div className="compare-metric__divider" />

      <div className="compare-metric">
        <span className="compare-metric__label">L1 Hits</span>
        <span className="compare-metric__value mono" style={{ color: 'var(--color-l1-hit)' }}>
          {metrics.l1Hits} <small>({l1Rate}%)</small>
        </span>
      </div>

      <div className="compare-metric">
        <span className="compare-metric__label">VC Hits</span>
        <span className="compare-metric__value mono" style={{ color: 'var(--color-vc-hit)' }}>
          {metrics.vcHits} <small>({vcRate}%)</small>
        </span>
      </div>

      <div className="compare-metric">
        <span className="compare-metric__label">L2 Fetches</span>
        <span className="compare-metric__value mono" style={{ color: 'var(--color-l2-fetch)' }}>
          {metrics.l2Fetches}
        </span>
      </div>

      <div className="compare-metric">
        <span className="compare-metric__label">Write-backs</span>
        <span className="compare-metric__value mono" style={{ color: 'var(--color-writeback)' }}>
          {metrics.totalWritebacks}
        </span>
      </div>

      {/* Visual bar */}
      <div className="compare-bar">
        <div
          className="compare-bar__segment compare-bar__segment--l1"
          style={{ width: `${(metrics.l1Hits / total) * 100}%` }}
          title={`L1: ${l1Rate}%`}
        />
        <div
          className="compare-bar__segment compare-bar__segment--vc"
          style={{ width: `${(metrics.vcHits / total) * 100}%` }}
          title={`VC: ${vcRate}%`}
        />
        <div
          className="compare-bar__segment compare-bar__segment--l2"
          style={{ width: `${(metrics.l2Fetches / total) * 100}%` }}
          title={`L2: ${((metrics.l2Fetches / total) * 100).toFixed(1)}%`}
        />
      </div>
    </div>
  );
}
