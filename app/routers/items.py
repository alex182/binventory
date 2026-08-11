from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import engine
from models import Bin, Item

router = APIRouter(tags=["items"])


class ItemCreate(BaseModel):
    name: str
    qty: int = 1
    notes: str = ""


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    qty: Optional[int] = None
    notes: Optional[str] = None


class LoanPayload(BaseModel):
    loaned_to: str


@router.get("/api/bins/{bin_id}/items", response_model=list[Item])
def list_items(bin_id: int):
    with Session(engine) as session:
        if session.get(Bin, bin_id) is None:
            raise HTTPException(status_code=404, detail="bin not found")
        return session.exec(select(Item).where(Item.bin_id == bin_id)).all()


@router.post("/api/bins/{bin_id}/items", response_model=Item, status_code=201)
def create_item(bin_id: int, payload: ItemCreate):
    with Session(engine) as session:
        if session.get(Bin, bin_id) is None:
            raise HTTPException(status_code=404, detail="bin not found")
        item = Item(bin_id=bin_id, **payload.model_dump())
        session.add(item)
        session.commit()
        session.refresh(item)
        return item


@router.patch("/api/items/{item_id}", response_model=Item)
def update_item(item_id: int, payload: ItemUpdate):
    with Session(engine) as session:
        item = session.get(Item, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        session.add(item)
        session.commit()
        session.refresh(item)
        return item


@router.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: int):
    with Session(engine) as session:
        item = session.get(Item, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(item)
        session.commit()


@router.post("/api/items/{item_id}/loan", response_model=Item)
def loan_item(item_id: int, payload: LoanPayload):
    with Session(engine) as session:
        item = session.get(Item, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="not found")
        item.loaned_to = payload.loaned_to
        item.loaned_at = datetime.now(timezone.utc)
        session.add(item)
        session.commit()
        session.refresh(item)
        return item


@router.post("/api/items/{item_id}/return", response_model=Item)
def return_item(item_id: int):
    with Session(engine) as session:
        item = session.get(Item, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="not found")
        item.loaned_to = None
        item.loaned_at = None
        session.add(item)
        session.commit()
        session.refresh(item)
        return item
