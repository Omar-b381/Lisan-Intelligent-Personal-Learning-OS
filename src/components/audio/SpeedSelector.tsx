import React from 'react';

interface SpeedSelectorProps {
  speed: number;
  onChange: (speed: number) => void;
  className?: string;
}

export const SpeedSelector: React.FC<SpeedSelectorProps> = ({
  speed,
  onChange,
  className = '',
}) => {
  const speeds = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5];

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {speeds.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            Math.abs(speed - s) < 0.01
              ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {s}x
        </button>
      ))}
    </div>
  );
};
