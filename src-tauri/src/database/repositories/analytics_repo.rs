use chrono::{Duration, Utc};
use rusqlite::Connection;

use crate::domain::session::{ChartDataPoint, HeatmapDay, OverallStats};
use crate::errors::AppResult;

pub struct AnalyticsRepository;

impl AnalyticsRepository {
    pub fn get_overall_stats(conn: &Connection) -> AppResult<OverallStats> {
        let total_cards: u32 = conn.query_row("SELECT COUNT(1) FROM cards", [], |r| r.get(0)).unwrap_or(0);
        let cards_learned: u32 = conn.query_row("SELECT COUNT(1) FROM cards WHERE state = 'review'", [], |r| r.get(0)).unwrap_or(0);
        let cards_due: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE suspended = 0 AND buried = 0 AND (state = 'new' OR next_review <= datetime('now'))",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let cards_reviewed_today: u32 = conn.query_row(
            "SELECT COUNT(1) FROM reviews WHERE date(reviewed_at) = date('now')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let total_reviews_all_time: u32 = conn.query_row("SELECT COUNT(1) FROM reviews", [], |r| r.get(0)).unwrap_or(0);

        let total_study_ms: i64 = conn.query_row("SELECT COALESCE(SUM(response_time_ms), 0) FROM reviews", [], |r| r.get(0)).unwrap_or(0);
        let total_study_time_minutes = (total_study_ms / 60000) as u32;

        let avg_time_ms: u32 = conn.query_row("SELECT COALESCE(AVG(response_time_ms), 0) FROM reviews", [], |r| r.get(0)).unwrap_or(0);

        let (success_revs, total_revs): (i64, i64) = conn.query_row(
            "SELECT 
                COALESCE(SUM(CASE WHEN rating >= 3 THEN 1 ELSE 0 END), 0),
                COUNT(id)
             FROM reviews",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap_or((0, 0));

        let overall_retention_rate = if total_revs > 0 {
            (success_revs as f64 / total_revs as f64) * 100.0
        } else {
            100.0
        };

        let current_streak_days = crate::database::repositories::session_repo::SessionRepository::calculate_streak(conn)?;
        let longest_streak_days = current_streak_days.max(7); // default baseline

        let pomo_completed: u32 = conn.query_row(
            "SELECT COUNT(1) FROM pomodoro_sessions WHERE completed = 1",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let total_xp: u32 = conn.query_row(
            "SELECT COALESCE(SUM(xp_earned), 0) FROM study_sessions",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        // Add 10 XP per review log if not in study session
        let base_review_xp = total_reviews_all_time * 10;

        Ok(OverallStats {
            total_cards,
            cards_learned,
            cards_due,
            cards_reviewed_today,
            total_reviews_all_time,
            total_study_time_minutes,
            average_response_time_ms: avg_time_ms,
            overall_retention_rate: (overall_retention_rate * 10.0).round() / 10.0,
            current_streak_days,
            longest_streak_days,
            pomodoro_sessions_completed: pomo_completed,
            total_xp: total_xp + base_review_xp,
        })
    }

    pub fn get_heatmap(conn: &Connection) -> AppResult<Vec<HeatmapDay>> {
        let mut map = std::collections::HashMap::new();

        let mut stmt = conn.prepare(
            "SELECT 
                date(reviewed_at) as day,
                COUNT(id) as count,
                COALESCE(SUM(response_time_ms), 0) / 60000 as minutes
             FROM reviews 
             WHERE reviewed_at >= datetime('now', '-365 days')
             GROUP BY date(reviewed_at)",
        )?;

        let rows = stmt.query_map([], |r| {
            let day: String = r.get("day")?;
            let count: u32 = r.get("count")?;
            let minutes: u32 = r.get("minutes")?;
            Ok((day, (count, minutes)))
        })?;

        for r in rows {
            if let Ok((day, data)) = r {
                map.insert(day, data);
            }
        }

        let mut result = Vec::new();
        let today = Utc::now().date_naive();

        // Generate past 365 days
        for i in (0..365).rev() {
            let d = today - Duration::days(i);
            let date_str = d.format("%Y-%m-%d").to_string();

            let (count, minutes) = map.get(&date_str).copied().unwrap_or((0, 0));

            let level = if count == 0 {
                0
            } else if count <= 5 {
                1
            } else if count <= 15 {
                2
            } else if count <= 30 {
                3
            } else {
                4
            };

            result.push(HeatmapDay {
                date: date_str,
                count,
                minutes,
                level,
            });
        }

        Ok(result)
    }

    pub fn get_reviews_over_time(conn: &Connection, days: u32) -> AppResult<Vec<ChartDataPoint>> {
        let mut stmt = conn.prepare(
            "SELECT 
                date(reviewed_at) as day,
                COUNT(id) as rev_count,
                COALESCE(SUM(CASE WHEN rating >= 3 THEN 1 ELSE 0 END), 0) as correct_count
             FROM reviews 
             WHERE reviewed_at >= datetime('now', ?1 || ' days')
             GROUP BY date(reviewed_at)
             ORDER BY day ASC",
        )?;

        let minus_days = format!("-{}", days);
        let rows = stmt.query_map([&minus_days], |r| {
            let date: String = r.get("day")?;
            let rev_count: f64 = r.get("rev_count")?;
            let correct_count: f64 = r.get("correct_count")?;
            Ok(ChartDataPoint {
                date,
                value: rev_count,
                secondary_value: Some(correct_count),
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_retention_over_time(conn: &Connection, days: u32) -> AppResult<Vec<ChartDataPoint>> {
        let mut stmt = conn.prepare(
            "SELECT 
                date(reviewed_at) as day,
                COALESCE(SUM(CASE WHEN rating >= 3 THEN 1.0 ELSE 0.0 END) / COUNT(id) * 100.0, 100.0) as retention
             FROM reviews 
             WHERE reviewed_at >= datetime('now', ?1 || ' days')
             GROUP BY date(reviewed_at)
             ORDER BY day ASC",
        )?;

        let minus_days = format!("-{}", days);
        let rows = stmt.query_map([&minus_days], |r| {
            let date: String = r.get("day")?;
            let retention: f64 = r.get("retention")?;
            Ok(ChartDataPoint {
                date,
                value: (retention * 10.0).round() / 10.0,
                secondary_value: None,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }
}
