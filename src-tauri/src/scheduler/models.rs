use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FSRSParameters {
    pub w: [f64; 17],
    pub request_retention: f64,
    pub maximum_interval: f64,
}

impl Default for FSRSParameters {
    fn default() -> Self {
        Self {
            // Default 17 FSRS-4.5 weights
            w: [
                0.40255, // w0: initial stability for Again
                1.18385, // w1: initial stability for Hard
                3.173,   // w2: initial stability for Good
                15.69105,// w3: initial stability for Easy
                7.1949,  // w4: initial difficulty base
                0.5345,  // w5: initial difficulty factor
                1.4604,  // w6: difficulty delta
                0.0046,  // w7: mean reversion weight
                1.54575, // w8: recall stability factor
                0.1192,  // w9: recall stability power
                1.01925, // w10: recall stability retrievability factor
                1.9395,  // w11: lapse stability factor
                0.11,    // w12: lapse difficulty power
                0.29605, // w13: lapse stability power
                0.22695, // w14: lapse retrievability factor
                0.2315,  // w15: hard penalty
                2.9898,  // w16: easy bonus
            ],
            request_retention: 0.90,
            maximum_interval: 36500.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FSRSCardMemory {
    pub stability: f64,
    pub difficulty: f64,
    pub reps: u32,
    pub lapses: u32,
    pub elapsed_days: f64,
    pub scheduled_days: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FSRSReviewCalculation {
    pub next_stability: f64,
    pub next_difficulty: f64,
    pub next_interval_days: f64,
    pub interval_description: String,
}
