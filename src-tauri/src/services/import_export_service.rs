use serde::{Deserialize, Serialize};

use crate::database::connection::Database;
use crate::database::repositories::{CardRepository, DeckRepository};
use crate::domain::card::{CardType, CreateCardDto};
use crate::domain::deck::CreateDeckDto;
use crate::errors::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub total_cards_found: usize,
    pub sample_front: Option<String>,
    pub sample_back: Option<String>,
    pub sample_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDeckPayload {
    pub deck_name: String,
    pub description: Option<String>,
    pub cards: Vec<ExportCardPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportCardPayload {
    pub front: String,
    pub back: String,
    pub notes: Option<String>,
    pub card_type: String,
    pub tags: Vec<String>,
}

pub struct ImportExportService {
    db: Database,
}

impl ImportExportService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn preview_csv(&self, content: &str, delimiter: u8) -> AppResult<ImportPreview> {
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(delimiter)
            .has_headers(false)
            .from_reader(content.as_bytes());

        let mut count = 0;
        let mut sample_front = None;
        let mut sample_back = None;
        let mut sample_tags = Vec::new();

        for record in reader.records() {
            let record = record.map_err(|e| AppError::ImportExport(format!("CSV parse error: {}", e)))?;
            if record.len() >= 2 {
                if count == 0 {
                    sample_front = Some(record[0].to_string());
                    sample_back = Some(record[1].to_string());
                    if record.len() >= 3 {
                        sample_tags = record[2]
                            .split(&[',', ';', ' '][..])
                            .filter(|s| !s.is_empty())
                            .map(|s| s.to_string())
                            .collect();
                    }
                }
                count += 1;
            }
        }

        Ok(ImportPreview {
            total_cards_found: count,
            sample_front,
            sample_back,
            sample_tags,
        })
    }

    pub fn import_csv(&self, deck_id: &str, content: &str, delimiter: u8) -> AppResult<usize> {
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(delimiter)
            .has_headers(false)
            .from_reader(content.as_bytes());

        let conn = self.db.get_connection();
        let mut imported = 0;

        for record in reader.records() {
            let record = record.map_err(|e| AppError::ImportExport(format!("CSV parse error: {}", e)))?;
            if record.len() >= 2 {
                let front = record[0].trim().to_string();
                let back = record[1].trim().to_string();
                if front.is_empty() || back.is_empty() {
                    continue;
                }

                let tags: Vec<String> = if record.len() >= 3 {
                    record[2]
                        .split(&[',', ';', ' '][..])
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                } else {
                    Vec::new()
                };

                let is_cloze = front.contains("{{c") || back.contains("{{c");
                let card_type = if is_cloze { CardType::Cloze } else { CardType::Basic };

                let dto = CreateCardDto {
                    deck_id: deck_id.to_string(),
                    card_type,
                    front,
                    back,
                    notes: None,
                    tags,
                };

                CardRepository::create(&conn, dto)?;
                imported += 1;
            }
        }

        Ok(imported)
    }

    pub fn export_deck_json(&self, deck_id: &str) -> AppResult<String> {
        let conn = self.db.get_connection();
        let deck = DeckRepository::get_by_id(&conn, deck_id)?;
        let cards = CardRepository::search(&conn, "", Some(deck_id), None, None, 100_000, 0)?;

        let export_cards: Vec<ExportCardPayload> = cards
            .into_iter()
            .map(|c| ExportCardPayload {
                front: c.card.front,
                back: c.card.back,
                notes: c.card.notes,
                card_type: c.card.card_type.as_str().to_string(),
                tags: c.card.tags,
            })
            .collect();

        let payload = ExportDeckPayload {
            deck_name: deck.name,
            description: deck.description,
            cards: export_cards,
        };

        let json = serde_json::to_string_pretty(&payload)?;
        Ok(json)
    }

    pub fn import_json(&self, json_content: &str, target_deck_id: Option<String>) -> AppResult<usize> {
        let payload: ExportDeckPayload = serde_json::from_str(json_content)?;
        let conn = self.db.get_connection();

        let deck_id = if let Some(did) = target_deck_id {
            did
        } else {
            let deck = DeckRepository::create(&conn, CreateDeckDto {
                parent_id: None,
                name: payload.deck_name,
                description: payload.description,
                color: Some("#3b82f6".to_string()),
                icon: Some("folder".to_string()),
                priority: Some(0),
            })?;
            deck.id
        };

        let mut count = 0;
        for c in payload.cards {
            let dto = CreateCardDto {
                deck_id: deck_id.clone(),
                card_type: CardType::from_str(&c.card_type),
                front: c.front,
                back: c.back,
                notes: c.notes,
                tags: c.tags,
            };
            CardRepository::create(&conn, dto)?;
            count += 1;
        }

        Ok(count)
    }
}
