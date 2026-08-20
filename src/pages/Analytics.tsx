import React, { useEffect } from 'react';
import {
  BarChart3,
  Award,
  CheckCircle2,
  Clock,
  TrendingUp,
  Brain,
  Timer,
} from 'lucide-react';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useAppStore } from '../stores/appStore';
import { MetricCard } from '../components/analytics/MetricCard';
import { Heatmap } from '../components/analytics/Heatmap';
import { RetentionChart } from '../components/analytics/RetentionChart';
import { WeakCardsList } from '../components/analytics/WeakCardsList';
import { t } from '../i18n';

export const Analytics: React.FC = () => {
  const { language } = useAppStore();
  const {
    overallStats,
    heatmap,
    reviewsChart,
    retentionChart,
    weakCards,
    fetchAnalyticsPageData,
  } = useAnalyticsStore();

  useEffect(() => {
    fetchAnalyticsPageData();
  }, []);

  const avgSpeedSecs = overallStats
    ? (overallStats.average_response_time_ms / 1000).toFixed(1)
    : '0';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {t('analyticsOverview', language)}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Deep learning science insights, memory stability trends, and recall diagnostics
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title={t('totalCardsLearned', language)}
          value={overallStats?.cards_learned ?? 0}
          subtext={`of ${overallStats?.total_cards ?? 0} total`}
          icon={<Brain className="w-4 h-4" />}
          variant="emerald"
        />
        <MetricCard
          title={t('totalReviews', language)}
          value={overallStats?.total_reviews_all_time ?? 0}
          subtext="All-time recall logs"
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="blue"
        />
        <MetricCard
          title={t('averageSpeed', language)}
          value={`${avgSpeedSecs}s`}
          subtext="Per card recall"
          icon={<Clock className="w-4 h-4" />}
          variant="purple"
        />
        <MetricCard
          title={t('retention', language)}
          value={`${overallStats?.overall_retention_rate ?? 100}%`}
          subtext="Average accuracy"
          icon={<TrendingUp className="w-4 h-4" />}
          variant="emerald"
        />
        <MetricCard
          title="Pomodoros Done"
          value={overallStats?.pomodoro_sessions_completed ?? 0}
          subtext="Completed focus blocks"
          icon={<Timer className="w-4 h-4" />}
          variant="red"
        />
        <MetricCard
          title="Total Mastery XP"
          value={overallStats?.total_xp ?? 0}
          subtext="Productivity rank"
          icon={<Award className="w-4 h-4" />}
          variant="amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RetentionChart
          title={t('history30Days', language)}
          data={reviewsChart}
          color="#3b82f6"
          unit=" reviews"
        />
        <RetentionChart
          title={t('retentionTrend', language)}
          data={retentionChart}
          color="#10b981"
          unit="%"
        />
      </div>

      {/* Heatmap Activity */}
      <Heatmap days={heatmap} />

      {/* Diagnostic Weak Areas */}
      <WeakCardsList cards={weakCards} />
    </div>
  );
};
