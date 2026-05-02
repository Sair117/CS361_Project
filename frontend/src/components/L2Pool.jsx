import { motion, AnimatePresence } from 'framer-motion';
import '../styles/simulation.css';

// =============================================================================
// L2Pool — Backing Store Visualization
// =============================================================================
// Phase 3: Enhanced with animated dot grid, pulse effects on fetch/receive,
// and a glowing activity indicator.
// =============================================================================

const hex = (n) => `0x${n.toString(16).toUpperCase()}`;

const dotVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: (i) => ({
    scale: 1,
    opacity: 0.5 + Math.random() * 0.3,
    transition: {
      delay: i * 0.02,
      type: 'spring',
      stiffness: 400,
      damping: 15,
    },
  }),
};

const eventVariants = {
  initial: { opacity: 0, x: 20, scale: 0.9 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } },
  exit: { opacity: 0, x: -20, scale: 0.9, transition: { duration: 0.15 } },
};

export default function L2Pool({ snapshot }) {
  const l2Size = snapshot?.l2Size || 0;
  const swapDetails = snapshot?.swapDetails || null;
  const result = snapshot?.result || null;
  const stepIndex = snapshot?.stepIndex ?? -1;

  const isFetching = result === 'L2_FETCH';
  const isReceiving = swapDetails?.evictedToL2 != null;

  return (
    <div className="cache-section">
      <div className="cache-section__header">
        <div className="cache-section__label">
          <span className="cache-section__badge cache-section__badge--l2">L2</span>
          <span className="cache-section__name">Main Memory / L2</span>
        </div>
        <span className="cache-section__spec mono">Perfect · 15 cycle penalty</span>
      </div>

      <div className="l2-pool">
        <motion.div
          className="l2-pool__bar"
          animate={
            isFetching
              ? {
                  borderColor: ['rgba(248,113,113,0.08)', 'rgba(248,113,113,0.3)', 'rgba(248,113,113,0.08)'],
                }
              : isReceiving
              ? {
                  borderColor: ['rgba(192,132,252,0.08)', 'rgba(192,132,252,0.3)', 'rgba(192,132,252,0.08)'],
                }
              : {}
          }
          transition={{ duration: 0.6 }}
        >
          <div className="l2-pool__visual">
            {Array.from({ length: Math.min(l2Size, 24) }).map((_, i) => (
              <motion.div
                key={`l2-dot-${i}`}
                className="l2-pool__dot"
                custom={i}
                variants={dotVariants}
                initial="initial"
                animate="animate"
              />
            ))}
            {l2Size > 24 && (
              <span className="l2-pool__overflow mono">+{l2Size - 24}</span>
            )}
          </div>

          <div className="l2-pool__stats">
            <span className="l2-pool__stat mono">
              {l2Size} block{l2Size !== 1 ? 's' : ''} evicted to L2
            </span>

            <AnimatePresence mode="wait">
              {isFetching && (
                <motion.span
                  className="l2-pool__event l2-pool__event--fetch"
                  variants={eventVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  key={`fetch-${stepIndex}`}
                >
                  <span className="l2-pool__event-icon">↑</span>
                  Fetching to L1
                </motion.span>
              )}
              {isReceiving && (
                <motion.span
                  className="l2-pool__event l2-pool__event--receive"
                  variants={eventVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  key={`recv-${stepIndex}`}
                >
                  <span className="l2-pool__event-icon">↓</span>
                  {swapDetails.evictedToL2.dirty ? 'Write-back from VC' : 'Evicted from VC'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Activity pulse ring */}
          {isFetching && (
            <motion.div
              className="l2-pool__pulse"
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              key={`pulse-${stepIndex}`}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
