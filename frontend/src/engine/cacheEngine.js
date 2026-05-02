// =============================================================================
// Cache Simulation Engine — JavaScript Port
// =============================================================================
// Direct port of the Python cache_simulator.py.
// Step-able design: each step() processes one trace access and returns a
// full state snapshot for the UI to render.
// =============================================================================

// ─── Cache Specifications ───────────────────────────────────────────────────
const L1_SIZE = 8;           // 8 blocks (direct-mapped)
const BLOCK_SIZE = 16;       // 16 bytes per block (4 words)
const VICTIM_CACHE_SIZE = 4; // 4 entries (fully associative, LRU)

// ─── Cycle Penalties ────────────────────────────────────────────────────────
const CYCLES_L1_HIT = 1;
const CYCLES_VC_PROBE = 1;   // 1 cycle to check Victim Cache on L1 miss
const CYCLES_VC_SWAP = 1;    // 1 additional cycle to swap blocks if VC hits
const CYCLES_L2_FETCH = 15;  // Additive to L1/VC miss probes

// ─── Address Helpers ────────────────────────────────────────────────────────
function getBlockTag(address) {
  return address >>> 4;
}

function getL1Index(tag) {
  return tag & 7;
}

// =============================================================================
// CacheSimulator Class
// =============================================================================

export class CacheSimulator {
  constructor(config = {}) {
    this.config = {
      l1Size: config.l1Size ?? L1_SIZE,
      blockSize: config.blockSize ?? BLOCK_SIZE,
      vcSize: config.vcSize ?? VICTIM_CACHE_SIZE,
      useVC: config.useVC ?? true,
    };
    this.trace = [];
    this.stepIndex = 0;
    this.reset();
  }

  // ─── State Management ───────────────────────────────────────────────────

  reset() {
    // L1: array of { tag, dirty } or null
    this.l1 = new Array(this.config.l1Size).fill(null);

    // Victim Cache: ordered array, index 0 = LRU, last = MRU
    // Each entry: { tag, dirty }
    this.vc = [];

    // L2: set of tags that have been evicted there (for visualization)
    this.l2 = new Set();

    // Metrics
    this.metrics = {
      totalAccesses: 0,
      totalClockCycles: 0,
      l1Hits: 0,
      vcHits: 0,
      l2Fetches: 0,
      totalWritebacks: 0,
      readOps: 0,
      writeOps: 0,
    };

    this.stepIndex = 0;
    this.lastEvent = null;
  }

  // ─── Trace Loading ──────────────────────────────────────────────────────

  loadTrace(traceArray) {
    // traceArray: [{ op: 'R'|'W', addr: number }, ...]
    this.trace = traceArray;
    this.reset();
  }

  // ─── Core Access Logic ──────────────────────────────────────────────────

  step() {
    if (this.stepIndex >= this.trace.length) {
      return null; // trace exhausted
    }

    const { op, addr } = this.trace[this.stepIndex];
    const isWrite = op === 'W';
    const tag = getBlockTag(addr);
    const l1Index = getL1Index(tag);

    this.metrics.totalAccesses++;
    if (isWrite) {
      this.metrics.writeOps++;
    } else {
      this.metrics.readOps++;
    }

    // Build the event object that describes what happened
    const event = {
      stepIndex: this.stepIndex,
      totalSteps: this.trace.length,
      access: { op, addr, tag, index: l1Index },
      result: null,        // 'L1_HIT' | 'VC_HIT' | 'L2_FETCH'
      cyclesCost: 0,
      swapDetails: null,   // { incoming, outgoing, evictedToL2 }
      highlights: {
        l1Index: l1Index,
        l1Action: null,    // 'hit' | 'incoming' | null
        vcIndex: null,     // index in VC array that was hit/modified
        vcAction: null,    // 'hit' | 'incoming' | 'evicted'
        l2Action: null,    // 'fetch' | 'evicted_to' | null
      },
    };

    // ── 1. Probe L1 ─────────────────────────────────────────────────────
    this.metrics.totalClockCycles += CYCLES_L1_HIT;
    event.cyclesCost += CYCLES_L1_HIT;

    const l1Entry = this.l1[l1Index];

    if (l1Entry !== null && l1Entry.tag === tag) {
      // L1 HIT
      this.metrics.l1Hits++;
      event.result = 'L1_HIT';
      event.highlights.l1Action = 'hit';

      if (isWrite) {
        this.l1[l1Index] = { tag, dirty: true };
      }

      this.lastEvent = event;
      this.stepIndex++;
      return this._buildSnapshot(event);
    }

    // ── 2. Probe Victim Cache (L1 Miss) ─────────────────────────────────
    if (this.config.useVC) {
      this.metrics.totalClockCycles += CYCLES_VC_PROBE;
      event.cyclesCost += CYCLES_VC_PROBE;

      const vcIdx = this.vc.findIndex((entry) => entry.tag === tag);

      if (vcIdx !== -1) {
        // VC HIT — swap
        this.metrics.totalClockCycles += CYCLES_VC_SWAP;
        event.cyclesCost += CYCLES_VC_SWAP;
        this.metrics.vcHits++;
        event.result = 'VC_HIT';
        event.highlights.l1Action = 'incoming';
        event.highlights.vcIndex = vcIdx;
        event.highlights.vcAction = 'hit';

        this._swapVictimToL1(tag, l1Index, isWrite, event);

        this.lastEvent = event;
        this.stepIndex++;
        return this._buildSnapshot(event);
      }
    }

    // ── 3. Fetch from L2 (L1 Miss + VC Miss) ───────────────────────────
    this.metrics.totalClockCycles += CYCLES_L2_FETCH;
    event.cyclesCost += CYCLES_L2_FETCH;
    this.metrics.l2Fetches++;
    event.result = 'L2_FETCH';
    event.highlights.l1Action = 'incoming';
    event.highlights.l2Action = 'fetch';

    this._fetchFromL2(tag, l1Index, isWrite, event);

    this.lastEvent = event;
    this.stepIndex++;
    return this._buildSnapshot(event);
  }

