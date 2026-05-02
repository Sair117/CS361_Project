import { motion } from 'framer-motion';
import '../styles/architecture.css';

// =============================================================================
// ArchitectureGuide — Static "How It Works" reference panel
// =============================================================================
// An expandable educational section explaining the cache hierarchy,
// access flow, and victim cache swap mechanics.
// =============================================================================

const SECTIONS = [
  {
    id: 'hierarchy',
    icon: '🧱',
    title: 'Memory Hierarchy',
    content: `The simulator models a 3-level memory hierarchy optimized for embedded IoT systems. 
The CPU first checks the L1 cache (direct-mapped, 8 blocks × 16B). On a miss, it probes the Victim Cache 
(fully associative, 4 entries, LRU eviction). If both miss, data is fetched from L2/Main Memory.`,
    diagram: [
      { label: 'CPU', color: '#e2e8f0', latency: '—' },
      { label: 'L1 Cache', color: '#4ade80', latency: '1 cycle' },
      { label: 'Victim Cache', color: '#facc15', latency: '+1 cycle probe' },
      { label: 'L2 / Memory', color: '#f87171', latency: '+15 cycles' },
    ],
  },
  {
    id: 'l1-hit',
    icon: '✅',
    title: 'L1 Hit (Best Case)',
    content: `The requested address maps directly to an L1 slot via its index bits. If the tag matches, 
it's a hit — the fastest path at just 1 cycle. No VC or L2 involvement.`,
    flow: ['CPU → L1', '1 cycle total'],
    accent: '#4ade80',
  },
  {
    id: 'vc-hit',
    icon: '🔄',
    title: 'VC Hit (Swap)',
    content: `When L1 misses but the block is found in the Victim Cache, a swap occurs: the VC block 
is promoted to L1, and the displaced L1 block is demoted to the VC as the MRU entry. This costs 
1 (L1 miss) + 1 (VC probe) = 2 cycles — much cheaper than an L2 fetch.`,
    flow: ['CPU → L1 miss → VC hit', 'L1 ↔ VC swap', '2 cycles total'],
    accent: '#facc15',
  },
  {
    id: 'l2-fetch',
    icon: '📥',
    title: 'L2 Fetch (Cold/Capacity Miss)',
    content: `When both L1 and VC miss, the block is fetched from L2 into L1. The evicted L1 block 
moves to the VC. If the VC is full, its LRU entry is evicted to L2. Dirty blocks trigger a 
write-back. Total cost: 1 + 1 + 15 = 17 cycles.`,
    flow: ['CPU → L1 miss → VC miss → L2 fetch', 'L2 → L1, old L1 → VC, old VC LRU → L2', '17 cycles total'],
    accent: '#f87171',
  },
  {
    id: 'dirty',
    icon: '✏️',
    title: 'Write-Back & Dirty Bits',
    content: `Write operations mark blocks as "dirty" (modified). The dirty bit travels with the block 
through the hierarchy. When a dirty block is evicted from the VC to L2, it triggers a write-back. 
In embedded pipelined architectures, this is a silent eviction with no additional cycle penalty.`,
    flow: ['Write → Mark dirty in L1', 'Dirty bit follows block to VC', 'Eviction from VC → Write-back to L2'],
    accent: '#c084fc',
  },
  {
    id: 'amat',
    icon: '📊',
    title: 'AMAT Formula',
    content: `Average Memory Access Time measures overall cache performance:`,
    formula: 'AMAT = Total Cycles ÷ Total Accesses',
    formulaSub: 'Lower AMAT = better cache utilization. The Victim Cache reduces AMAT by catching conflict misses that would otherwise go to L2.',
    accent: '#a78bfa',
  },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function ArchitectureGuide({ onClose }) {
  return (
    <div className="arch-overlay" onClick={onClose}>
      <motion.div
        className="arch-panel"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="arch-header">
          <div>
            <h2 className="arch-header__title">How It Works</h2>
            <p className="arch-header__subtitle">
              Cache Architecture Reference Guide
            </p>
          </div>
          <button className="hero-scene__close" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <motion.div
          className="arch-content"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {SECTIONS.map((section) => (
            <motion.div
              key={section.id}
              className="arch-card"
              variants={itemVariants}
            >
              <div className="arch-card__header">
                <span className="arch-card__icon">{section.icon}</span>
                <h3 className="arch-card__title">{section.title}</h3>
              </div>

              <p className="arch-card__text">{section.content}</p>

              {/* Hierarchy diagram */}
              {section.diagram && (
                <div className="arch-diagram">
                  {section.diagram.map((level, i) => (
                    <div key={level.label} className="arch-diagram__level">
                      <div
                        className="arch-diagram__box"
                        style={{ borderColor: level.color, color: level.color }}
                      >
                        {level.label}
                      </div>
                      <span className="arch-diagram__latency mono">{level.latency}</span>
                      {i < section.diagram.length - 1 && (
                        <div className="arch-diagram__arrow">↓</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Flow steps */}
              {section.flow && (
                <div className="arch-flow">
                  {section.flow.map((step, i) => (
                    <div
                      key={i}
                      className="arch-flow__step mono"
                      style={{ borderLeftColor: section.accent }}
                    >
                      {step}
                    </div>
                  ))}
                </div>
              )}

              {/* Formula */}
              {section.formula && (
                <div className="arch-formula">
                  <div className="arch-formula__expr mono" style={{ color: section.accent }}>
                    {section.formula}
                  </div>
                  <p className="arch-formula__sub">{section.formulaSub}</p>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
