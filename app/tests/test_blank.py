import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def test_batch_create_blank_bins():
    resp = client.post("/api/bins/batch", json={"count": 5})
    assert resp.status_code == 200
    bins = resp.json()
    assert len(bins) == 5
    assert all(b["status"] == "blank" for b in bins)


def test_claim_blank_bin_and_default_list_excludes_blanks():
    blank = client.post("/api/bins/batch", json={"count": 1}).json()[0]

    listed = client.get("/api/bins/blank").json()
    assert any(b["id"] == blank["id"] for b in listed)

    claim_resp = client.post(
        f"/api/bins/{blank['id']}/claim",
        json={"label": "Camping gear", "location_note": "Garage, top shelf"},
    )
    assert claim_resp.status_code == 200
    claimed = claim_resp.json()
    assert claimed["status"] == "active"
    assert claimed["code"] == blank["code"]

    default_list = client.get("/api/bins").json()
    assert all(b["status"] == "active" for b in default_list)


def test_claim_already_active_bin_is_conflict():
    bin_ = client.post("/api/bins", json={"label": "Already active"}).json()
    resp = client.post(f"/api/bins/{bin_['id']}/claim", json={"label": "x"})
    assert resp.status_code == 409
