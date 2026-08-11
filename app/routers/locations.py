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


class GridCreate(BaseModel):
    rows: int
    cols: int


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

    def bins_on_top(b: Bin) -> int:
        if b.stack_position is None:
            return 0
        return sum(1 for other in positioned if other.stack_position > b.stack_position)

    result = []
    for b in positioned + unpositioned:
        data = b.model_dump()
        on_top = bins_on_top(b)
        data["bins_on_top"] = on_top
        data["is_buried"] = on_top > 0
        result.append(data)
    return result


@router.post("/{site_id}/grid", response_model=list[Location])
def create_grid(site_id: int, payload: GridCreate):
    with Session(engine) as session:
        site = session.get(Location, site_id)
        if site is None:
            raise HTTPException(status_code=404, detail="site not found")
        existing = {
            (s.grid_row, s.grid_col): s
            for s in session.exec(
                select(Location).where(
                    Location.parent_id == site_id, Location.kind == "stack"
                )
            ).all()
        }
        new_stacks = []
        for r in range(1, payload.rows + 1):
            for c in range(1, payload.cols + 1):
                if (r, c) in existing:
                    continue
                stack = Location(
                    name=f"R{r}C{c}",
                    kind="stack",
                    parent_id=site_id,
                    grid_row=r,
                    grid_col=c,
                )
                session.add(stack)
                new_stacks.append(stack)
        session.commit()
        for stack in new_stacks:
            session.refresh(stack)
        return list(existing.values()) + new_stacks


@router.get("/{site_id}/grid")
def get_grid(site_id: int):
    with Session(engine) as session:
        site = session.get(Location, site_id)
        if site is None:
            raise HTTPException(status_code=404, detail="site not found")
        stacks = session.exec(
            select(Location).where(
                Location.parent_id == site_id,
                Location.kind == "stack",
                Location.grid_row.is_not(None),
                Location.grid_col.is_not(None),
            )
        ).all()

        rows = max((s.grid_row for s in stacks), default=0)
        cols = max((s.grid_col for s in stacks), default=0)

        cells = []
        for s in stacks:
            bins = session.exec(
                select(Bin).where(Bin.location_id == s.id, Bin.status != "blank")
            ).all()
            positioned = [b for b in bins if b.stack_position is not None]
            top_bin = max(positioned, key=lambda b: b.stack_position) if positioned else None
            cells.append(
                {
                    "stack_id": s.id,
                    "grid_row": s.grid_row,
                    "grid_col": s.grid_col,
                    "bin_count": len(bins),
                    "top_bin": top_bin.model_dump() if top_bin else None,
                }
            )
        return {"rows": rows, "cols": cols, "cells": cells}


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
