from fastapi import APIRouter
from sqlmodel import Session, select

from db import engine
from models import Bin, Item

router = APIRouter(prefix="/api/loans", tags=["loans"])


@router.get("")
def list_loans():
    with Session(engine) as session:
        items = session.exec(select(Item).where(Item.loaned_to.is_not(None))).all()
        bins_by_id = {b.id: b for b in session.exec(select(Bin)).all()}

    result = []
    for item in items:
        bin_ = bins_by_id.get(item.bin_id)
        result.append(
            {
                "item_id": item.id,
                "item_name": item.name,
                "bin_id": item.bin_id,
                "bin_label": bin_.label if bin_ else None,
                "bin_code": bin_.code if bin_ else None,
                "loaned_to": item.loaned_to,
                "loaned_at": item.loaned_at,
            }
        )
    return result
