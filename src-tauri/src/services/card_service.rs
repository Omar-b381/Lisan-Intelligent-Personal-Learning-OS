use crate::database::connection::Database;
use crate::database::repositories::CardRepository;
use crate::domain::card::{Card, CardWithDeckInfo, CreateCardDto, UpdateCardDto};
use crate::domain::session::WeakCardInfo;
use crate::errors::AppResult;

pub struct CardService {
    db: Database,
}

impl CardService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn get_card(&self, id: &str) -> AppResult<Card> {
        let conn = self.db.get_connection();
        CardRepository::get_by_id(&conn, id)
    }

    pub fn create_card(&self, dto: CreateCardDto) -> AppResult<Card> {
        let conn = self.db.get_connection();
        CardRepository::create(&conn, dto)
    }

    pub fn update_card(&self, dto: UpdateCardDto) -> AppResult<Card> {
        let conn = self.db.get_connection();
        CardRepository::update(&conn, dto)
    }

    pub fn delete_card(&self, id: &str) -> AppResult<()> {
        let conn = self.db.get_connection();
        CardRepository::delete(&conn, id)
    }

    pub fn toggle_suspend(&self, id: &str) -> AppResult<bool> {
        let conn = self.db.get_connection();
        CardRepository::toggle_suspend(&conn, id)
    }

    pub fn search_cards(
        &self,
        query: &str,
        deck_id: Option<&str>,
        tag: Option<&str>,
        state: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> AppResult<Vec<CardWithDeckInfo>> {
        let conn = self.db.get_connection();
        CardRepository::search(&conn, query, deck_id, tag, state, limit, offset)
    }

    pub fn get_weak_cards(&self, limit: Option<u32>) -> AppResult<Vec<WeakCardInfo>> {
        let conn = self.db.get_connection();
        CardRepository::get_weak_cards(&conn, limit.unwrap_or(20))
    }
}
