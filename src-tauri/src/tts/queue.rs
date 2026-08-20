use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};

use super::models::BulkGenerationProgress;

#[derive(Clone)]
pub struct BulkQueueManager {
    tasks: Arc<RwLock<HashMap<String, BulkGenerationProgress>>>,
    cancellations: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
}

impl BulkQueueManager {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(RwLock::new(HashMap::new())),
            cancellations: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn register_task(&self, task_id: &str, deck_id: &str, total_cards: usize) -> Arc<AtomicBool> {
        let cancel_flag = Arc::new(AtomicBool::new(false));
        
        let progress = BulkGenerationProgress {
            task_id: task_id.to_string(),
            deck_id: deck_id.to_string(),
            total_cards,
            processed_cards: 0,
            current_word: String::new(),
            status: "running".to_string(),
            error: None,
        };

        if let Ok(mut tasks) = self.tasks.write() {
            tasks.insert(task_id.to_string(), progress);
        }

        if let Ok(mut cancels) = self.cancellations.write() {
            cancels.insert(task_id.to_string(), cancel_flag.clone());
        }

        cancel_flag
    }

    pub fn update_progress(&self, task_id: &str, processed: usize, current_word: &str) {
        if let Ok(mut tasks) = self.tasks.write() {
            if let Some(task) = tasks.get_mut(task_id) {
                task.processed_cards = processed;
                task.current_word = current_word.to_string();
                if task.processed_cards >= task.total_cards {
                    task.status = "completed".to_string();
                }
            }
        }
    }

    pub fn set_status(&self, task_id: &str, status: &str, error: Option<String>) {
        if let Ok(mut tasks) = self.tasks.write() {
            if let Some(task) = tasks.get_mut(task_id) {
                task.status = status.to_string();
                task.error = error;
            }
        }
    }

    pub fn cancel_task(&self, task_id: &str) {
        if let Ok(cancels) = self.cancellations.read() {
            if let Some(flag) = cancels.get(task_id) {
                flag.store(true, Ordering::SeqCst);
            }
        }
        self.set_status(task_id, "cancelled", None);
    }

    pub fn get_progress(&self, task_id: &str) -> Option<BulkGenerationProgress> {
        if let Ok(tasks) = self.tasks.read() {
            tasks.get(task_id).cloned()
        } else {
            None
        }
    }
}
