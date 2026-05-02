// =============================================================================
// Embedded Workload Traces
// =============================================================================
// Three workloads demonstrating different victim cache behaviors:
// 1. Low Traffic  — Small sensor burst, VC rescues instruction blocks
// 2. High Traffic — Massive burst causes thrashing, VC becomes counterproductive
// 3. Conflict Loop — Tight alternating access, VC swap saves 14 cycles each time
// =============================================================================

// ─── Helper: Generate sequential addresses ─────────────────────────────────
function genRange(op, start, end, step = 4) {
  const trace = [];
  for (let addr = start; addr <= end; addr += step) {
    trace.push({ op, addr });
  }
  return trace;
}

// ─── Helper: Generate alternating conflict pattern ──────────────────────────
function genConflictLoop(addrA, addrB, wordsPerBlock, rounds) {
  const trace = [];
  for (let r = 0; r < rounds; r++) {
    // Access block A (all words in the block)
    for (let w = 0; w < wordsPerBlock; w++) {
      trace.push({ op: 'R', addr: addrA + w * 4 });
    }
    // Access block B (all words in the block)
    for (let w = 0; w < wordsPerBlock; w++) {
      trace.push({ op: 'R', addr: addrB + w * 4 });
    }
  }
  return trace;
}

// =============================================================================
// Workload Definitions
// =============================================================================

export const WORKLOADS = {
  low_traffic: {
    id: 'low_traffic',
    name: 'Low Traffic — Sensor Wake',
    shortName: 'Low Traffic',
    description:
      'Small sensor burst (2 data blocks). The victim cache successfully rescues the instruction blocks when the CPU re-executes them.',
    expectedResult: 'VC helps: 2 hits, ~8.6% cycle savings',
    icon: '🌱',
    color: '#4ade80',
    trace: [
      // Phase 1: Instruction Fetch (0x1000–0x1010, 5 reads, 2 blocks)
      ...genRange('R', 0x1000, 0x1010),
      // Phase 2: Small Sensor Polling (0xA000–0xA010, 5 reads, 2 blocks)
      ...genRange('R', 0xa000, 0xa010),
      // Phase 2b: Sensor Data Write-Back (0xB000–0xB040, 17 writes)
      ...genRange('W', 0xb000, 0xb040),
      // Phase 3: Re-Execution (0x1000–0x1010, 5 reads — VC rescue!)
      ...genRange('R', 0x1000, 0x1010),
    ],
  },

  high_traffic: {
    id: 'high_traffic',
    name: 'High Traffic — Sensor Thrashing',
    shortName: 'High Traffic',
    description:
      'Massive 80-block sensor burst (0xA000–0xA500) completely flushes the 4-entry victim cache 20× over. When the CPU returns to re-execute instructions, they are long gone from the VC.',
    expectedResult: 'VC hurts: 0 hits, adds probe overhead (+90 wasted cycles)',
    icon: '🔥',
    color: '#f87171',
    trace: [
      // Phase 1: Instruction Fetch
      ...genRange('R', 0x1000, 0x1010),
      // Phase 2: Massive Sensor Polling Burst (80 unique blocks!)
      ...genRange('R', 0xa000, 0xa500),
      // Phase 2b: Sensor Data Write-Back
      ...genRange('W', 0xb000, 0xb040),
      // Phase 3: Re-Execution (too late — blocks flushed from VC)
      ...genRange('R', 0x1000, 0x1010),
    ],
  },

  conflict_loop: {
    id: 'conflict_loop',
    name: 'Conflict Loop — VC Showcase',
    shortName: 'Conflict Loop',
    description:
      'Two functions at 0x2000 and 0x2080 map to the same L1 index (0). The CPU alternates between them in a tight loop. After 2 cold misses, every swap is a VC hit (3 cycles) instead of an L2 fetch (17 cycles).',
    expectedResult: 'VC shines: ~18 hits, ~2× speedup vs no VC',
    icon: '⚡',
    color: '#facc15',
    trace: [
      // Tight alternating access between two conflicting blocks
      // 0x2000 → tag 0x200, index 0
      // 0x2080 → tag 0x208, index 0
      // Both map to L1 slot 0 — every alternation is a conflict miss
      // With VC: after 2 cold misses, every swap costs only 3 cycles
      // Without VC: every alternation costs 17 cycles (L2 fetch)
      ...genConflictLoop(0x2000, 0x2080, 4, 10),
    ],
  },
};

// ─── Workload list for dropdowns ────────────────────────────────────────────
export const WORKLOAD_LIST = Object.values(WORKLOADS);

// ─── Default workload ───────────────────────────────────────────────────────
export const DEFAULT_WORKLOAD = 'conflict_loop';
