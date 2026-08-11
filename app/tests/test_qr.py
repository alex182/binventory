import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ["BASE_URL"] = "https://bins.example.com"

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def create_bin() -> dict:
    return client.post("/api/bins", json={"label": "QR bin"}).json()


def test_qr_svg_contains_code_url():
    bin_ = create_bin()
    resp = client.get(f"/api/bins/{bin_['id']}/qr.svg")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in resp.text.lower()


def test_qr_png_is_a_png():
    bin_ = create_bin()
    resp = client.get(f"/api/bins/{bin_['id']}/qr.png")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_qr_404_for_unknown_bin():
    resp = client.get("/api/bins/999999/qr.png")
    assert resp.status_code == 404
