import React from 'react';
import { ChartDataPoint } from '../../types/analytics';

interface RetentionChartProps {
  title: string;
  data: ChartDataPoint[];
  color?: string;
  unit?: string;
}

export const RetentionChart: React.FC<RetentionChartProps> = ({
  title,
  data,
  color = '#10b981',
  unit = '',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl text-center text-xs text-slate-400">
        No historical review activity logged yet.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 10);
  const height = 140;
  const width = 500;
  const padding = 20;

  // Build SVG polyline points
  const points = data
    .map((d, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - (d.value / maxValue) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <span className="text-xs font-mono text-slate-400">
          Latest: {data[data.length - 1]?.value}
          {unit}
        </span>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 overflow-visible"
        >
          {/* Baseline */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeDasharray="4 4"
          />

          {/* Area fill */}
          <polygon
            points={`${padding},${height - padding} ${points} ${
              width - padding
            },${height - padding}`}
            fill={color}
            fillOpacity="0.1"
          />

          {/* Trend line */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Data points */}
          {data.map((d, i) => {
            const x =
              padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
            const y =
              height - padding - (d.value / maxValue) * (height - 2 * padding);
            return (
              <circle
                key={d.date}
                cx={x}
                cy={y}
                r="3"
                fill={color}
                className="hover:r-5 transition-all"
              />
            );
          })}
        </svg>
      </div>

      <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-2">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
};
