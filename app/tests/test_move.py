import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def make_zone_and_stack(zone_name: str, stack_name: str) -> tuple[int, int]:
    garage_id = next(
        loc["id"] for loc in client.get("/api/locations").json() if loc["name"] == "Garage"
    )
    zone_id = client.post(
        "/api/locations", json={"name": zone_name, "kind": "zone", "parent_id": garage_id}
    ).json()["id"]
    stack_id = client.post(
        "/api/locations", json={"name": stack_name, "kind": "stack", "parent_id": zone_id}
    ).json()["id"]
    return zone_id, stack_id


def test_move_single_bin():
    _, stack_id = make_zone_and_stack("Zone A", "Stack A")
    _, other_stack_id = make_zone_and_stack("Zone B", "Stack B")
    bin_ = client.post("/api/bins", json={"label": "Movable"}).json()

    resp = client.post(
        f"/api/bins/{bin_['id']}/move",
        json={"to_location_id": other_stack_id, "to_position": 1},
    )
    assert resp.status_code == 200
    moved = resp.json()
    assert moved["location_id"] == other_stack_id
    assert moved["stack_position"] == 1


def test_move_stack_preserves_internal_order():
    _, source_stack_id = make_zone_and_stack("Zone Source", "Stack Source")
    _, dest_stack_id = make_zone_and_stack("Zone Dest", "Stack Dest")

    bottom = client.post("/api/bins", json={"label": "Bottom"}).json()
    top = client.post("/api/bins", json={"label": "Top"}).json()
    client.post(
        f"/api/locations/{source_stack_id}/reorder",
        json={"ordered_bin_ids": [bottom["id"], top["id"]]},
    )

    resp = client.post(
        f"/api/locations/{source_stack_id}/move",
        json={"to_location_id": dest_stack_id},
    )
    assert resp.status_code == 200

    bottom_after = client.get(f"/api/bins/{bottom['id']}").json()
    top_after = client.get(f"/api/bins/{top['id']}").json()
    assert bottom_after["location_id"] == dest_stack_id
    assert top_after["location_id"] == dest_stack_id
    assert bottom_after["stack_position"] == 1
    assert top_after["stack_position"] == 2
