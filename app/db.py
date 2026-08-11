from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine, select

import models  # noqa: F401  (registers tables on SQLModel.metadata)
from config import DATA_DIR
from models import Location

Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
DB_PATH = Path(DATA_DIR) / "db.sqlite"
engine = create_engine(f"sqlite:///{DB_PATH}")

SEED_SITES = ["Garage", "Basement", "Storage Unit"]


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
