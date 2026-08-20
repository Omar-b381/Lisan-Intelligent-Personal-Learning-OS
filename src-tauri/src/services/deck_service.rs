use crate::database::connection::Database;
use crate::database::repositories::DeckRepository;
use crate::domain::deck::{CreateDeckDto, Deck, DeckWithStats, UpdateDeckDto};
use crate::errors::AppResult;

pub struct DeckService {
    db: Database,
}

impl DeckService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn get_decks_tree(&self) -> AppResult<Vec<DeckWithStats>> {
        let conn = self.db.get_connection();
        DeckRepository::get_tree(&conn)
    }

    pub fn get_all_flat(&self) -> AppResult<Vec<Deck>> {
        let conn = self.db.get_connection();
        DeckRepository::get_all(&conn)
    }

    pub fn get_by_id(&self, id: &str) -> AppResult<Deck> {
        let conn = self.db.get_connection();
        DeckRepository::get_by_id(&conn, id)
    }

    pub fn create_deck(&self, dto: CreateDeckDto) -> AppResult<Deck> {
        let conn = self.db.get_connection();
        DeckRepository::create(&conn, dto)
    }

    pub fn update_deck(&self, dto: UpdateDeckDto) -> AppResult<Deck> {
        let conn = self.db.get_connection();
        DeckRepository::update(&conn, dto)
    }

    pub fn delete_deck(&self, id: &str) -> AppResult<()> {
        let conn = self.db.get_connection();
        DeckRepository::delete(&conn, id)
    }
}
