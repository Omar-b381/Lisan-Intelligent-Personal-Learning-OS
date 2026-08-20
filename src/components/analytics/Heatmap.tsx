import React, { useState } from 'react';
import { HeatmapDay } from '../../types/analytics';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';

interface HeatmapProps {
  days: HeatmapDay[];
}

export const Heatmap: React.FC<HeatmapProps> = ({ days }) => {
  const { language } = useAppStore();
  const [metric, setMetric] = useState<'cards' | 'minutes'>('cards');
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  // Group 365 days into columns of 7 days (weeks)
  const weeks: HeatmapDay[][] = [];
  let currentWeek: HeatmapDay[] = [];

  days.forEach((day, idx) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || idx === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const getColorClass = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-emerald-200 dark:bg-emerald-900/60 border-emerald-300 dark:border-emerald-800/40';
      case 2:
        return 'bg-emerald-400 dark:bg-emerald-700 border-emerald-500 dark:border-emerald-600/40';
      case 3:
        return 'bg-emerald-500 dark:bg-emerald-500 border-emerald-600 dark:border-emerald-400/40';
      case 4:
        return 'bg-emerald-600 dark:bg-emerald-400 border-emerald-700 dark:border-emerald-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/40';
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl">
      {/* Header with Metric Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {t('learningHeatmap', language)}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Consistency history across the last 365 days
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          <button
            onClick={() => setMetric('cards')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
              metric === 'cards'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t('intensityCards', language)}
          </button>
          <button
            onClick={() => setMetric('minutes')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
              metric === 'minutes'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t('intensityMinutes', language)}
          </button>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-1.5 min-w-[720px]">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1.5">
              {week.map((day) => (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`w-3 h-3 rounded-[3px] border transition-all hover:scale-125 cursor-pointer ${getColorClass(
                    day.level
                  )}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend & Hover Info */}
      <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
        <div>
          {hoveredDay ? (
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {hoveredDay.date}:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {metric === 'cards'
                  ? `${hoveredDay.count} cards`
                  : `${hoveredDay.minutes} min`}
              </strong>
            </span>
          ) : (
            <span>Hover over squares for details</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-slate-100 dark:bg-slate-800" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-200 dark:bg-emerald-900" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500 dark:bg-emerald-500" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600 dark:bg-emerald-400" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
