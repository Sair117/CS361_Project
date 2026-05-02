import os
import sys
import json
from collections import OrderedDict
import matplotlib.pyplot as plt

# =============================================================================
# BLOCK 1 — Imports, Constants, Data Structure Initialization
# =============================================================================

TRACE_FILE_LOW = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'trace_low.txt')
TRACE_FILE_HIGH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'trace_high.txt')

# ─── Cache Specifications ──────────────────────────────────────────────────
L1_SIZE = 8                # 8 blocks
BLOCK_SIZE = 16            # 16 bytes per block (4 words)
VICTIM_CACHE_SIZE = 4      # 4 entries

# ─── Cycle Penalties ───────────────────────────────────────────────────────
CYCLES_L1_HIT = 1
CYCLES_VC_PROBE = 1        # 1 cycle to check Victim Cache on L1 miss
CYCLES_VC_SWAP = 1         # 1 additional cycle to swap blocks if VC hits
CYCLES_L2_FETCH = 15       # Additive to L1/VC miss probes

# ─── Hardware State ────────────────────────────────────────────────────────
l1_cache = []
victim_cache = OrderedDict()
l2_cache = set()
metrics = {}

def reset_simulator():
    """Resets all global state for clean testing/simulation."""
    global l1_cache, victim_cache, metrics
    l1_cache = [None] * L1_SIZE
    victim_cache = OrderedDict()
    metrics = {
        "total_accesses": 0,
        "total_clock_cycles": 0,
        "l1_hits": 0,
        "victim_cache_hits": 0,
        "l2_fetches": 0,
        "total_writebacks": 0,
        "read_ops": 0,
        "write_ops": 0
    }

# Initialize the simulator right away
reset_simulator()

# =============================================================================
# BLOCK 2 — Helper Functions (Address Mapping)
# =============================================================================

def get_block_tag(address):
    return address >> 4

def get_l1_index(tag):
    return tag & 7

# =============================================================================
# BLOCK 4 — Victim Swap Function (VC Hit Path)
# =============================================================================

def swap_victim_to_l1(tag, l1_index, is_write):
    """
    Handles an L1 Miss but Victim Cache Hit.
    1. Removes the requested block from VC.
    2. Puts the requested block into L1.
    3. Pushes the evicted L1 block down into the Victim Cache as the MRU.
    """
    global l1_cache, victim_cache

    # 1. Pop the requested block from VC
    vc_dirty = victim_cache.pop(tag)

    # 2. Get the current block in L1 to be displaced
    evicted_block = l1_cache[l1_index]

    # 3. Put the requested block into L1
    # If this is a Write op, it becomes dirty regardless of its previous state
    new_dirty = True if is_write else vc_dirty
    l1_cache[l1_index] = (tag, new_dirty)

    # 4. Push the evicted L1 block into VC (if L1 wasn't empty)
    if evicted_block is not None:
        evicted_tag, evicted_dirty = evicted_block
        # Insert into OrderedDict. New keys are added at the end (MRU position)
        victim_cache[evicted_tag] = evicted_dirty

# =============================================================================
# BLOCK 5 — L2 Fetch Workflow (L1 Miss, VC Miss Path)
# =============================================================================

def fetch_from_l2(tag, l1_index, is_write, use_vc):
    """
    Handles a miss in both L1 and VC.
    1. Fetches from L2 directly into L1.
    2. The evicted L1 block is pushed to VC.
    3. If VC is full, the LRU block in VC is evicted to L2 (triggering write-back if dirty).
    """
    global l1_cache, victim_cache, metrics

    metrics["l2_fetches"] += 1

    # The block fetched from L2 is clean, unless this op is a Write
    new_dirty = True if is_write else False

    # Get the block currently in L1
    evicted_block = l1_cache[l1_index]

    # Install the new block into L1
    l1_cache[l1_index] = (tag, new_dirty)

    # Handle the evicted L1 block (push to VC)
    if use_vc and evicted_block is not None:
        evicted_tag, evicted_dirty = evicted_block

        # If VC is full, evict the LRU (the first item inserted in OrderedDict)
        if len(victim_cache) >= VICTIM_CACHE_SIZE:
            # popitem(last=False) pops from the beginning (LRU)
            lru_tag, lru_dirty = victim_cache.popitem(last=False)
            
            # Silent Write-Back to L2 (no extra cycle penalty)
            if lru_dirty:
                metrics["total_writebacks"] += 1

        # Push the evicted L1 block into VC as MRU
        victim_cache[evicted_tag] = evicted_dirty
    elif not use_vc and evicted_block is not None:
        # If VC is disabled, evicted dirty blocks from L1 go straight to L2
        evicted_tag, evicted_dirty = evicted_block
        if evicted_dirty:
            metrics["total_writebacks"] += 1

