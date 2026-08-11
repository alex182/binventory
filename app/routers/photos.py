import io
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from sqlmodel import Session

from config import DATA_DIR
from db import engine
from models import Bin, Photo

router = APIRouter(tags=["photos"])

PHOTOS_DIR = Path(DATA_DIR) / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

THUMB_SIZE = (256, 256)


def thumb_filename(filename: str) -> str:
    return f"thumb_{filename}"


@router.post("/api/bins/{bin_id}/photos", response_model=Photo, status_code=201)
async def upload_photo(bin_id: int, file: UploadFile = File(...)):
    with Session(engine) as session:
        if session.get(Bin, bin_id) is None:
            raise HTTPException(status_code=404, detail="bin not found")

    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents))
        image.load()
    except Exception as exc:
        raise HTTPException(status_code=422, detail="invalid image") from exc

    ext = (image.format or "PNG").lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    (PHOTOS_DIR / filename).write_bytes(contents)

    thumb = image.copy()
    thumb.thumbnail(THUMB_SIZE)
    thumb.save(PHOTOS_DIR / thumb_filename(filename))

    with Session(engine) as session:
        photo = Photo(bin_id=bin_id, filename=filename)
        session.add(photo)
        session.commit()
        session.refresh(photo)
        return photo


@router.get("/api/photos/{photo_id}")
def get_photo(photo_id: int):
    with Session(engine) as session:
        photo = session.get(Photo, photo_id)
        if photo is None:
            raise HTTPException(status_code=404, detail="not found")
        filename = photo.filename
    path = PHOTOS_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="file missing")
    return FileResponse(path)


@router.get("/api/photos/{photo_id}/thumb")
def get_photo_thumb(photo_id: int):
    with Session(engine) as session:
        photo = session.get(Photo, photo_id)
        if photo is None:
            raise HTTPException(status_code=404, detail="not found")
        filename = photo.filename
    path = PHOTOS_DIR / thumb_filename(filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="file missing")
    return FileResponse(path)


@router.delete("/api/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int):
    with Session(engine) as session:
        photo = session.get(Photo, photo_id)
        if photo is None:
            raise HTTPException(status_code=404, detail="not found")
        filename = photo.filename
        session.delete(photo)
        session.commit()
    (PHOTOS_DIR / filename).unlink(missing_ok=True)
    (PHOTOS_DIR / thumb_filename(filename)).unlink(missing_ok=True)
