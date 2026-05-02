import { motion, AnimatePresence } from 'framer-motion';
import '../styles/simulation.css';

// =============================================================================
// VCGrid — Fully-Associative Victim Cache Visualization (4 entries, LRU)
// =============================================================================
// Phase 3: Enhanced with layout animations for LRU reordering, directional
// slide-in/out, and smooth disabled state transition.
// =============================================================================

const hex = (n) => (n !== undefined && n !== null ? `0x${n.toString(16).toUpperCase()}` : '');

// ─── Block enters VC from L1 (slides down from above) ───────────────────────
const entryVariants = {
  initial: { scale: 0.7, opacity: 0, y: -25, filter: 'blur(3px)' },
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 320, damping: 22, mass: 0.7 },
  },
  exit: {
    scale: 0.7,
    opacity: 0,
    y: 25,
    filter: 'blur(3px)',
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

// ─── Hit flash on the tag ────────────────────────────────────────────────────
const vcHitPulse = {
  scale: [1, 1.2, 1],
  color: ['#e2e8f0', '#facc15', '#facc15', '#e2e8f0'],
  transition: { duration: 0.6, ease: 'easeInOut' },
};

// ─── Eviction shake ─────────────────────────────────────────────────────────
const evictShake = {
  x: [0, -4, 4, -3, 3, -1, 1, 0],
  opacity: [1, 0.8, 0.8, 0.6, 0.6, 0.4, 0.4, 0],
  transition: { duration: 0.4 },
};

// ─── MRU dot pulse ──────────────────────────────────────────────────────────
const mruPulse = {
  scale: [1, 1.4, 1],
  opacity: [0.7, 1, 0.7],
  transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
};

export default function VCGrid({ snapshot, useVC }) {
  const vc = snapshot?.vc || [];
  const highlights = snapshot?.highlights || {};
  const result = snapshot?.result || null;
  const stepIndex = snapshot?.stepIndex ?? -1;

  // Pad to 4 slots for consistent layout
  const slots = new Array(4).fill(null);
  vc.forEach((entry, i) => {
    slots[i] = entry;
  });

  if (!useVC) {
    return (
      <motion.div
        className="cache-section cache-section--disabled"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0.35 }}
        transition={{ duration: 0.4 }}
      >
        <div className="cache-section__header">
          <div className="cache-section__label">
            <span className="cache-section__badge cache-section__badge--vc">VC</span>
            <span className="cache-section__name">Victim Cache</span>
          </div>
          <motion.span
            className="cache-section__spec cache-section__spec--off"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            DISABLED
          </motion.span>
        </div>
        <div className="vc-grid vc-grid--disabled">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="cache-slot cache-slot--disabled">
              <div className="cache-slot__empty-label">✕</div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  const filledCount = vc.length;

  return (
    <div className="cache-section">
      <div className="cache-section__header">
        <div className="cache-section__label">
          <span className="cache-section__badge cache-section__badge--vc">VC</span>
          <span className="cache-section__name">Victim Cache</span>
        </div>
        <span className="cache-section__spec mono">4 entries · Fully Associative · LRU</span>
      </div>

      <div className="vc-grid">
        <div className="vc-lru-labels">
          <span className="vc-lru-label">LRU</span>
          <span className="vc-lru-label">MRU</span>
        </div>
        <div className="vc-slots">
          {slots.map((entry, i) => {
            const isHit = highlights.vcIndex === i && highlights.vcAction === 'hit';
            const isEvicted = i === 0 && highlights.vcAction === 'evicted' && result === 'L2_FETCH';
            const isMRU = entry && i === filledCount - 1;

            return (
              <div
                key={`vc-slot-${i}`}
                className={`cache-slot cache-slot--vc ${entry ? 'cache-slot--filled' : 'cache-slot--empty'} ${
                  isHit ? 'cache-slot--active-vc-hit' : ''
                } ${isEvicted ? 'cache-slot--evicting' : ''}`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {entry ? (
                    <motion.div
                      key={`vc-block-${entry.tag}`}
                      className="cache-slot__block"
                      variants={entryVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      <motion.span
                        className="cache-slot__tag mono"
                        animate={isHit ? vcHitPulse : (isEvicted ? evictShake : {})}
                        key={`vctag-${entry.tag}-${stepIndex}`}
                      >
                        {hex(entry.tag)}
                      </motion.span>

                      <AnimatePresence>
                        {entry.dirty && (
                          <motion.span
                            className="cache-slot__dirty"
                            title="Dirty bit set"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                            key={`vcdirty-${entry.tag}`}
                          >
                            D
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {isMRU && (
                        <motion.span
                          className="cache-slot__mru-dot"
                          title="Most Recently Used"
                          animate={mruPulse}
                        />
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`vc-empty-${i}`}
                      className="cache-slot__empty-label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.15 }}
                    >
                      —
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
