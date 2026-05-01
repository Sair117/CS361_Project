# Power-Aware Cache Architecture Simulator

This project is a simulation of a memory hierarchy for an Embedded IoT System (Agricultural Soil Sensor). It consists of two components:
1. **IoT Workload Generator (Node.js)**: Produces a deterministic memory trace modeling a sensor wake-up, burst polling, data processing, and instruction re-execution.
2. **Hardware Simulation Engine (Python)**: Reads the generated trace and accurately models a blocking CPU with an L1 cache, a fully-associative Victim Cache, and a perfect L2 cache.

## 🏗️ Architecture

The simulator models the following memory hierarchy and access penalties:

*   **L1 Cache**: Direct-mapped, 8 blocks (16 bytes/block). Penalty: **1 cycle**.
*   **Victim Cache (VC)**: Fully associative, 4 entries with Least Recently Used (LRU) eviction. Penalty: **2 cycles** (additive to L1 miss).
*   **L2 Cache**: Modeled as an infinite/perfect cache. Penalty: **15 cycles** (additive to L1/VC miss).

### Core Mechanisms

1.  **Victim Swap Logic**: When an address misses in L1 but hits in the VC, the target block is popped from the VC and placed into L1. Simultaneously, the block evicted from L1 is pushed into the VC as the Most Recently Used (MRU) block. Total cycle cost: 3 cycles.
2.  **L2 Fetch Workflow**: When an address misses in both L1 and VC, it is fetched from L2 directly into L1. The block displaced from L1 is pushed to the VC. If the VC is full, its LRU block is evicted to L2. Total cycle cost: 18 cycles.
3.  **Write-Back & Dirty Bits**: The simulator supports Write (`W`) operations. A write marks the cache block as `dirty`. This dirty bit travels with the block between L1 and the VC. When a dirty block is finally evicted from the VC to L2, it triggers a "Write-Back". For embedded pipelined architectures, this eviction is silent and incurs no extra penalty cycles.

## 🚀 How to Run

### Prerequisites
*   Node.js (for workload generation)
*   Python 3.x (for simulation engine)

### 1. Generate the Trace File
Navigate to the workload generator directory and run the script. This will output a `trace.txt` file in the `simulator/` directory.

```bash
cd simulator/workload_generator
node generate_trace.js
```

### 2. Run the Hardware Simulator
Navigate to the hardware engine directory and run the simulator against the generated trace.

```bash
cd simulator/hardware_engine
python cache_simulator.py
```
*Optional: You can append `--test` to the command to run a small inline micro-trace before the main simulation to verify the exact logic flow and cycle penalties.*

### Output Format
The simulator outputs the calculated memory metrics as a raw JSON string at the end of execution, suitable for parsing by a frontend application:

```json
{
  "total_accesses": 348,
  "read_ops": 331,
  "write_ops": 17,
  "total_clock_cycles": 1878,
  "l1_hits": 258,
  "l1_hit_rate": 0.7414,
  "victim_cache_hits": 0,
  "victim_cache_hit_rate": 0.0,
  "l2_fetches": 90,
  "l2_hit_rate": 0.2586,
  "total_writebacks": 0,
  "amat": 5.4
}
```

## 🔍 Architectural Insight: The Victim Cache Flush
You might notice that `victim_cache_hits` is **0** when running the default workload trace. **This is architecturally accurate!**

The sensor polling burst generates sequential reads from `0xA000` to `0xA500` (80 unique memory blocks). Since the Victim Cache only holds **4 blocks**, this massive 80-block burst completely flushes the VC 20 times over. When the CPU attempts to re-execute instructions at `0x1000`, the original instruction blocks have long been evicted to L2, resulting in an L2 fetch rather than a Victim Cache rescue. 

This correctly demonstrates a real-world edge case: Victim Caches are highly effective at mitigating small conflict loops, but are entirely bypassed by massive sequential bursts (thrashing).
