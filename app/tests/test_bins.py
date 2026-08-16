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


def test_get_bin_by_code():
    bin_ = client.post("/api/bins", json={"label": "Findable"}).json()

    resp = client.get(f"/api/bins/by-code/{bin_['code']}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    assert client.get("/api/bins/by-code/zzzznope").status_code == 404


def test_bin_includes_item_names():
    bin_id = client.post("/api/bins", json={"label": "Contents test"}).json()["id"]
    client.post(f"/api/bins/{bin_id}/items", json={"name": "widget"})
    client.post(f"/api/bins/{bin_id}/items", json={"name": "gadget"})

    detail = client.get(f"/api/bins/{bin_id}").json()
    assert sorted(detail["item_names"]) == ["gadget", "widget"]

    listed = next(b for b in client.get("/api/bins").json() if b["id"] == bin_id)
    assert sorted(listed["item_names"]) == ["gadget", "widget"]


def test_empty_filter():
    empty_bin = client.post("/api/bins", json={"label": "Empty bin"}).json()
    full_bin = client.post("/api/bins", json={"label": "Full bin"}).json()
    client.post(f"/api/bins/{full_bin['id']}/items", json={"name": "widget"})

    empty_ids = {b["id"] for b in client.get("/api/bins?empty=true").json()}
    assert empty_bin["id"] in empty_ids
    assert full_bin["id"] not in empty_ids

    nonempty_ids = {b["id"] for b in client.get("/api/bins?empty=false").json()}
    assert full_bin["id"] in nonempty_ids
    assert empty_bin["id"] not in nonempty_ids
