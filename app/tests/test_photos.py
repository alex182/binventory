import io
import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from pathlib import Path  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from config import DATA_DIR  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


def make_png_bytes() -> bytes:
    img = Image.new("RGB", (10, 10), color="red")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def upload_photo(bin_id: int) -> dict:
    resp = client.post(
        f"/api/bins/{bin_id}/photos",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
    )
    assert resp.status_code == 201
    return resp.json()


def test_upload_photo_persists_original_and_thumbnail():
    bin_ = client.post("/api/bins", json={"label": "Photo bin"}).json()
    photo = upload_photo(bin_["id"])
    assert "id" in photo

    photos_dir = Path(DATA_DIR) / "photos"
    assert (photos_dir / photo["filename"]).is_file()
    assert (photos_dir / f"thumb_{photo['filename']}").is_file()

    assert client.get(f"/api/photos/{photo['id']}").status_code == 200
    assert client.get(f"/api/photos/{photo['id']}/thumb").status_code == 200


def test_delete_photo_removes_files():
    bin_ = client.post("/api/bins", json={"label": "Photo bin 2"}).json()
    photo = upload_photo(bin_["id"])

    photos_dir = Path(DATA_DIR) / "photos"
    original_path = photos_dir / photo["filename"]
    thumb_path = photos_dir / f"thumb_{photo['filename']}"
    assert original_path.is_file()

    client.delete(f"/api/photos/{photo['id']}")
    assert not original_path.is_file()
    assert not thumb_path.is_file()
    assert client.get(f"/api/photos/{photo['id']}").status_code == 404
