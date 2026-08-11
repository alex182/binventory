import base64
import io
import os
from typing import Optional

import qrcode
import qrcode.image.svg
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Session, select

from config import BASE_URL
from db import engine
from models import Bin, MoveLog

router = APIRouter(prefix="/api/bins", tags=["bins"])


class BinCreate(BaseModel):
    label: str
    location_id: Optional[int] = None
    stack_position: Optional[int] = None
    fullness: str = "room"
    location_note: str = ""
    notes: str = ""


class BinUpdate(BaseModel):
    label: Optional[str] = None
    location_id: Optional[int] = None
    stack_position: Optional[int] = None
    fullness: Optional[str] = None
    location_note: Optional[str] = None
    notes: Optional[str] = None


class BatchCreate(BaseModel):
    count: int


class ClaimPayload(BaseModel):
    label: str
    location_id: Optional[int] = None
    stack_position: Optional[int] = None
    fullness: str = "room"
    location_note: str = ""
    notes: str = ""


class ReorderPayload(BaseModel):
    ordered_bin_ids: list[int]


class MoveBinPayload(BaseModel):
    to_location_id: int
    to_position: Optional[int] = None


class MoveStackPayload(BaseModel):
    to_location_id: int


# Reorder/move-stack are location-scoped routes (/api/locations/...), not
# /api/bins ones, so they need their own unprefixed router even though they
# live in this file per the tickets' Files lists.
stack_router = APIRouter(tags=["bins"])


def generate_code(session: Session) -> str:
    while True:
        code = base64.b32encode(os.urandom(5)).decode("ascii").lower()
        if not session.exec(select(Bin).where(Bin.code == code)).first():
            return code


def bins_on_top_count(bin_: Bin, siblings: list[Bin]) -> int:
    if bin_.stack_position is None:
        return 0
    return sum(
        1
        for other in siblings
        if other.id != bin_.id
        and other.stack_position is not None
        and other.stack_position > bin_.stack_position
    )


def serialize_bin(bin_: Bin, siblings: list[Bin]) -> dict:
    data = bin_.model_dump()
    on_top = bins_on_top_count(bin_, siblings)
    data["bins_on_top"] = on_top
    data["is_buried"] = on_top > 0
    return data


def siblings_of(session: Session, bin_: Bin) -> list[Bin]:
    if bin_.location_id is None:
        return []
    return session.exec(select(Bin).where(Bin.location_id == bin_.location_id)).all()


def log_move(
    session: Session,
    bin_: Bin,
    from_location_id: Optional[int],
    from_position: Optional[int],
    to_location_id: Optional[int],
    to_position: Optional[int],
) -> None:
    if from_location_id == to_location_id and from_position == to_position:
        return
    session.add(
        MoveLog(
            bin_id=bin_.id,
            from_location_id=from_location_id,
            to_location_id=to_location_id,
            from_position=from_position,
            to_position=to_position,
        )
    )


@router.get("")
def list_bins(location_id: Optional[int] = None, include_blank: bool = False):
    with Session(engine) as session:
        all_bins = session.exec(select(Bin)).all()

        by_location: dict[Optional[int], list[Bin]] = {}
        for b in all_bins:
            by_location.setdefault(b.location_id, []).append(b)

        query_bins = all_bins
        if location_id is not None:
            query_bins = [b for b in query_bins if b.location_id == location_id]
        if not include_blank:
            query_bins = [b for b in query_bins if b.status != "blank"]

        return [serialize_bin(b, by_location.get(b.location_id, [])) for b in query_bins]


@router.get("/blank")
def list_blank_bins():
    with Session(engine) as session:
        bins = session.exec(select(Bin).where(Bin.status == "blank")).all()
        return [serialize_bin(b, siblings_of(session, b)) for b in bins]


@router.get("/{bin_id}")
def get_bin(bin_id: int):
    with Session(engine) as session:
        bin_ = session.get(Bin, bin_id)
        if bin_ is None:
            raise HTTPException(status_code=404, detail="not found")
        return serialize_bin(bin_, siblings_of(session, bin_))


@router.get("/by-code/{code}")
def get_bin_by_code(code: str):
    with Session(engine) as session:
        bin_ = session.exec(select(Bin).where(Bin.code == code)).first()
        if bin_ is None:
            raise HTTPException(status_code=404, detail="not found")
        return serialize_bin(bin_, siblings_of(session, bin_))


def get_bin_or_404(session: Session, bin_id: int) -> Bin:
    bin_ = session.get(Bin, bin_id)
    if bin_ is None:
        raise HTTPException(status_code=404, detail="not found")
    return bin_


