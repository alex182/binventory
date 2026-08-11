import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def make_stack() -> int:
    garage_id = next(
        loc["id"] for loc in client.get("/api/locations").json() if loc["name"] == "Garage"
    )
    zone_id = client.post(
        "/api/locations", json={"name": "Stack Zone", "kind": "zone", "parent_id": garage_id}
    ).json()["id"]
    return client.post(
        "/api/locations", json={"name": "Stack A", "kind": "stack", "parent_id": zone_id}
    ).json()["id"]


def test_reorder_assigns_bottom_to_top_positions():
    stack_id = make_stack()
    bottom = client.post("/api/bins", json={"label": "Bottom bin"}).json()
    top = client.post("/api/bins", json={"label": "Top bin"}).json()

    resp = client.post(
        f"/api/locations/{stack_id}/reorder",
        json={"ordered_bin_ids": [bottom["id"], top["id"]]},
    )
    assert resp.status_code == 200

    bottom_after = client.get(f"/api/bins/{bottom['id']}").json()
    top_after = client.get(f"/api/bins/{top['id']}").json()
    assert bottom_after["stack_position"] == 1
    assert top_after["stack_position"] == 2
    assert bottom_after["location_id"] == stack_id
    assert top_after["location_id"] == stack_id
