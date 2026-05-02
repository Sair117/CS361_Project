import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import '../styles/charts.css';

// =============================================================================
// MetricsCharts — Real-time charts powered by recharts
// =============================================================================

const COLORS = {
  l1Hit: '#4ade80',
  vcHit: '#facc15',
  l2Fetch: '#f87171',
  amat: '#a78bfa',
  cycles: '#6c63ff',
  grid: 'rgba(255,255,255,0.04)',
  text: '#475569',
};

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label mono">Step {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: p.color }} />
          <span className="chart-tooltip__name">{p.name}</span>
          <span className="chart-tooltip__value mono">{typeof p.value === 'number' ? p.value.toFixed?.(2) ?? p.value : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function MetricsCharts({ history }) {
  // Compute chart data from history
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    return history.map((h) => {
      const total = h.totalAccesses || 1;
      return {
        step: h.step + 1,
        l1Rate: ((h.l1Hits / total) * 100),
        vcRate: ((h.vcHits / total) * 100),
        l2Rate: ((h.l2Fetches / total) * 100),
        amat: h.totalClockCycles / total,
        cycles: h.totalClockCycles,
        l1Hits: h.l1Hits,
        vcHits: h.vcHits,
        l2Fetches: h.l2Fetches,
      };
    });
  }, [history]);

  if (chartData.length === 0) {
    return (
      <div className="charts-panel">
        <div className="placeholder">
          <span className="placeholder__icon">📈</span>
          <span>Charts populate as you step through the trace</span>
        </div>
      </div>
    );
  }

  return (
    <div className="charts-panel">
      {/* ─── AMAT Over Time ─────────────────────────────────────────── */}
      <div className="chart-card">
        <div className="chart-card__header">
          <span className="chart-card__title">AMAT (cycles)</span>
          <span className="chart-card__value mono" style={{ color: COLORS.amat }}>
            {chartData[chartData.length - 1]?.amat.toFixed(2)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="amatGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.amat} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.amat} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="step" tick={false} axisLine={false} />
            <YAxis
              tick={{ fill: COLORS.text, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="amat"
              name="AMAT"
              stroke={COLORS.amat}
              strokeWidth={2}
              fill="url(#amatGrad)"
              dot={false}
              animationDuration={200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Hit Rates ──────────────────────────────────────────────── */}
      <div className="chart-card">
        <div className="chart-card__header">
          <span className="chart-card__title">Hit Rates (%)</span>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="step" tick={false} axisLine={false} />
            <YAxis
              tick={{ fill: COLORS.text, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="l1Rate"
              name="L1 Hit %"
              stroke={COLORS.l1Hit}
              strokeWidth={2}
              dot={false}
              animationDuration={200}
            />
            <Line
              type="monotone"
              dataKey="vcRate"
              name="VC Hit %"
              stroke={COLORS.vcHit}
              strokeWidth={2}
              dot={false}
              animationDuration={200}
            />
            <Line
              type="monotone"
              dataKey="l2Rate"
              name="L2 Fetch %"
              stroke={COLORS.l2Fetch}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              animationDuration={200}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Mini legend */}
        <div className="chart-legend">
          <span className="chart-legend__item">
            <span className="chart-legend__dot" style={{ background: COLORS.l1Hit }} />L1
          </span>
          <span className="chart-legend__item">
            <span className="chart-legend__dot" style={{ background: COLORS.vcHit }} />VC
          </span>
          <span className="chart-legend__item">
            <span className="chart-legend__dot" style={{ background: COLORS.l2Fetch }} />L2
          </span>
        </div>
      </div>

      {/* ─── Cumulative Hits Stacked ────────────────────────────────── */}
      <div className="chart-card">
        <div className="chart-card__header">
          <span className="chart-card__title">Hit Distribution</span>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={[chartData[chartData.length - 1]]} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} layout="vertical">
            <XAxis type="number" tick={{ fill: COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="step" tick={false} axisLine={false} width={1} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="l1Hits" name="L1 Hits" fill={COLORS.l1Hit} stackId="a" radius={[0, 0, 0, 0]} animationDuration={200} />
            <Bar dataKey="vcHits" name="VC Hits" fill={COLORS.vcHit} stackId="a" animationDuration={200} />
            <Bar dataKey="l2Fetches" name="L2 Fetches" fill={COLORS.l2Fetch} stackId="a" radius={[0, 4, 4, 0]} animationDuration={200} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
