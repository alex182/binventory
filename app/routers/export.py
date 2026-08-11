import csv
import io
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Response
from pydantic import BaseModel
from sqlmodel import Session, select

from db import engine
from models import Bin, Item, Location, MoveLog, Photo

DATETIME_FIELDS = {
    Location: (),
    Bin: ("created_at",),
    Item: ("loaned_at",),
    Photo: ("created_at",),
    MoveLog: ("moved_at",),
}


def build_row(model: type, data: dict[str, Any]):
    row = dict(data)
    for field in DATETIME_FIELDS[model]:
        if isinstance(row.get(field), str):
            row[field] = datetime.fromisoformat(row[field])
    return model(**row)

router = APIRouter(tags=["export"])


@router.get("/api/export")
def export_data():
    with Session(engine) as session:
        return {
            "locations": [loc.model_dump() for loc in session.exec(select(Location)).all()],
            "bins": [b.model_dump() for b in session.exec(select(Bin)).all()],
            "items": [i.model_dump() for i in session.exec(select(Item)).all()],
            "photos": [p.model_dump() for p in session.exec(select(Photo)).all()],
            "move_log": [m.model_dump() for m in session.exec(select(MoveLog)).all()],
        }


@router.get("/api/export.csv")
def export_csv():
    with Session(engine) as session:
        bins = session.exec(select(Bin)).all()
        items_by_bin: dict[int, list[Item]] = {}
        for item in session.exec(select(Item)).all():
            items_by_bin.setdefault(item.bin_id, []).append(item)
        locations_by_id = {loc.id: loc for loc in session.exec(select(Location)).all()}

    def location_path(bin_: Bin) -> str:
        parts = []
        current = locations_by_id.get(bin_.location_id) if bin_.location_id else None
        while current:
            parts.append(current.name)
            current = locations_by_id.get(current.parent_id) if current.parent_id else None
        parts.reverse()
        return " > ".join(parts)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["bin_code", "bin_label", "location_path", "item_name", "item_qty", "item_notes"]
    )
    for bin_ in bins:
        bin_items = items_by_bin.get(bin_.id, [])
        if not bin_items:
            writer.writerow([bin_.code, bin_.label, location_path(bin_), "", "", ""])
        else:
            for item in bin_items:
                writer.writerow(
                    [bin_.code, bin_.label, location_path(bin_), item.name, item.qty, item.notes]
                )

    return Response(content=buf.getvalue(), media_type="text/csv")


class ImportPayload(BaseModel):
    locations: list[dict[str, Any]] = []
    bins: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    photos: list[dict[str, Any]] = []
    move_log: list[dict[str, Any]] = []


@router.post("/api/import")
def import_data(payload: ImportPayload):
    with Session(engine) as session:
        for model in (MoveLog, Photo, Item, Bin, Location):
            for row in session.exec(select(model)).all():
                session.delete(row)
        session.commit()

        for loc in payload.locations:
            session.add(build_row(Location, loc))
        session.commit()

        for bin_ in payload.bins:
            session.add(build_row(Bin, bin_))
        session.commit()

        for item in payload.items:
            session.add(build_row(Item, item))
        for photo in payload.photos:
            session.add(build_row(Photo, photo))
        for move in payload.move_log:
            session.add(build_row(MoveLog, move))
        session.commit()

    return {"status": "ok"}