@router.get("/{bin_id}/qr.png")
def bin_qr_png(bin_id: int):
    with Session(engine) as session:
        code = get_bin_or_404(session, bin_id).code
    img = qrcode.make(f"{BASE_URL}/b/{code}")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@router.get("/{bin_id}/qr.svg")
def bin_qr_svg(bin_id: int):
    with Session(engine) as session:
        code = get_bin_or_404(session, bin_id).code
    img = qrcode.make(f"{BASE_URL}/b/{code}", image_factory=qrcode.image.svg.SvgImage)
    buf = io.BytesIO()
    img.save(buf)
    return Response(content=buf.getvalue(), media_type="image/svg+xml")


@router.post("", status_code=201)
def create_bin(payload: BinCreate):
    with Session(engine) as session:
        bin_ = Bin(code=generate_code(session), **payload.model_dump())
        session.add(bin_)
        session.commit()
        session.refresh(bin_)
        return serialize_bin(bin_, siblings_of(session, bin_))


@router.post("/batch")
def batch_create_bins(payload: BatchCreate):
    with Session(engine) as session:
        bins = []
        for _ in range(payload.count):
            bin_ = Bin(code=generate_code(session), label="", status="blank")
            session.add(bin_)
            bins.append(bin_)
        session.commit()
        for bin_ in bins:
            session.refresh(bin_)
        return [serialize_bin(b, siblings_of(session, b)) for b in bins]


@router.post("/{bin_id}/claim")
def claim_bin(bin_id: int, payload: ClaimPayload):
    with Session(engine) as session:
        bin_ = session.get(Bin, bin_id)
        if bin_ is None:
            raise HTTPException(status_code=404, detail="not found")
        if bin_.status != "blank":
            raise HTTPException(status_code=409, detail="already active")
        for field, value in payload.model_dump().items():
            setattr(bin_, field, value)
        bin_.status = "active"
        session.add(bin_)
        session.commit()
        session.refresh(bin_)
        return serialize_bin(bin_, siblings_of(session, bin_))


@router.patch("/{bin_id}")
def update_bin(bin_id: int, payload: BinUpdate):
    with Session(engine) as session:
        bin_ = session.get(Bin, bin_id)
        if bin_ is None:
            raise HTTPException(status_code=404, detail="not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(bin_, field, value)
        session.add(bin_)
        session.commit()
        session.refresh(bin_)
        return serialize_bin(bin_, siblings_of(session, bin_))


@router.delete("/{bin_id}", status_code=204)
def delete_bin(bin_id: int):
    with Session(engine) as session:
        bin_ = session.get(Bin, bin_id)
        if bin_ is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(bin_)
        session.commit()


@router.post("/{bin_id}/move")
def move_bin(bin_id: int, payload: MoveBinPayload):
    with Session(engine) as session:
        bin_ = session.get(Bin, bin_id)
        if bin_ is None:
            raise HTTPException(status_code=404, detail="not found")
        from_location_id, from_position = bin_.location_id, bin_.stack_position
        bin_.location_id = payload.to_location_id
        bin_.stack_position = payload.to_position
        session.add(bin_)
        log_move(
            session, bin_, from_location_id, from_position, payload.to_location_id, payload.to_position
        )
        session.commit()
        session.refresh(bin_)
        return serialize_bin(bin_, siblings_of(session, bin_))


@stack_router.post("/api/locations/{stack_id}/reorder")
def reorder_stack(stack_id: int, payload: ReorderPayload):
    with Session(engine) as session:
        for position, bin_id in enumerate(payload.ordered_bin_ids, start=1):
            bin_ = session.get(Bin, bin_id)
            if bin_ is None:
                raise HTTPException(status_code=404, detail=f"bin {bin_id} not found")
            from_location_id, from_position = bin_.location_id, bin_.stack_position
            bin_.location_id = stack_id
            bin_.stack_position = position
            session.add(bin_)
            log_move(session, bin_, from_location_id, from_position, stack_id, position)
        session.commit()
        bins = session.exec(select(Bin).where(Bin.location_id == stack_id)).all()
        bins.sort(key=lambda b: b.stack_position or 0)
        return [serialize_bin(b, bins) for b in bins]


@stack_router.post("/api/locations/{stack_id}/move")
def move_stack(stack_id: int, payload: MoveStackPayload):
    with Session(engine) as session:
        bins = session.exec(select(Bin).where(Bin.location_id == stack_id)).all()
        for bin_ in bins:
            from_position = bin_.stack_position
            bin_.location_id = payload.to_location_id
            session.add(bin_)
            log_move(session, bin_, stack_id, from_position, payload.to_location_id, from_position)
        session.commit()

        moved = session.exec(
            select(Bin).where(Bin.location_id == payload.to_location_id)
        ).all()
        moved.sort(key=lambda b: b.stack_position or 0)
        return [serialize_bin(b, moved) for b in moved]
