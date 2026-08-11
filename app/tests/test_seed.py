import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from sqlmodel import Session, select  # noqa: E402

from db import SEED_SITES, engine, init_db  # noqa: E402
from models import Location  # noqa: E402


def test_seed_creates_three_sites():
    init_db()
    with Session(engine) as session:
        names = sorted(
            loc.name
            for loc in session.exec(select(Location).where(Location.kind == "site")).all()
        )
    assert names == sorted(SEED_SITES)


def test_seed_is_idempotent():
    init_db()
    init_db()
    with Session(engine) as session:
        count = len(
            session.exec(select(Location).where(Location.kind == "site")).all()
        )
    assert count == 3