  // ─── Victim Swap (VC Hit Path) ──────────────────────────────────────────

  _swapVictimToL1(tag, l1Index, isWrite, event) {
    // 1. Pop the requested block from VC
    const vcIdx = this.vc.findIndex((entry) => entry.tag === tag);
    const vcEntry = this.vc.splice(vcIdx, 1)[0];
    const newDirty = isWrite ? true : vcEntry.dirty;

    // 2. Get the current block in L1 to be displaced
    const evictedBlock = this.l1[l1Index];

    // 3. Put the requested block into L1
    this.l1[l1Index] = { tag, dirty: newDirty };

    // 4. Push the evicted L1 block into VC as MRU
    if (evictedBlock !== null) {
      this.vc.push({ tag: evictedBlock.tag, dirty: evictedBlock.dirty });
      event.swapDetails = {
        incoming: { tag, from: 'VC' },
        outgoing: { tag: evictedBlock.tag, to: 'VC' },
        evictedToL2: null,
      };
    }
  }

  // ─── L2 Fetch (L1 Miss, VC Miss Path) ──────────────────────────────────

  _fetchFromL2(tag, l1Index, isWrite, event) {
    const newDirty = isWrite;

    // Get the block currently in L1
    const evictedBlock = this.l1[l1Index];

    // Install the new block into L1
    this.l1[l1Index] = { tag, dirty: newDirty };

    // Handle evicted L1 block
    if (this.config.useVC && evictedBlock !== null) {
      let evictedToL2 = null;

      // If VC is full, evict LRU (index 0)
      if (this.vc.length >= this.config.vcSize) {
        const lruEntry = this.vc.shift(); // pop from front (LRU)
        if (lruEntry.dirty) {
          this.metrics.totalWritebacks++;
        }
        this.l2.add(lruEntry.tag);
        evictedToL2 = { tag: lruEntry.tag, dirty: lruEntry.dirty };
        event.highlights.vcAction = 'evicted';
      }

      // Push evicted L1 block into VC as MRU
      this.vc.push({ tag: evictedBlock.tag, dirty: evictedBlock.dirty });

      event.swapDetails = {
        incoming: { tag, from: 'L2' },
        outgoing: { tag: evictedBlock.tag, to: 'VC' },
        evictedToL2,
      };
    } else if (!this.config.useVC && evictedBlock !== null) {
      // VC disabled — dirty blocks go straight to L2
      if (evictedBlock.dirty) {
        this.metrics.totalWritebacks++;
      }
      this.l2.add(evictedBlock.tag);
      event.swapDetails = {
        incoming: { tag, from: 'L2' },
        outgoing: { tag: evictedBlock.tag, to: 'L2' },
        evictedToL2: { tag: evictedBlock.tag, dirty: evictedBlock.dirty },
      };
    } else {
      event.swapDetails = {
        incoming: { tag, from: 'L2' },
        outgoing: null,
        evictedToL2: null,
      };
    }
  }

  // ─── Run All ────────────────────────────────────────────────────────────

  runAll() {
    while (this.stepIndex < this.trace.length) {
      this.step();
    }
    return this.getMetrics();
  }

  // ─── Snapshot Builder ───────────────────────────────────────────────────

  _buildSnapshot(event) {
    return {
      ...event,
      l1: this.l1.map((entry, i) => {
        if (entry === null) return null;
        return {
          tag: entry.tag,
          dirty: entry.dirty,
          index: i,
        };
      }),
      vc: this.vc.map((entry, i) => ({
        tag: entry.tag,
        dirty: entry.dirty,
        position: i, // 0 = LRU, last = MRU
      })),
      l2Size: this.l2.size,
      metrics: { ...this.metrics },
      progress: {
        current: this.stepIndex,
        total: this.trace.length,
        percent: Math.round((this.stepIndex / this.trace.length) * 100),
      },
    };
  }

  // ─── Getters ────────────────────────────────────────────────────────────

  getMetrics() {
    const m = this.metrics;
    const total = m.totalAccesses || 1;
    return {
      ...m,
      l1HitRate: +(m.l1Hits / total).toFixed(4),
      vcHitRate: +(m.vcHits / total).toFixed(4),
      l2HitRate: +(m.l2Fetches / total).toFixed(4),
      amat: +(m.totalClockCycles / total).toFixed(2),
    };
  }

  getState() {
    return this._buildSnapshot(this.lastEvent || {});
  }

  isComplete() {
    return this.stepIndex >= this.trace.length;
  }

  getProgress() {
    return {
      current: this.stepIndex,
      total: this.trace.length,
      percent: this.trace.length
        ? Math.round((this.stepIndex / this.trace.length) * 100)
        : 0,
    };
  }
}

// ─── Export Constants for UI ────────────────────────────────────────────────
export const CACHE_CONFIG = {
  L1_SIZE,
  BLOCK_SIZE,
  VICTIM_CACHE_SIZE,
  CYCLES_L1_HIT,
  CYCLES_VC_PROBE,
  CYCLES_VC_SWAP,
  CYCLES_L2_FETCH,
};
