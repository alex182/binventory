from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine, select

import models  # noqa: F401  (registers tables on SQLModel.metadata)
from config import DATA_DIR
from models import Location

Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
DB_PATH = Path(DATA_DIR) / "db.sqlite"
engine = create_engine(f"sqlite:///{DB_PATH}")

SEED_SITES = ["Garage", "Basement", "Storage Unit"]

# One row per (bin_id, field) for bin-level fields, or per item for field='item'.
# item_id disambiguates multiple items belonging to the same bin.
FTS_TRIGGERS = [
    """
    CREATE TRIGGER IF NOT EXISTS bin_search_ai AFTER INSERT ON bin BEGIN
      INSERT INTO search_index(text, bin_id, item_id, field) VALUES (NEW.label, NEW.id, NULL, 'label');
      INSERT INTO search_index(text, bin_id, item_id, field) VALUES (NEW.notes, NEW.id, NULL, 'notes');
      INSERT INTO search_index(text, bin_id, item_id, field) VALUES (NEW.location_note, NEW.id, NULL, 'location_note');
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS bin_search_ad AFTER DELETE ON bin BEGIN
      DELETE FROM search_index WHERE bin_id = OLD.id AND field IN ('label', 'notes', 'location_note');
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS bin_search_au AFTER UPDATE ON bin BEGIN
      DELETE FROM search_index WHERE bin_id = OLD.id AND field IN ('label', 'notes', 'location_note');
      INSERT INTO search_index(text, bin_id, item_id, field) VALUES (NEW.label, NEW.id, NULL, 'label');
      INSERT INTO search_index(text, bin_id, item_id, field) VALUES (NEW.notes, NEW.id, NULL, 'notes');
      INSERT INTO search_index(text, bin_id, item_id, field) VALUES (NEW.location_note, NEW.id, NULL, 'location_note');
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS item_search_ai AFTER INSERT ON item BEGIN
      INSERT INTO search_index(text, bin_id, item_id, field) VALUES (NEW.name, NEW.bin_id, NEW.id, 'item');
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS item_search_ad AFTER DELETE ON item BEGIN
      DELETE FROM search_index WHERE item_id = OLD.id AND field = 'item';
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS item_search_au AFTER UPDATE ON item BEGIN
      DELETE FROM search_index WHERE item_id = OLD.id AND field = 'item';
      INSERT INTO search_index(text, bin_id, item_id, field) VALUES (NEW.name, NEW.bin_id, NEW.id, 'item');
    END
    """,
]


def setup_search_index() -> None:
    with engine.begin() as conn:
        try:
            conn.exec_driver_sql(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
                    text,
                    bin_id UNINDEXED,
                    item_id UNINDEXED,
                    field UNINDEXED,
                    tokenize = 'trigram'
                )
                """
            )
        except Exception as exc:
            raise RuntimeError(
                "SQLite FTS5 trigram tokenizer is unavailable (requires SQLite "
                ">= 3.34 built with FTS5). Search cannot start."
            ) from exc

        for trigger_sql in FTS_TRIGGERS:
            conn.exec_driver_sql(trigger_sql)

        (count,) = conn.exec_driver_sql("SELECT COUNT(*) FROM search_index").fetchone()
        if count == 0:
            conn.exec_driver_sql(
                "INSERT INTO search_index(text, bin_id, item_id, field) "
                "SELECT label, id, NULL, 'label' FROM bin"
            )
            conn.exec_driver_sql(
                "INSERT INTO search_index(text, bin_id, item_id, field) "
                "SELECT notes, id, NULL, 'notes' FROM bin"
            )
            conn.exec_driver_sql(
                "INSERT INTO search_index(text, bin_id, item_id, field) "
                "SELECT location_note, id, NULL, 'location_note' FROM bin"
            )
            conn.exec_driver_sql(
                "INSERT INTO search_index(text, bin_id, item_id, field) "
                "SELECT name, bin_id, id, 'item' FROM item"
            )


def get_session():
    with Session(engine) as session:
        yield session


def seed(session: Session) -> None:
    existing = session.exec(select(Location).where(Location.kind == "site")).first()
    if existing:
        return
    for name in SEED_SITES:
        session.add(Location(name=name, kind="site"))
    session.commit()


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session)
    setup_search_index()
