import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def get_garage_id() -> int:
    locations = client.get("/api/locations").json()
    return next(loc["id"] for loc in locations if loc["name"] == "Garage")


def test_create_zone_under_site_ok():
    garage_id = get_garage_id()
    resp = client.post(
        "/api/locations",
        json={"name": "Shelf A", "kind": "zone", "parent_id": garage_id},
    )
    assert resp.status_code == 201
    assert "id" in resp.json()


def test_slot_directly_under_site_is_conflict():
    garage_id = get_garage_id()
    resp = client.post(
        "/api/locations",
        json={"name": "bad", "kind": "slot", "parent_id": garage_id},
    )
    assert resp.status_code == 409


def test_grid_fields_rejected_off_stack():
    garage_id = get_garage_id()
    resp = client.post(
        "/api/locations",
        json={
            "name": "Shelf B",
            "kind": "zone",
            "parent_id": garage_id,
            "grid_row": 1,
        },
    )
    assert resp.status_code == 409


def test_tree_endpoint_nests_children():
    garage_id = get_garage_id()
    client.post(
        "/api/locations",
        json={"name": "Shelf C", "kind": "zone", "parent_id": garage_id},
    )
    tree = client.get("/api/locations/tree").json()
    garage_node = next(node for node in tree if node["name"] == "Garage")
    assert any(child["name"] == "Shelf C" for child in garage_node["children"])
