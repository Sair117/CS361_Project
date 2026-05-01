/**
 * ============================================================================
 * Power-Aware Cache Architecture Simulator
 * IoT Workload Generator — Agricultural Soil Sensor Trace
 * ============================================================================
 *
 * This script generates a deterministic memory trace file (trace.txt) that
 * simulates the behavior of an embedded agricultural soil sensor waking up,
 * polling sensor registers, and thrashing its L1 cache.
 *
 * Trace Format:  [Operation] [HexAddress]
 *   - R = Read
 *   - W = Write
 *
 * Phases:
 *   Phase 1:  Instruction Fetch   (R)  0x1000 – 0x1010
 *   Phase 2:  Sensor Polling Burst (R)  0xA000 – 0xA500
 *   Phase 2b: Sensor Data Write    (W)  0xB000 – 0xB040
 *   Phase 3:  Re-Execution         (R)  0x1000 – 0x1010  (triggers Victim Cache)
 *
 * Output: ../trace.txt (relative to this script's directory)
 *
 * Author:  Samaan — CS361 Semester Project
 * Date:    2026-04-26
 * ============================================================================
 */

// ─── Imports ────────────────────────────────────────────────────────────────
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── ES6 Module __dirname Equivalent ────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Output file path — trace.txt lives in the parent 'simulator/' directory
 * so both the Node.js generator and the Python engine can reference it.
 */
const OUTPUT_FILE = path.join(__dirname, '..', 'trace.txt');

/**
 * Memory address ranges for each workload phase.
 * All addresses are word-aligned (4-byte stride).
 * Block size = 16 bytes, so addresses sharing the same (addr >> 4) are
 * in the same cache block.
 */
const PHASE_1 = {
    name:  'Instruction Fetch',
    op:    'R',
    start: 0x1000,    // Instruction memory base
    end:   0x1010,    // Inclusive upper bound
    step:  4          // Word-aligned stride (4 bytes)
};

const PHASE_2 = {
    name:  'Sensor Polling Burst',
    op:    'R',
    start: 0xA000,    // Sensor register base
    end:   0xA500,    // Inclusive upper bound — large burst
    step:  4          // Word-aligned stride
};

const PHASE_2B = {
    name:  'Sensor Data Write-Back',
    op:    'W',
    start: 0xB000,    // Processed data buffer base
    end:   0xB040,    // Inclusive upper bound
    step:  4          // Word-aligned stride
};

const PHASE_3 = {
    name:  'Re-Execution (Victim Cache Trigger)',
    op:    'R',
    start: 0x1000,    // Same as Phase 1 — re-fetch instructions
    end:   0x1010,    // Inclusive upper bound
    step:  4          // Word-aligned stride
};

/**
 * Collects all trace lines before writing to disk in one batch.
 * Each entry is a string like "R 0x1000".
 */
const traceLines = [];

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 2 — Phase 1: Instruction Fetches (R)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generates trace lines for a given workload phase.
 * Iterates from phase.start to phase.end (inclusive) in increments of
 * phase.step, pushing formatted trace entries into the traceLines array.
 *
 * @param {Object} phase - A phase config object { name, op, start, end, step }
 */
const generatePhase = (phase) => {
    console.log(`[GEN] Generating phase: ${phase.name}`);
    console.log(`      Range: 0x${phase.start.toString(16).toUpperCase()} – 0x${phase.end.toString(16).toUpperCase()}, Op: ${phase.op}`);

    let count = 0;
    for (let addr = phase.start; addr <= phase.end; addr += phase.step) {
        // Format address as 0x-prefixed uppercase hex string
        const hexAddr = `0x${addr.toString(16).toUpperCase()}`;
        traceLines.push(`${phase.op} ${hexAddr}`);
        count++;
    }

    console.log(`      Generated ${count} trace entries.\n`);
};

/**
 * Phase 1 — Instruction Fetch
 *
 * Simulates the CPU fetching a small instruction loop after waking up.
 * Addresses 0x1000–0x1010 at stride 4 produce 5 accesses covering 2 cache
 * blocks (tag 0x100 and tag 0x101 with 16-byte block size).
 *
 * Expected: These 2 blocks warm up L1 slots 0 and 1.
 */
generatePhase(PHASE_1);

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 3 — Phase 2: Sensor Polling Burst (R)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Phase 2 — Sensor Polling Burst
 *
 * Simulates the sensor reading a large block of peripheral registers.
 * Addresses 0xA000–0xA500 at stride 4 produce 321 accesses spanning
 * many cache blocks. Since L1 has only 8 slots (direct-mapped), this
 * massive burst will cause conflict misses and evict the Phase 1
 * instruction blocks from L1 into the Victim Cache.
 *
 * Key insight: tag 0xA00 maps to L1 index (0xA00 & 7) = 0, which is
 * the same slot as tag 0x100 from Phase 1. This is the conflict miss
 * that pushes the instruction block into the Victim Cache.
 */
