import { create } from 'zustand';
import { api } from '../services/api';
import {
  ChartDataPoint,
  DailyStudyPlan,
  HeatmapDay,
  OverallStats,
  WeakCardInfo,
} from '../types/analytics';

interface AnalyticsState {
  overallStats: OverallStats | null;
  dailyPlan: DailyStudyPlan | null;
  heatmap: HeatmapDay[];
  reviewsChart: ChartDataPoint[];
  retentionChart: ChartDataPoint[];
  weakCards: WeakCardInfo[];
  isLoading: boolean;

  fetchDashboardData: () => Promise<void>;
  fetchAnalyticsPageData: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  overallStats: null,
  dailyPlan: null,
  heatmap: [],
  reviewsChart: [],
  retentionChart: [],
  weakCards: [],
  isLoading: false,

  fetchDashboardData: async () => {
    try {
      const [plan, stats, heatmap, weak] = await Promise.all([
        api.getDailyStudyPlan(),
        api.getOverallStats(),
        api.getHeatmap(),
        api.getWeakCards(5),
      ]);
      set({
        dailyPlan: plan,
        overallStats: stats,
        heatmap,
        weakCards: weak,
      });
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    }
  },

  fetchAnalyticsPageData: async () => {
    set({ isLoading: true });
    try {
      const [stats, heatmap, revChart, retChart, weak] = await Promise.all([
        api.getOverallStats(),
        api.getHeatmap(),
        api.getReviewHistoryChart(30),
        api.getRetentionTrendChart(30),
        api.getWeakCards(20),
      ]);
      set({
        overallStats: stats,
        heatmap,
        reviewsChart: revChart,
        retentionChart: retChart,
        weakCards: weak,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      set({ isLoading: false });
    }
  },
}));
