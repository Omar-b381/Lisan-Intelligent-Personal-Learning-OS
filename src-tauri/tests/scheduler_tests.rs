use lisan_lib::domain::card::{Card, CardState, CardType, Rating};
use lisan_lib::scheduler::fsrs::FSRSScheduler;
use lisan_lib::scheduler::prioritizer::CardPrioritizer;
use chrono::{Duration, Utc};

fn make_test_card() -> Card {
    let now = Utc::now();
    Card {
        id: "test-card-100".to_string(),
        deck_id: "deck-100".to_string(),
        card_type: CardType::Basic,
        front: "What is FSRS?".to_string(),
        back: "Free Spaced Repetition Scheduler".to_string(),
        notes: Some("Modern memory algorithm".to_string()),
        state: CardState::New,
        stability: 0.0,
        difficulty: 0.0,
        reps: 0,
        lapses: 0,
        review_count: 0,
        last_review: None,
        next_review: None,
        interval_days: 0.0,
        ease_factor: 2.5,
        suspended: false,
        buried: false,
        tags: vec!["learning".to_string()],
        created_at: now,
        updated_at: now,
    }
}

#[test]
fn test_fsrs_initial_grading() {
    let scheduler = FSRSScheduler::default();
    let mut card = make_test_card();
    let now = Utc::now();

    // Grade Good on first review
    let outcome = scheduler.apply_review(&mut card, Rating::Good, now);
    assert_eq!(card.state, CardState::Review);
    assert_eq!(card.reps, 1);
    assert_eq!(card.review_count, 1);
    assert!(card.stability > 0.0);
    assert!(card.difficulty >= 1.0 && card.difficulty <= 10.0);
    assert!(outcome.next_interval_days >= 1.0);
    println!("FSRS Good Initial Interval: {} days", outcome.next_interval_days);
}

#[test]
fn test_fsrs_lapse_and_recovery() {
    let scheduler = FSRSScheduler::default();
    let mut card = make_test_card();
    let now = Utc::now();

    // Grade Easy initially
    scheduler.apply_review(&mut card, Rating::Easy, now);
    assert_eq!(card.state, CardState::Review);
    let initial_stab = card.stability;

    // Fail card 10 days later
    let later = now + Duration::days(10);
    scheduler.apply_review(&mut card, Rating::Again, later);
    assert_eq!(card.state, CardState::Relearning);
    assert_eq!(card.lapses, 1);
    assert_eq!(card.reps, 0);
    assert!(card.stability <= initial_stab);
    println!("FSRS Lapse updated stability to: {}", card.stability);
}

#[test]
fn test_prioritizer_sorting() {
    let scheduler = FSRSScheduler::default();
    let prioritizer = CardPrioritizer::new(&scheduler);
    let now = Utc::now();

    let new_card = make_test_card();
    let mut learning_card = make_test_card();
    learning_card.state = CardState::Learning;
    let mut lapsed_card = make_test_card();
    lapsed_card.state = CardState::Relearning;
    lapsed_card.lapses = 3;

    let score_new = prioritizer.calculate_priority_score(&new_card, now, 0);
    let score_learning = prioritizer.calculate_priority_score(&learning_card, now, 0);
    let score_lapsed = prioritizer.calculate_priority_score(&lapsed_card, now, 0);

    assert!(score_lapsed > score_learning);
    assert!(score_learning > score_new);
    println!("Priority Scores -> Lapsed: {}, Learning: {}, New: {}", score_lapsed, score_learning, score_new);
}