generatePhase(PHASE_2);

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 4 — Phase 2b: Sensor Data Write-Back (W)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Phase 2b — Sensor Data Write-Back
 *
 * After reading sensor registers, the MCU writes processed/calibrated
 * values into a data buffer at 0xB000–0xB040. These are Write (W)
 * operations that exercise the dirty-bit logic in the simulator.
 *
 * Addresses 0xB000–0xB040 at stride 4 produce 17 accesses covering
 * 5 cache blocks (tags 0xB00–0xB04). When these blocks are eventually
 * evicted, their dirty bits will trigger write-back behavior.
 */
generatePhase(PHASE_2B);

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 5 — Phase 3: Re-Execution / Victim Cache Trigger (R)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Phase 3 — Re-Execution
 *
 * The CPU returns to executing the same instruction loop from Phase 1
 * (0x1000–0x1010). Since Phase 2's burst evicted these blocks from L1,
 * they should now reside in the Victim Cache (if not yet evicted by LRU).
 *
 * Expected behavior:
 *   - L1 MISS on tag 0x100 (slot 0 now holds a sensor/data tag)
 *   - Victim Cache HIT → swap tag 0x100 back into L1, push displaced
 *     block into VC. Cost: 3 cycles (1 L1 probe + 2 VC swap).
 *
 * This is the core demonstration of the Victim Cache rescue mechanism.
 */
generatePhase(PHASE_3);

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 6 — Write Trace File to Disk
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Writes all accumulated trace lines to the output file.
 * Uses a single fs.writeFileSync call for atomicity — the entire trace
 * is written at once, preventing partial-file issues.
 */
const writeTraceFile = () => {
    const content = traceLines.join('\n') + '\n';   // Trailing newline for POSIX compliance
    fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
    console.log(`[IO] Trace file written to: ${OUTPUT_FILE}`);
    console.log(`[IO] Total trace lines: ${traceLines.length}`);
};

writeTraceFile();

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 7 — [TEST] Validation: Read Back and Verify
// ═════════════════════════════════════════════════════════════════════════════

/**
 * ──────────────────────────────────────────────────────────────────────
 *  TEST BLOCK — Self-Validation
 * ──────────────────────────────────────────────────────────────────────
 *  This block reads the generated trace.txt back from disk and prints
 *  summary statistics for manual verification.
 *
 *  EXPECTED OUTPUT:
 *  ────────────────
 *  [TEST] === Trace File Validation ===
 *  [TEST] Total lines:    343
 *  [TEST] Read  (R) ops:  326
 *  [TEST] Write (W) ops:  17
 *  [TEST] First line:     R 0x1000
 *  [TEST] Last  line:     R 0x1010
 *  [TEST] ✓ All validations passed.
 *
 *  VERIFICATION LOGIC:
 *    - Phase 1:  (0x1010 - 0x1000) / 4 + 1 = 5 lines   (R)
 *    - Phase 2:  (0xA500 - 0xA000) / 4 + 1 = 321 lines  (R)
 *    - Phase 2b: (0xB040 - 0xB000) / 4 + 1 = 17 lines   (W)
 *    - Phase 3:  (0x1010 - 0x1000) / 4 + 1 = 5 lines    (R)
 *    - TOTAL: 5 + 321 + 17 + 5 = 348 lines
 *    - Read ops:  5 + 321 + 5 = 331
 *    - Write ops: 17
 * ──────────────────────────────────────────────────────────────────────
 */
const validateTraceFile = () => {
    console.log('\n[TEST] === Trace File Validation ===');

    // Read the file back from disk
    const rawContent = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    const lines = rawContent.trim().split('\n');

    // Count operations by type
    const readOps  = lines.filter(line => line.startsWith('R')).length;
    const writeOps = lines.filter(line => line.startsWith('W')).length;

    console.log(`[TEST] Total lines:    ${lines.length}`);
    console.log(`[TEST] Read  (R) ops:  ${readOps}`);
    console.log(`[TEST] Write (W) ops:  ${writeOps}`);
    console.log(`[TEST] First line:     ${lines[0]}`);
    console.log(`[TEST] Last  line:     ${lines[lines.length - 1]}`);

    // ─── Assertions ─────────────────────────────────────────────────────
    const expectedTotal = 348;
    const expectedReads = 331;
    const expectedWrites = 17;

    let passed = true;

    if (lines.length !== expectedTotal) {
        console.error(`[TEST] ✗ FAIL: Expected ${expectedTotal} lines, got ${lines.length}`);
        passed = false;
    }
    if (readOps !== expectedReads) {
        console.error(`[TEST] ✗ FAIL: Expected ${expectedReads} reads, got ${readOps}`);
        passed = false;
    }
    if (writeOps !== expectedWrites) {
        console.error(`[TEST] ✗ FAIL: Expected ${expectedWrites} writes, got ${writeOps}`);
        passed = false;
    }
    if (lines[0] !== 'R 0x1000') {
        console.error(`[TEST] ✗ FAIL: First line should be "R 0x1000", got "${lines[0]}"`);
        passed = false;
    }
    if (lines[lines.length - 1] !== 'R 0x1010') {
        console.error(`[TEST] ✗ FAIL: Last line should be "R 0x1010", got "${lines[lines.length - 1]}"`);
        passed = false;
    }

    if (passed) {
        console.log('[TEST] ✓ All validations passed.');
    }
};

validateTraceFile();