# =============================================================================
# BLOCK 3 — Core Cache Access Logic
# =============================================================================

def access_memory(address, op, use_vc):
    """
    Main memory access dispatcher.
    Checks L1 -> VC -> L2 in order, applying the cycle penalties cumulatively.
    """
    global metrics, l1_cache, victim_cache

    metrics["total_accesses"] += 1
    if op == 'R':
        metrics["read_ops"] += 1
    elif op == 'W':
        metrics["write_ops"] += 1

    is_write = (op == 'W')
    tag = get_block_tag(address)
    l1_index = get_l1_index(tag)

    # ─── 1. Probe L1 ─────────────────────────────────────────────────────────
    metrics["total_clock_cycles"] += CYCLES_L1_HIT
    l1_entry = l1_cache[l1_index]

    if l1_entry is not None and l1_entry[0] == tag:
        # L1 HIT
        metrics["l1_hits"] += 1
        if is_write:
            # Update dirty bit on write hit
            l1_cache[l1_index] = (tag, True)
        return

    # ─── 2. Probe Victim Cache (L1 Miss) ─────────────────────────────────────
    if use_vc:
        metrics["total_clock_cycles"] += CYCLES_VC_PROBE
        
        if tag in victim_cache:
            # VC HIT
            metrics["total_clock_cycles"] += CYCLES_VC_SWAP
            metrics["victim_cache_hits"] += 1
            swap_victim_to_l1(tag, l1_index, is_write)
            return

    # ─── 3. Fetch from L2 (L1 Miss + VC Miss) ────────────────────────────────
    metrics["total_clock_cycles"] += CYCLES_L2_FETCH
    fetch_from_l2(tag, l1_index, is_write, use_vc)

# =============================================================================
# BLOCK 6 — Trace File Reader & Simulation Loop
# =============================================================================

