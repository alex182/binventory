import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def test_typo_tolerant_search_finds_item_via_bin():
    bin_ = client.post("/api/bins", json={"label": "Camping gear"}).json()
    client.post(f"/api/bins/{bin_['id']}/items", json={"name": "tent", "qty": 1})

    resp = client.get("/api/search", params={"q": "tnet"})
    assert resp.status_code == 200
    results = resp.json()
    assert any(
        "tent" in r["label"].lower() or r["matched_field"] == "item" for r in results
    )
    assert any(r["bin_id"] == bin_["id"] for r in results)


def test_substring_search_matches_label():
    bin_ = client.post("/api/bins", json={"label": "Winter clothes"}).json()

    resp = client.get("/api/search", params={"q": "winter"})
    results = resp.json()
    assert any(r["bin_id"] == bin_["id"] and r["matched_field"] == "label" for r in results)


def test_short_query_falls_back_to_prefix_match():
    bin_ = client.post("/api/bins", json={"label": "Zithers"}).json()

    resp = client.get("/api/search", params={"q": "zi"})
    results = resp.json()
    assert any(r["bin_id"] == bin_["id"] for r in results)


def test_location_path_included_for_placed_bin():
    garage_id = next(
        loc["id"] for loc in client.get("/api/locations").json() if loc["name"] == "Garage"
    )
    bin_ = client.post(
        "/api/bins",
        json={"label": "Rakes", "location_id": garage_id, "location_note": "by the door"},
    ).json()

    resp = client.get("/api/search", params={"q": "rakes"})
    result = next(r for r in resp.json() if r["bin_id"] == bin_["id"])
    assert result["location_path"] == "Garage · by the door"
