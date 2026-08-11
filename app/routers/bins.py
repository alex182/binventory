import base64
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import engine
from models import Bin

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


def generate_code(session: Session) -> str:
    while True:
        code = base64.b32encode(os.urandom(5)).decode("ascii").lower()
        if not session.exec(select(Bin).where(Bin.code == code)).first():
            return code


@router.get("", response_model=list[Bin])
def list_bins(location_id: Optional[int] = None, include_blank: bool = False):
    with Session(engine) as session:
        query = select(Bin)
        if location_id is not None:
            query = query.where(Bin.location_id == location_id)
        if not include_blank:
            query = query.where(Bin.status != "blank")
        return session.exec(query).all()


@router.get("/{bin_id}", response_model=Bin)
def get_bin(bin_id: int):
    with Session(engine) as session:
        bin_ = session.get(Bin, bin_id)
        if bin_ is None:
            raise HTTPException(status_code=404, detail="not found")
        return bin_


@router.post("", response_model=Bin, status_code=201)
def create_bin(payload: BinCreate):
    with Session(engine) as session:
        bin_ = Bin(code=generate_code(session), **payload.model_dump())
        session.add(bin_)
        session.commit()
        session.refresh(bin_)
        return bin_


@router.patch("/{bin_id}", response_model=Bin)
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
        return bin_


@router.delete("/{bin_id}", status_code=204)
def delete_bin(bin_id: int):
    with Session(engine) as session:
        bin_ = session.get(Bin, bin_id)
        if bin_ is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(bin_)
        session.commit()
