import React, { useEffect } from 'react';
import {
  GraduationCap,
  Timer,
  Flame,
  CheckCircle2,
  Clock,
  TrendingUp,
  FolderTree,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useDeckStore } from '../stores/deckStore';
import { useAppStore } from '../stores/appStore';
import { usePomodoroStore } from '../stores/pomodoroStore';
import { MetricCard } from '../components/analytics/MetricCard';
import { Heatmap } from '../components/analytics/Heatmap';
import { WeakCardsList } from '../components/analytics/WeakCardsList';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { t } from '../i18n';

export const Dashboard: React.FC = () => {
  const { language, startStudyForDeck, setActiveTab } = useAppStore();
  const { dailyPlan, overallStats, heatmap, weakCards, fetchDashboardData } = useAnalyticsStore();
  const { decks, fetchDecks } = useDeckStore();
  const { startTimer } = usePomodoroStore();

  useEffect(() => {
    fetchDashboardData();
    fetchDecks();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greetingMorning', language);
    if (hour < 18) return t('greetingAfternoon', language);
    return t('greetingEvening', language);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 text-white shadow-xl shadow-emerald-950/20">
        <div>
          <div className="flex items-center gap-2 mb-1 opacity-90 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>{getGreeting()}, learner</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {t('todaysPlan', language)}
          </h2>
          <p className="text-emerald-100 text-sm mt-1 max-w-lg leading-relaxed">
            {dailyPlan?.due_reviews_count ?? 0} cards are due for recall today.
            Maintain your {dailyPlan?.current_streak_days ?? 0}-day streak!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant="secondary"
            icon={<GraduationCap className="w-5 h-5 text-emerald-700" />}
            onClick={() => startStudyForDeck(null)}
            className="bg-white hover:bg-emerald-50 text-emerald-900 border-none font-bold shadow-lg"
          >
            {t('startStudySession', language)}
          </Button>

          <Button
            size="lg"
            variant="outline"
            icon={<Timer className="w-5 h-5 text-white" />}
            onClick={() => {
              startTimer();
              setActiveTab('pomodoro');
            }}
            className="border-emerald-400/50 hover:bg-emerald-600 text-white"
          >
            {t('startFocusSession', language)}
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title={t('dueReviews', language)}
          value={dailyPlan?.due_reviews_count ?? 0}
          subtext="Scheduled for today"
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="red"
        />
        <MetricCard
          title={t('newCards', language)}
          value={dailyPlan?.new_cards_count ?? 0}
          subtext="Ready to learn"
          icon={<Sparkles className="w-4 h-4" />}
          variant="blue"
        />
        <MetricCard
          title={t('learningCards', language)}
          value={dailyPlan?.weak_cards_count ?? 0}
          subtext="In active rotation"
          icon={<GraduationCap className="w-4 h-4" />}
          variant="amber"
        />
        <MetricCard
          title={t('studyTime', language)}
          value={`${dailyPlan?.today_study_time_minutes ?? 0}m`}
          subtext="Logged today"
          icon={<Clock className="w-4 h-4" />}
          variant="emerald"
        />
        <MetricCard
          title={t('retention', language)}
          value={`${overallStats?.overall_retention_rate ?? 100}%`}
          subtext="Memory stability"
          icon={<TrendingUp className="w-4 h-4" />}
          variant="purple"
        />
        <MetricCard
          title={t('currentStreak', language)}
          value={`${dailyPlan?.current_streak_days ?? 0}d`}
          subtext="Consistent study"
          icon={<Flame className="w-4 h-4" />}
          variant="amber"
        />
      </div>

      {/* Main Grid: Deck Progress & Weak Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Decks Quick Overview */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('deckProgress', language)}
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('decks')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {decks.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between gap-4 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {d.name}
                    </span>
                    {d.stats.due_cards > 0 && (
                      <Badge variant="danger" size="sm">
                        {d.stats.due_cards} due
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{d.stats.total_cards} cards</span>
                    <span>&bull;</span>
                    <span>{d.stats.retention_rate}% retention</span>
                    <span>&bull;</span>
                    <span>{d.stats.study_time_minutes}m studied</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => startStudyForDeck(d.id)}
                >
                  Study
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Weak Cards List */}
        <div>
          <WeakCardsList cards={weakCards} />
        </div>
      </div>

      {/* Heatmap Activity Section */}
      <Heatmap days={heatmap} />
    </div>
  );
};
