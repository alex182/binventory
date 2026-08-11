from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Location(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    kind: str  # "site" | "zone" | "stack" | "slot"
    parent_id: Optional[int] = Field(default=None, foreign_key="location.id")
    grid_row: Optional[int] = None
    grid_col: Optional[int] = None


class Bin(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)
    label: str
    status: str = "active"  # "blank" | "active"
    location_id: Optional[int] = Field(default=None, foreign_key="location.id")
    stack_position: Optional[int] = None
    fullness: str = "room"  # "empty" | "room" | "full"
    location_note: str = ""
    notes: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class Item(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    bin_id: int = Field(foreign_key="bin.id")
    name: str
    qty: int = 1
    notes: str = ""
    loaned_to: Optional[str] = None
    loaned_at: Optional[datetime] = None


class Photo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    bin_id: int = Field(foreign_key="bin.id")
    filename: str
    created_at: datetime = Field(default_factory=utcnow)


class MoveLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    bin_id: int = Field(foreign_key="bin.id")
    from_location_id: Optional[int] = Field(default=None, foreign_key="location.id")
    to_location_id: Optional[int] = Field(default=None, foreign_key="location.id")
    from_position: Optional[int] = None
    to_position: Optional[int] = None
    moved_at: datetime = Field(default_factory=utcnow)
