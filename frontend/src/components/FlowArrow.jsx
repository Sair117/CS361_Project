import { motion, AnimatePresence } from 'framer-motion';
import '../styles/simulation.css';

// =============================================================================
// FlowArrow — Animated directional arrow between cache levels
// =============================================================================
// Phase 3: Enhanced with animated traveling dots along the arrow path,
// gradient coloring, and bidirectional flow indicators.
// =============================================================================

const hex = (n) => `0x${n.toString(16).toUpperCase()}`;

// ─── Flow label variants ────────────────────────────────────────────────────
const labelVariants = {
  initial: { opacity: 0, scale: 0.85, filter: 'blur(2px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 350, damping: 25 },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    filter: 'blur(2px)',
    transition: { duration: 0.15 },
  },
};

// ─── Traveling dot along the arrow path ─────────────────────────────────────
const dotUp = {
  y: [20, -20],
  opacity: [0, 1, 1, 0],
  transition: { duration: 0.6, ease: 'easeInOut' },
};

const dotDown = {
  y: [-20, 20],
  opacity: [0, 1, 1, 0],
  transition: { duration: 0.6, ease: 'easeInOut' },
};

export default function FlowArrow({ snapshot, from, to }) {
  const swap = snapshot?.swapDetails;
  const result = snapshot?.result;
  const stepIndex = snapshot?.stepIndex ?? -1;

  if (!swap && !result) {
    return (
      <div className="flow-arrow flow-arrow--idle">
        <div className="flow-arrow__line" />
      </div>
    );
  }

  // Determine what flows are happening
  let upFlow = null;
  let downFlow = null;

  if (from === 'L1' && to === 'VC') {
    if (result === 'VC_HIT' && swap) {
      upFlow = { tag: swap.incoming?.tag, label: 'rescued', color: 'var(--color-vc-hit)' };
      downFlow = { tag: swap.outgoing?.tag, label: 'displaced', color: 'var(--text-muted)' };
    } else if (result === 'L2_FETCH' && swap?.outgoing?.to === 'VC') {
      downFlow = { tag: swap.outgoing.tag, label: 'evicted to VC', color: 'var(--text-secondary)' };
    }
  } else if (from === 'VC' && to === 'L2') {
    if (result === 'L2_FETCH') {
      upFlow = { tag: swap?.incoming?.tag, label: 'fetched', color: 'var(--color-l2-fetch)' };
      if (swap?.evictedToL2) {
        downFlow = {
          tag: swap.evictedToL2.tag,
          label: swap.evictedToL2.dirty ? 'write-back' : 'evicted',
          color: swap.evictedToL2.dirty ? 'var(--color-writeback)' : 'var(--text-muted)',
        };
      }
    }
  }

  const hasActivity = upFlow || downFlow;

  return (
    <div className={`flow-arrow ${hasActivity ? 'flow-arrow--active' : 'flow-arrow--idle'}`}>
      {/* Center line with gradient */}
      <div className={`flow-arrow__line ${hasActivity ? 'flow-arrow__line--active' : ''}`} />

      {/* Traveling dots */}
      {upFlow && (
        <motion.div
          className="flow-arrow__dot flow-arrow__dot--up"
          animate={dotUp}
          key={`dot-up-${stepIndex}`}
          style={{ background: upFlow.color }}
        />
      )}
      {downFlow && (
        <motion.div
          className="flow-arrow__dot flow-arrow__dot--down"
          animate={dotDown}
          key={`dot-down-${stepIndex}`}
          style={{ background: downFlow.color }}
        />
      )}

      {/* Flow labels */}
      <div className="flow-arrow__labels">
        <AnimatePresence mode="wait">
          {upFlow && (
            <motion.div
              className="flow-arrow__label flow-arrow__label--up"
              variants={labelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              key={`up-${stepIndex}`}
              style={{ color: upFlow.color }}
            >
              <span className="flow-arrow__icon">↑</span>
              <span className="mono flow-arrow__tag">{hex(upFlow.tag)}</span>
              <span className="flow-arrow__desc">{upFlow.label}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {downFlow && (
            <motion.div
              className="flow-arrow__label flow-arrow__label--down"
              variants={labelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              key={`down-${stepIndex}`}
              style={{ color: downFlow.color }}
            >
              <span className="flow-arrow__icon">↓</span>
              <span className="mono flow-arrow__tag">{hex(downFlow.tag)}</span>
              <span className="flow-arrow__desc">{downFlow.label}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
