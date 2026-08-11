import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def test_create_bin_generates_code_and_default_fullness():
    resp = client.post("/api/bins", json={"label": "Winter clothes"})
    assert resp.status_code == 201
    body = resp.json()
    assert "code" in body and len(body["code"]) == 8

    get_resp = client.get(f"/api/bins/{body['id']}")
    assert get_resp.json()["fullness"] == "room"


def test_list_bins_filters_by_location():
    loc_resp = client.post(
        "/api/locations", json={"name": "T13 Zone", "kind": "zone", "parent_id": 1}
    )
    location_id = loc_resp.json()["id"]
    bin_resp = client.post(
        "/api/bins", json={"label": "In zone", "location_id": location_id}
    )
    bin_id = bin_resp.json()["id"]

    filtered = client.get(f"/api/bins?location_id={location_id}").json()
    assert [b["id"] for b in filtered] == [bin_id]


def test_update_and_delete_bin():
    bin_id = client.post("/api/bins", json={"label": "Temp"}).json()["id"]

    patched = client.patch(f"/api/bins/{bin_id}", json={"fullness": "full"})
    assert patched.json()["fullness"] == "full"

    client.delete(f"/api/bins/{bin_id}")
    assert client.get(f"/api/bins/{bin_id}").status_code == 404
