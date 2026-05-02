import { motion, AnimatePresence } from 'framer-motion';
import '../styles/simulation.css';

// =============================================================================
// L1Grid — Direct-Mapped L1 Cache Visualization (8 slots)
// =============================================================================
// Phase 3: Enhanced with scale-bounce on arrival, background color pulses,
// smooth tag transitions, and directional slide animations.
// =============================================================================

const hex = (n) => (n !== undefined && n !== null ? `0x${n.toString(16).toUpperCase()}` : '');

// ─── Block arrival: slides down from VC/L2 with spring bounce ────────────────
const blockVariants = {
  initial: (result) => ({
    scale: 0.6,
    opacity: 0,
    y: result === 'VC_HIT' ? -30 : result === 'L2_FETCH' ? -50 : 0,
    filter: 'blur(4px)',
  }),
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
      mass: 0.8,
    },
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    y: 20,
    filter: 'blur(2px)',
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

// ─── Hit flash: tag glows with color pulse ───────────────────────────────────
const hitPulse = {
  L1_HIT: {
    scale: [1, 1.15, 1],
    color: ['#e2e8f0', '#4ade80', '#e2e8f0'],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
  VC_HIT: {
    scale: [1, 1.15, 1],
    color: ['#e2e8f0', '#facc15', '#e2e8f0'],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
  L2_FETCH: {
    scale: [1, 1.1, 1],
    color: ['#e2e8f0', '#f87171', '#e2e8f0'],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
};

// ─── Background pulse for the slot itself ────────────────────────────────────
const slotBgPulse = {
  L1_HIT: {
    backgroundColor: [
      'rgba(74, 222, 128, 0)',
      'rgba(74, 222, 128, 0.15)',
      'rgba(74, 222, 128, 0.04)',
    ],
    transition: { duration: 0.6 },
  },
  VC_HIT: {
    backgroundColor: [
      'rgba(250, 204, 21, 0)',
      'rgba(250, 204, 21, 0.15)',
      'rgba(250, 204, 21, 0.04)',
    ],
    transition: { duration: 0.6 },
  },
  L2_FETCH: {
    backgroundColor: [
      'rgba(248, 113, 113, 0)',
      'rgba(248, 113, 113, 0.15)',
      'rgba(248, 113, 113, 0.04)',
    ],
    transition: { duration: 0.6 },
  },
};

// ─── Dirty badge entrance ────────────────────────────────────────────────────
const dirtyVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 500, damping: 15, delay: 0.15 },
  },
  exit: { scale: 0, opacity: 0, transition: { duration: 0.1 } },
};

export default function L1Grid({ snapshot }) {
  const l1 = snapshot?.l1 || new Array(8).fill(null);
  const highlights = snapshot?.highlights || {};
  const result = snapshot?.result || null;
  const stepIndex = snapshot?.stepIndex ?? -1;

  return (
    <div className="cache-section">
      <div className="cache-section__header">
        <div className="cache-section__label">
          <span className="cache-section__badge cache-section__badge--l1">L1</span>
          <span className="cache-section__name">Direct-Mapped Cache</span>
        </div>
        <span className="cache-section__spec mono">8 blocks · 16B/block</span>
      </div>

      <div className="l1-grid">
        {l1.map((entry, i) => {
          const isActive = highlights.l1Index === i && result;
          const action = isActive ? highlights.l1Action : null;

          return (
            <motion.div
              key={i}
              className={`cache-slot ${entry ? 'cache-slot--filled' : 'cache-slot--empty'} ${
                isActive ? `cache-slot--active-${result?.toLowerCase().replace('_', '-')}` : ''
              }`}
              animate={isActive ? (slotBgPulse[result] || {}) : {}}
            >
              <div className="cache-slot__index mono">Idx {i}</div>

              <AnimatePresence mode="wait" initial={false}>
                {entry ? (
                  <motion.div
                    key={`block-${entry.tag}`}
                    className="cache-slot__block"
                    custom={result}
                    variants={blockVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <motion.div
                      className="cache-slot__tag mono"
                      animate={isActive && action === 'hit' ? hitPulse[result] : {}}
                    >
                      {hex(entry.tag)}
                    </motion.div>

                    <AnimatePresence>
                      {entry.dirty && (
                        <motion.span
                          className="cache-slot__dirty"
                          title="Dirty bit set"
                          variants={dirtyVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          key={`dirty-${entry.tag}`}
                        >
                          D
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    className="cache-slot__empty-label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    transition={{ duration: 0.3 }}
                  >
                    —
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Incoming arrow indicator */}
              <AnimatePresence>
                {isActive && action === 'incoming' && (
                  <motion.div
                    className="cache-slot__arrow"
                    initial={{ opacity: 0, y: -14, scale: 0.5 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    key={`arrow-${stepIndex}`}
                  >
                    ↓
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
