import React, { useState } from 'react';
import { HourlyReading } from '../types/hydrowatch';
import { Info, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

interface FlowChart24hProps {
  readings: HourlyReading[];
  baseline: number;
  thresholdPercent: number;
  currentFlow: number;
  unit?: string;
}

export const FlowChart24h: React.FC<FlowChart24hProps> = ({
  readings,
  baseline,
  thresholdPercent,
  currentFlow,
  unit = 'L/h',
}) => {
  const [hoveredReading, setHoveredReading] = useState<HourlyReading | null>(null);

  // Determine chart dimensions
  const width = 800;
  const height = 280;
  const padding = { top: 30, right: 30, bottom: 45, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const thresholdFlow = baseline > 0 ? baseline * (1 + thresholdPercent / 100) : 0;
  const maxFlow = Math.max(
    thresholdFlow * 1.35,
    ...readings.map((r) => r.flowRate),
    currentFlow * 1.25,
    30
  );
  const minFlow = 0;

  const getX = (index: number) => padding.left + (index / (readings.length - 1)) * graphWidth;
  const getY = (val: number) => padding.top + graphHeight - ((val - minFlow) / (maxFlow - minFlow)) * graphHeight;

  // Baseline and Threshold Y coordinates
  const baselineY = getY(baseline);
  const thresholdY = getY(thresholdFlow);

  // Generate SVG path points
  const points = readings.map((r, i) => `${getX(i)},${getY(r.flowRate)}`).join(' ');
  const areaPath = `${points} ${getX(readings.length - 1)},${padding.top + graphHeight} ${getX(0)},${padding.top + graphHeight}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 text-base">24-Hour Water Flow Telemetry</h3>
            <span className="text-xs bg-cyan-50 text-cyan-700 font-medium px-2 py-0.5 rounded-md border border-cyan-200">
              Meter Series Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hourly consumption with night baseline ({baseline} {unit}) and anomaly threshold (+{thresholdPercent}% = {thresholdFlow.toFixed(1)} {unit})
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 inline-block rounded-full"></span>
            <span>Observed Flow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-cyan-500 inline-block"></span>
            <span>Baseline ({baseline} {unit})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-amber-500 inline-block"></span>
            <span>Threshold (+{thresholdPercent}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block ring-2 ring-rose-200"></span>
            <span>Anomaly / Leak</span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[650px] overflow-visible select-none"
        >
          <defs>
            {/* Gradient for area under curve */}
            <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="80%" stopColor="#0284c7" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>

            {/* Threshold Anomaly Zone Gradient */}
            <linearGradient id="anomalyZone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Anomaly warning zone (above threshold line) */}
          {baseline > 0 && thresholdY > padding.top && (
            <rect
              x={padding.left}
              y={padding.top}
              width={graphWidth}
              height={Math.max(0, thresholdY - padding.top)}
              fill="url(#anomalyZone)"
              className="pointer-events-none"
            />
          )}

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = minFlow + ratio * (maxFlow - minFlow);
            const y = padding.top + graphHeight - ratio * graphHeight;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {Math.round(val)} {unit}
                </text>
              </g>
            );
          })}

          {/* Baseline Reference Line */}
          {baseline > 0 && (
            <g>
              <line
                x1={padding.left}
                y1={baselineY}
                x2={width - padding.right}
                y2={baselineY}
                stroke="#0891b2"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={width - padding.right - 4}
                y={baselineY - 5}
                textAnchor="end"
                className="text-[10px] font-semibold fill-cyan-700 font-mono"
              >
                Baseline: {baseline} {unit}
              </text>
            </g>
          )}

          {/* Threshold Reference Line */}
          {baseline > 0 && (
            <g>
              <line
                x1={padding.left}
                y1={thresholdY}
                x2={width - padding.right}
                y2={thresholdY}
                stroke="#d97706"
                strokeWidth="1.75"
                strokeDasharray="5 3"
              />
              <text
                x={width - padding.right - 4}
                y={thresholdY - 5}
                textAnchor="end"
                className="text-[10px] font-bold fill-amber-700 font-mono"
              >
                Threshold (+{thresholdPercent}%): {thresholdFlow.toFixed(1)} {unit}
              </text>
            </g>
          )}

          {/* Area under curve */}
          <polygon points={areaPath} fill="url(#flowGradient)" />

          {/* Observed Flow Line */}
          <polyline
            points={points}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {readings.map((r, i) => {
            const cx = getX(i);
            const cy = getY(r.flowRate);
            const isHovered = hoveredReading?.hour === r.hour;
            const isAboveThreshold = baseline > 0 && r.flowRate > thresholdFlow;

            return (
              <g
                key={r.hour}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredReading(r)}
                onMouseLeave={() => setHoveredReading(null)}
              >
                {/* Historical peak marker */}
                {r.isPeak && (
                  <g>
                    <line
                      x1={cx}
                      y1={cy - 6}
                      x2={cx}
                      y2={cy - 20}
                      stroke="#64748b"
                      strokeWidth="1"
                    />
                    <text
                      x={cx}
                      y={cy - 22}
                      textAnchor="middle"
                      className="text-[9px] fill-slate-500 font-medium"
                    >
                      Peak
                    </text>
                  </g>
                )}

                {/* Current reading pulse ring */}
                {r.isCurrent && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 11 : 8}
                    fill={isAboveThreshold ? '#fecdd3' : '#bae6fd'}
                    className="animate-ping opacity-75"
                  />
                )}

                {/* Point dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r.isCurrent ? 6 : isHovered ? 5.5 : r.isAnomaly ? 4.5 : 3}
                  fill={
                    r.isCurrent
                      ? isAboveThreshold ? '#e11d48' : '#0284c7'
                      : isAboveThreshold
                      ? '#ef4444'
                      : r.isPeak
                      ? '#475569'
                      : '#ffffff'
                  }
                  stroke={
                    r.isCurrent
                      ? '#ffffff'
                      : isAboveThreshold
                      ? '#b91c1c'
                      : r.isPeak
                      ? '#334155'
                      : '#0284c7'
                  }
                  strokeWidth={r.isCurrent ? 2.5 : 1.75}
                />

                {/* Current hour label badge */}
                {r.isCurrent && (
                  <g>
                    <rect
                      x={cx - 26}
                      y={cy + 8}
                      width="52"
                      height="17"
                      rx="4"
                      fill="#0f172a"
                    />
                    <text
                      x={cx}
                      y={cy + 20}
                      textAnchor="middle"
                      className="text-[9px] font-bold fill-white font-mono"
                    >
                      NOW ({r.flowRate} {unit})
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* X Axis Time Labels */}
          {readings.map((r, i) => {
            // Show every 2 hours or 3 hours
            if (i % 3 !== 0 && i !== readings.length - 1) return null;
            const cx = getX(i);
            return (
              <text
                key={r.hour}
                x={cx}
                y={padding.top + graphHeight + 20}
                textAnchor="middle"
                className="text-[10px] fill-slate-400 font-mono"
              >
                {r.timeLabel}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredReading && (
          <div
            className="absolute top-3 left-16 z-20 bg-slate-900 text-white rounded-lg px-3.5 py-2.5 shadow-xl text-xs border border-slate-700 pointer-events-none transition-all"
            style={{
              transform: `translate(${Math.min(
                Math.max(10, getX(hoveredReading.hour) - 90),
                width - 240
              )}px, 10px)`,
            }}
          >
            <div className="flex items-center justify-between gap-3 font-semibold pb-1 mb-1 border-b border-slate-700">
              <span className="font-mono text-cyan-300">Hour {hoveredReading.timeLabel}</span>
              {hoveredReading.isCurrent ? (
                <span className="text-[10px] bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded">
                  Current Reading
                </span>
              ) : hoveredReading.isPeak ? (
                <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                  Historical Peak
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <span className="text-slate-400">Observed Flow:</span>
              <span className="font-mono font-medium text-white">{hoveredReading.flowRate} {unit}</span>

              <span className="text-slate-400">Night Baseline:</span>
              <span className="font-mono text-slate-300">{baseline} {unit}</span>

              <span className="text-slate-400">Deviation:</span>
              <span className="font-mono font-medium">
                {baseline > 0 ? (
                  hoveredReading.flowRate > baseline ? (
                    <span className={hoveredReading.flowRate > thresholdFlow ? 'text-rose-400' : 'text-amber-300'}>
                      +{(((hoveredReading.flowRate - baseline) / baseline) * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-emerald-400">
                      {(((hoveredReading.flowRate - baseline) / baseline) * 100).toFixed(1)}%
                    </span>
                  )
                ) : (
                  'N/A'
                )}
              </span>

              <span className="text-slate-400">Classification:</span>
              <span>
                {baseline <= 0 ? (
                  <span className="text-slate-400">Insufficient Baseline</span>
                ) : hoveredReading.flowRate > thresholdFlow ? (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 inline" /> Exceeds Threshold
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 inline" /> Within Threshold
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chart Footer Highlights */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400" />
          <span>
            Nighttime baseline is monitored during low-usage hours (01:00 - 05:00) to isolate continuous background pipe loss.
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-slate-600">
          <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
          <span>Evaluation Rule: Anomaly if (Flow - Baseline) / Baseline &gt; +{thresholdPercent}%</span>
        </div>
      </div>
    </div>
  );
};
