from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import engine
from models import Bin, Location

router = APIRouter(prefix="/api/locations", tags=["locations"])

LEVELS = ["site", "zone", "stack", "slot"]


class LocationCreate(BaseModel):
    name: str
    kind: str
    parent_id: Optional[int] = None
    grid_row: Optional[int] = None
    grid_col: Optional[int] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    parent_id: Optional[int] = None
    grid_row: Optional[int] = None
    grid_col: Optional[int] = None


def validate_hierarchy(
    session: Session, kind: str, parent_id: Optional[int]
) -> Optional[Location]:
    if kind not in LEVELS:
        raise HTTPException(status_code=409, detail=f"invalid kind: {kind}")
    if parent_id is None:
        if kind != "site":
            raise HTTPException(
                status_code=409, detail="only a site may have no parent"
            )
        return None
    parent = session.get(Location, parent_id)
    if parent is None:
        raise HTTPException(status_code=404, detail="parent not found")
    if kind == "stack" and parent.kind == "site":
        # Grid layout: a site's grid stacks sit directly under it, skipping
        # "zone" (CLAUDE.md: "Storage Unit · R1C1 · tote 1").
        return parent
    parent_idx = LEVELS.index(parent.kind)
    if parent_idx + 1 >= len(LEVELS) or LEVELS[parent_idx + 1] != kind:
        raise HTTPException(
            status_code=409, detail=f"{kind} cannot be a child of {parent.kind}"
        )
    return parent


def validate_grid(
    kind: str, grid_row: Optional[int], grid_col: Optional[int]
) -> None:
    if (grid_row is not None or grid_col is not None) and kind != "stack":
        raise HTTPException(
            status_code=409, detail="grid_row/grid_col only allowed on kind=stack"
        )


@router.get("", response_model=list[Location])
def list_locations():
    with Session(engine) as session:
        return session.exec(select(Location)).all()


@router.get("/tree")
def location_tree():
    with Session(engine) as session:
        locations = session.exec(select(Location)).all()

    by_parent: dict[Optional[int], list[Location]] = {}
    for loc in locations:
        by_parent.setdefault(loc.parent_id, []).append(loc)
    ids = {loc.id for loc in locations}

    def build(loc: Location) -> dict:
        node = loc.model_dump()
        node["children"] = [build(child) for child in by_parent.get(loc.id, [])]
        return node

    roots = [loc for loc in locations if loc.parent_id is None or loc.parent_id not in ids]
    return [build(loc) for loc in roots]


@router.get("/{location_id}/bins")
def location_bins(location_id: int):
    with Session(engine) as session:
        loc = session.get(Location, location_id)
        if loc is None:
            raise HTTPException(status_code=404, detail="not found")
        bins = session.exec(
            select(Bin).where(Bin.location_id == location_id, Bin.status != "blank")
        ).all()

    positioned = sorted(
        (b for b in bins if b.stack_position is not None),
        key=lambda b: -b.stack_position,
    )
    unpositioned = [b for b in bins if b.stack_position is None]

    def is_buried(b: Bin) -> bool:
        if b.stack_position is None:
            return False
        return any(other.stack_position > b.stack_position for other in positioned)

    result = []
    for b in positioned + unpositioned:
        data = b.model_dump()
        data["is_buried"] = is_buried(b)
        result.append(data)
    return result


@router.post("", response_model=Location, status_code=201)
def create_location(payload: LocationCreate):
    with Session(engine) as session:
        validate_hierarchy(session, payload.kind, payload.parent_id)
        validate_grid(payload.kind, payload.grid_row, payload.grid_col)
        loc = Location(**payload.model_dump())
        session.add(loc)
        session.commit()
        session.refresh(loc)
        return loc


@router.patch("/{location_id}", response_model=Location)
def update_location(location_id: int, payload: LocationUpdate):
    with Session(engine) as session:
        loc = session.get(Location, location_id)
        if loc is None:
            raise HTTPException(status_code=404, detail="not found")
        data = payload.model_dump(exclude_unset=True)
        kind = data.get("kind", loc.kind)
        parent_id = data.get("parent_id", loc.parent_id)
        grid_row = data.get("grid_row", loc.grid_row)
        grid_col = data.get("grid_col", loc.grid_col)
        validate_hierarchy(session, kind, parent_id)
        validate_grid(kind, grid_row, grid_col)
        for field, value in data.items():
            setattr(loc, field, value)
        session.add(loc)
        session.commit()
        session.refresh(loc)
        return loc


@router.delete("/{location_id}", status_code=204)
def delete_location(location_id: int):
    with Session(engine) as session:
        loc = session.get(Location, location_id)
        if loc is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(loc)
        session.commit()
