use crate::database::connection::Database;
use crate::database::repositories::AnalyticsRepository;
use crate::domain::session::{ChartDataPoint, HeatmapDay, OverallStats};
use crate::errors::AppResult;

pub struct AnalyticsService {
    db: Database,
}

impl AnalyticsService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn get_overall_stats(&self) -> AppResult<OverallStats> {
        let conn = self.db.get_connection();
        AnalyticsRepository::get_overall_stats(&conn)
    }

    pub fn get_heatmap(&self) -> AppResult<Vec<HeatmapDay>> {
        let conn = self.db.get_connection();
        AnalyticsRepository::get_heatmap(&conn)
    }

    pub fn get_review_history_chart(&self, days: Option<u32>) -> AppResult<Vec<ChartDataPoint>> {
        let conn = self.db.get_connection();
        AnalyticsRepository::get_reviews_over_time(&conn, days.unwrap_or(30))
    }

    pub fn get_retention_trend_chart(&self, days: Option<u32>) -> AppResult<Vec<ChartDataPoint>> {
        let conn = self.db.get_connection();
        AnalyticsRepository::get_retention_over_time(&conn, days.unwrap_or(30))
    }
}
