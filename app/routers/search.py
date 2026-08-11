import difflib

from fastapi import APIRouter
from sqlmodel import Session, select

from db import engine
from models import Bin, Location

router = APIRouter(prefix="/api/search", tags=["search"])

FUZZY_THRESHOLD = 0.5


def location_path_for_bin(locations_by_id: dict, bin_: Bin) -> str:
    parts: list[str] = []
    current = locations_by_id.get(bin_.location_id) if bin_.location_id else None
    while current:
        if current.kind == "stack" and current.grid_row is not None and current.grid_col is not None:
            parts.append(f"R{current.grid_row}C{current.grid_col}")
        else:
            parts.append(current.name)
        current = locations_by_id.get(current.parent_id) if current.parent_id else None
    parts.reverse()

    path = " · ".join(parts)
    if path and bin_.stack_position is not None:
        path = f"{path} · tote {bin_.stack_position}"
    if path and bin_.location_note:
        return f"{path} · {bin_.location_note}"
    return path or bin_.location_note or ""


@router.get("")
def search(q: str = ""):
    q = q.strip()
    if not q:
        return []

    with Session(engine) as session:
        conn = session.connection()

        if len(q) < 3:
            rows = conn.exec_driver_sql(
                "SELECT bin_id, item_id, field, text FROM search_index "
                "WHERE text LIKE ? AND text != ''",
                (f"{q}%",),
            ).fetchall()
            scored = [(row, 1.0) for row in rows]
        else:
            substring_rows = conn.exec_driver_sql(
                "SELECT bin_id, item_id, field, text FROM search_index "
                "WHERE text LIKE ? AND text != ''",
                (f"%{q}%",),
            ).fetchall()
            matched_keys = {(r[0], r[1], r[2]) for r in substring_rows}
            scored = [(row, 1.0) for row in substring_rows]

            # Substring matching alone misses typos (e.g. a transposition can
            # share zero trigrams with the correct spelling), so also score
            # every remaining row by string similarity as a fallback layer.
            all_rows = conn.exec_driver_sql(
                "SELECT bin_id, item_id, field, text FROM search_index WHERE text != ''"
            ).fetchall()
            for row in all_rows:
                key = (row[0], row[1], row[2])
                if key in matched_keys:
                    continue
                ratio = difflib.SequenceMatcher(None, q.lower(), row[3].lower()).ratio()
                if ratio >= FUZZY_THRESHOLD:
                    scored.append((row, ratio))

        locations_by_id = {loc.id: loc for loc in session.exec(select(Location)).all()}
        bins_by_id = {b.id: b for b in session.exec(select(Bin)).all()}

        best_per_bin: dict[int, tuple] = {}
        for (bin_id, _item_id, field, _text), score in scored:
            if bin_id not in bins_by_id:
                continue
            existing = best_per_bin.get(bin_id)
            if existing is None or score > existing[0]:
                best_per_bin[bin_id] = (score, field)

        results = [
            {
                "bin_id": bin_id,
                "label": bins_by_id[bin_id].label,
                "code": bins_by_id[bin_id].code,
                "location_path": location_path_for_bin(locations_by_id, bins_by_id[bin_id]),
                "matched_field": matched_field,
                "_score": score,
            }
            for bin_id, (score, matched_field) in best_per_bin.items()
        ]
        results.sort(key=lambda r: -r["_score"])
        for r in results:
            del r["_score"]
        return results
