# 🏗️ Power-Aware Cache Architecture Simulator

An interactive, real-time visualization of a memory hierarchy with **L1 direct-mapped cache**, **Victim Cache (fully associative, LRU)**, and **L2/Main Memory** — built for CS361 Computer Architecture.

> **[▶ Live Demo](https://mr-kraken2411.github.io/CS361_Project/)** — No install required, runs entirely in-browser.

---

## ✨ Features

### Core Simulation
- **Step-by-step trace playback** with Play/Pause/Step/Reset controls
- **Adjustable speed** (1×–20×) with smooth real-time updates
- **3 built-in workloads**: Low Traffic (sensor wake), High Traffic (thrashing), Conflict Loop (VC showcase)
- **VC ON/OFF toggle** to see the impact of the Victim Cache in real-time

### Visual Components
| Component | Description |
|---|---|
| **L1 Grid** | 8-slot direct-mapped cache with animated block insertion, tag color pulses on hit |
| **Victim Cache Grid** | 4-entry fully associative cache with LRU ordering, MRU dot indicator |
| **L2 Pool** | Backing store with eviction counters and activity pulse rings |
| **Flow Arrows** | Animated traveling dots and directional labels ("↑ rescued" / "↓ displaced") |
| **Access Log** | Color-coded scrolling event log with per-step AMAT tracking |

### Analytics (Phase 4)
- **📈 AMAT Chart** — Area chart showing average memory access time convergence
- **📊 Hit Rate Chart** — Multi-line chart tracking L1, VC, and L2 hit percentages
- **📉 Hit Distribution** — Stacked bar showing cumulative hit breakdown

### Advanced Features
- **🧊 3D Architecture View** — Interactive React Three Fiber scene with floating cache layers, data particles, and auto-rotation
- **⚖️ Comparison Mode** — Side-by-side VC ON vs OFF analysis with savings calculation
- **📖 Architecture Guide** — Educational reference explaining cache hierarchy, swap mechanics, dirty bits, and AMAT formula

### Animation (Framer Motion)
- Directional slide-in/out for block movements
- Tag color pulses (green=L1 hit, amber=VC hit, red=L2 fetch)
- Spring-animated dirty badges and flow labels
- VC eviction shake effect
- Traveling dot animations along data flow paths

---

## 🏗️ Architecture

```
CPU
 │  1 cycle
 ▼
┌──────────────────────────┐
│  L1 Cache                │  Direct-mapped, 8 blocks × 16B
│  Index = addr >> 4 & 0x7 │  Tag = addr >> 7
└──────────┬───────────────┘
           │  +1 cycle (VC probe)
           ▼
┌──────────────────────────┐
│  Victim Cache            │  Fully associative, 4 entries
│  LRU eviction policy     │  Swap on hit (L1 ↔ VC)
└──────────┬───────────────┘
           │  +15 cycles (L2 fetch)
           ▼
┌──────────────────────────┐
│  L2 / Main Memory        │  Perfect (infinite capacity)
│  Write-back on eviction  │
└──────────────────────────┘
```

### Access Costs
| Scenario | Path | Total Cycles |
|---|---|---|
| **L1 Hit** | CPU → L1 ✓ | **1 cycle** |
| **VC Hit** | CPU → L1 ✗ → VC ✓ → swap | **2 cycles** |
| **L2 Fetch** | CPU → L1 ✗ → VC ✗ → L2 | **17 cycles** |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** (for frontend)
- **Python 3.x** (for original backend simulator, optional)

### Run the Frontend (Interactive Visualizer)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run the Original Backend Simulator

```bash
# Generate trace
cd simulator/workload_generator
node generate_trace.js

# Run simulator
cd ../hardware_engine
python cache_simulator.py
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 + Vite 8 |
| **Animation** | Framer Motion 12 |
| **3D Rendering** | React Three Fiber + Drei |
| **Charts** | Recharts 3 |
| **Styling** | Vanilla CSS (glassmorphism design system) |
| **Simulation** | Pure JavaScript (ported from Python) |
| **Deployment** | GitHub Pages (via GitHub Actions) |

---

## 📁 Project Structure

```
CS361_Project/
├── .github/workflows/deploy.yml     # GitHub Pages CI/CD
├── README.md
├── simulator/                        # Original Python engine
│   ├── hardware_engine/
│   └── workload_generator/
└── frontend/                         # React + Vite app
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx                   # Root layout + state management
        ├── App.css
        ├── index.css                 # Design tokens + global styles
        ├── engine/
        │   ├── cacheEngine.js        # Step-able cache simulator
        │   └── traceData.js          # Embedded workload traces
        ├── components/
        │   ├── L1Grid.jsx            # L1 cache grid (animated)
        │   ├── VCGrid.jsx            # Victim cache grid (animated)
        │   ├── L2Pool.jsx            # L2 backing store
        │   ├── FlowArrow.jsx         # Data flow indicators
        │   ├── AccessLog.jsx         # Scrolling event log
        │   ├── MetricsCharts.jsx     # Recharts integration
        │   ├── HeroScene.jsx         # 3D R3F architecture view
        │   ├── CompareMode.jsx       # Side-by-side VC comparison
        │   └── ArchitectureGuide.jsx # Educational reference panel
        └── styles/
            ├── simulation.css
            ├── charts.css
            ├── hero.css
            ├── compare.css
            └── architecture.css
```

---

## 📊 Sample Results (Conflict Loop Workload)

| Metric | VC ON | VC OFF |
|---|---|---|
| **Total Accesses** | 80 | 80 |
| **L1 Hits** | 60 (75%) | 60 (75%) |
| **VC Hits** | 18 (22.5%) | 0 (0%) |
| **L2 Fetches** | 2 | 20 |
| **Total Cycles** | 148 | 380 |
| **AMAT** | **1.85 cyc** | **4.75 cyc** |
| **Cycle Savings** | — | **232 cycles (61.1% reduction)** |

---

## 📜 License

This project was developed for CS361 — Computer Architecture at the University.
