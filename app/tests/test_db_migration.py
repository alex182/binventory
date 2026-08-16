import os
import sqlite3
import tempfile

os.environ.setdefault("DATA_DIR", tempfile.mkdtemp())

from sqlmodel import create_engine  # noqa: E402

import db  # noqa: E402


def test_migrate_schema_adds_grid_number_order_to_existing_location_table():
    db_path = os.path.join(tempfile.mkdtemp(), "legacy.sqlite")

    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE location (
            id INTEGER PRIMARY KEY,
            name VARCHAR NOT NULL,
            kind VARCHAR NOT NULL,
            parent_id INTEGER,
            grid_row INTEGER,
            grid_col INTEGER
        )
        """
    )
    conn.execute(
        "INSERT INTO location (id, name, kind, parent_id) VALUES (1, 'Existing Site', 'site', NULL)"
    )
    conn.commit()
    conn.close()

    original_engine = db.engine
    db.engine = create_engine(f"sqlite:///{db_path}")
    try:
        db.migrate_schema()
        db.migrate_schema()  # must be safe to run again on an already-migrated db
    finally:
        db.engine = original_engine

    conn = sqlite3.connect(db_path)
    cols = {row[1] for row in conn.execute("PRAGMA table_info(location)").fetchall()}
    row = conn.execute("SELECT name, grid_number_order FROM location WHERE id = 1").fetchone()
    conn.close()

    assert "grid_number_order" in cols
    assert row == ("Existing Site", None)
