import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/log.css';

// =============================================================================
// AccessLog — Scrolling Event Log
// =============================================================================

const hex = (n) => `0x${n.toString(16).toUpperCase()}`;

const resultConfig = {
  L1_HIT: { label: 'L1 HIT', className: 'log-entry--l1-hit', icon: '●' },
  VC_HIT: { label: 'VC HIT', className: 'log-entry--vc-hit', icon: '◆' },
  L2_FETCH: { label: 'L2 FETCH', className: 'log-entry--l2-fetch', icon: '▼' },
};

const entryVariants = {
  initial: { opacity: 0, x: -20, height: 0 },
  animate: {
    opacity: 1,
    x: 0,
    height: 'auto',
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
};

export default function AccessLog({ history, snapshots }) {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [snapshots?.length]);

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="access-log">
        <div className="access-log__header">
          <span className="section-card__title">Access Log</span>
        </div>
        <div className="placeholder" style={{ padding: 'var(--space-lg)' }}>
          <span className="placeholder__icon">📜</span>
          <span>Events will appear here as you step through the trace</span>
        </div>
      </div>
    );
  }

  // Show only the last 50 entries for performance
  const visibleEntries = snapshots.slice(-50);

  return (
    <div className="access-log">
      <div className="access-log__header">
        <span className="section-card__title">Access Log</span>
        <span className="access-log__count mono">{snapshots.length} events</span>
      </div>

      <div className="access-log__scroll" ref={scrollRef}>
        <div className="access-log__table-header">
          <span className="access-log__col access-log__col--step">#</span>
          <span className="access-log__col access-log__col--op">Op</span>
          <span className="access-log__col access-log__col--addr">Address</span>
          <span className="access-log__col access-log__col--tag">Tag</span>
          <span className="access-log__col access-log__col--idx">Idx</span>
          <span className="access-log__col access-log__col--result">Result</span>
          <span className="access-log__col access-log__col--cycles">Cost</span>
          <span className="access-log__col access-log__col--amat">AMAT</span>
        </div>

        <AnimatePresence initial={false}>
          {visibleEntries.map((snap) => {
            const cfg = resultConfig[snap.result] || resultConfig.L2_FETCH;
            const amat = snap.metrics.totalAccesses > 0
              ? (snap.metrics.totalClockCycles / snap.metrics.totalAccesses).toFixed(2)
              : '—';

            return (
              <motion.div
                key={snap.stepIndex}
                className={`log-entry ${cfg.className}`}
                variants={entryVariants}
                initial="initial"
                animate="animate"
              >
                <span className="access-log__col access-log__col--step mono">
                  {String(snap.stepIndex + 1).padStart(3, '0')}
                </span>
                <span className="access-log__col access-log__col--op">
                  {snap.access.op === 'R' ? (
                    <span className="log-op log-op--read">R</span>
                  ) : (
                    <span className="log-op log-op--write">W</span>
                  )}
                </span>
                <span className="access-log__col access-log__col--addr mono">
                  {hex(snap.access.addr)}
                </span>
                <span className="access-log__col access-log__col--tag mono">
                  {hex(snap.access.tag)}
                </span>
                <span className="access-log__col access-log__col--idx mono">
                  {snap.access.index}
                </span>
                <span className="access-log__col access-log__col--result">
                  <span className={`log-result log-result--${snap.result?.toLowerCase().replace('_', '-')}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </span>
                <span className="access-log__col access-log__col--cycles mono">
                  +{snap.cyclesCost}
                </span>
                <span className="access-log__col access-log__col--amat mono">
                  {amat}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