def run_simulation(trace_path, use_vc):
    """
    Reads the trace file line by line and feeds it into the cache simulator.
    """
    if not os.path.exists(trace_path):
        print(f"Error: Trace file not found at {trace_path}", file=sys.stderr)
        sys.exit(1)
        
    reset_simulator()

    with open(trace_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            parts = line.split()
            if len(parts) == 2:
                op = parts[0]
                # Convert hex string (e.g., '0x1000') to integer
                address = int(parts[1], 16)
                access_memory(address, op, use_vc)
                
    return calculate_metrics()

# =============================================================================
# BLOCK 7 — Metrics Calculation & JSON Output
# =============================================================================

def calculate_metrics():
    """
    Calculates final Hit Rates and AMAT, then returns the results dict
    to be serialized as JSON for the Flutter front-end to parse.
    """
    global metrics

    total = metrics["total_accesses"]
    if total == 0:
        return {"error": "No accesses recorded"}

    # Calculate Rates
    l1_hit_rate = metrics["l1_hits"] / total
    vc_hit_rate = metrics["victim_cache_hits"] / total
    
    # In our model, every L2 fetch is a hit in L2. The "global" L2 hit rate 
    # relative to total accesses is simply the fraction of accesses that reach L2.
    l2_hit_rate = metrics["l2_fetches"] / total

    # AMAT = Total Cycles / Total Accesses
    amat = metrics["total_clock_cycles"] / total

    final_results = {
        "total_accesses": total,
        "read_ops": metrics["read_ops"],
        "write_ops": metrics["write_ops"],
        "total_clock_cycles": metrics["total_clock_cycles"],
        "l1_hits": metrics["l1_hits"],
        "l1_hit_rate": round(l1_hit_rate, 4),
        "victim_cache_hits": metrics["victim_cache_hits"],
        "victim_cache_hit_rate": round(vc_hit_rate, 4),
        "l2_fetches": metrics["l2_fetches"],
        "l2_hit_rate": round(l2_hit_rate, 4),
        "total_writebacks": metrics["total_writebacks"],
        "amat": round(amat, 2)
    }

    return final_results

# =============================================================================
# BLOCK 8 — [TEST] Inline Verification
# =============================================================================


def run_test_micro_trace():
    """
    Runs a tiny, hand-calculated trace to verify cycle logic and swaps.
    
    Expected Behavior:
    1. R 0x1000 -> Tag 0x100, L1 Idx 0. Cold Miss -> L2. (+17 cycles)
    2. R 0x1004 -> Tag 0x100, L1 Idx 0. L1 Hit. (+1 cycle)
    3. R 0xA000 -> Tag 0xA00, L1 Idx 0. Miss -> L2. Evicts 0x100 to VC. (+17 cycles)
    4. R 0x1000 -> Tag 0x100, L1 Idx 0. L1 Miss, VC Hit! Swaps 0xA00 down to VC. (+3 cycles)
    5. W 0x1004 -> Tag 0x100, L1 Idx 0. L1 Hit (Write). Marks Dirty. (+1 cycle)
    
    Total Cycles Expected: 17 + 1 + 17 + 3 + 1 = 39
    Total Accesses: 5
    AMAT: 39 / 5 = 7.8
    """
    print("--- [TEST] Running Micro-Trace ---", file=sys.stderr)
    reset_simulator()
    
    test_trace = [
        ("R", 0x1000),
        ("R", 0x1004),
        ("R", 0xA000),
        ("R", 0x1000),
        ("W", 0x1004)
    ]
    
    for op, addr in test_trace:
        access_memory(addr, op, use_vc=True)
        
    print(f"[TEST] Total Cycles: {metrics['total_clock_cycles']} (Expected: 39)", file=sys.stderr)
    print(f"[TEST] L1 Hits: {metrics['l1_hits']} (Expected: 2)", file=sys.stderr)
    print(f"[TEST] VC Hits: {metrics['victim_cache_hits']} (Expected: 1)", file=sys.stderr)
    
    # Check dirty bit
    l1_entry = l1_cache[get_l1_index(get_block_tag(0x1004))]
    is_dirty = l1_entry[1] if l1_entry else False
    print(f"[TEST] Block 0x100 is Dirty: {is_dirty} (Expected: True)", file=sys.stderr)
    print("----------------------------------\n", file=sys.stderr)

# =============================================================================
# BLOCK 9 — Graph Generation
# =============================================================================

def generate_graphs(results_dict):
    """
    Uses matplotlib to create bar charts comparing AMAT and Cycles.
    """
    labels = ['Low (VC ON)', 'Low (VC OFF)', 'High (VC ON)', 'High (VC OFF)']
    
    amats = [
        results_dict['low_traffic_vc_on']['amat'],
        results_dict['low_traffic_vc_off']['amat'],
        results_dict['high_traffic_vc_on']['amat'],
        results_dict['high_traffic_vc_off']['amat']
    ]
    
    cycles = [
        results_dict['low_traffic_vc_on']['total_clock_cycles'],
        results_dict['low_traffic_vc_off']['total_clock_cycles'],
        results_dict['high_traffic_vc_on']['total_clock_cycles'],
        results_dict['high_traffic_vc_off']['total_clock_cycles']
    ]

    # Plot AMAT
    plt.figure(figsize=(8, 5))
    bars = plt.bar(labels, amats, color=['#4CAF50', '#F44336', '#8BC34A', '#E53935'])
    plt.title('Average Memory Access Time (AMAT) Comparison')
    plt.ylabel('AMAT (Cycles)')
    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2, yval + 0.1, round(yval, 2), ha='center', va='bottom')
    plt.tight_layout()
    amat_path = os.path.join(os.path.dirname(__file__), 'comparison_amat.png')
    plt.savefig(amat_path)
    plt.close()

    # Plot Total Cycles
    plt.figure(figsize=(8, 5))
    bars = plt.bar(labels, cycles, color=['#2196F3', '#FF9800', '#03A9F4', '#FFB74D'])
    plt.title('Total Clock Cycles Comparison')
    plt.ylabel('Cycles')
    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2, yval + 10, int(yval), ha='center', va='bottom')
    plt.tight_layout()
    cycles_path = os.path.join(os.path.dirname(__file__), 'comparison_cycles.png')
    plt.savefig(cycles_path)
    plt.close()

    print(f"[TEST] Graphs saved to:\n  - {amat_path}\n  - {cycles_path}", file=sys.stderr)


# =============================================================================
# Main Execution
# =============================================================================

if __name__ == "__main__":
    final_output = {}

    # If the user passed '--test', run the test block first.
    # We print test output to stderr so it doesn't corrupt the final JSON on stdout.
    if "--test" in sys.argv:
        run_test_micro_trace()
        
        print("--- [TEST] Running Traffic & VC Comparisons ---", file=sys.stderr)
        
        res_low_on = run_simulation(TRACE_FILE_LOW, use_vc=True)
        res_low_off = run_simulation(TRACE_FILE_LOW, use_vc=False)
        res_high_on = run_simulation(TRACE_FILE_HIGH, use_vc=True)
        res_high_off = run_simulation(TRACE_FILE_HIGH, use_vc=False)
        
        final_output = {
            "low_traffic_vc_on": res_low_on,
            "low_traffic_vc_off": res_low_off,
            "high_traffic_vc_on": res_high_on,
            "high_traffic_vc_off": res_high_off
        }
        
        generate_graphs(final_output)
        print("-----------------------------------------------", file=sys.stderr)
    else:
        # Default run (just High Traffic, VC ON)
        final_output = {
            "high_traffic_vc_on": run_simulation(TRACE_FILE_HIGH, use_vc=True)
        }
    
    # Emit JSON (to stdout)
    print(json.dumps(final_output, indent=2))

