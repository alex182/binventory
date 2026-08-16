import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def get_garage_id() -> int:
    locations = client.get("/api/locations").json()
    return next(loc["id"] for loc in locations if loc["name"] == "Garage")


def get_storage_unit_id() -> int:
    locations = client.get("/api/locations").json()
    return next(loc["id"] for loc in locations if loc["name"] == "Storage Unit")


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


def test_grid_number_order_update_ok():
    site_id = get_storage_unit_id()
    resp = client.patch(
        f"/api/locations/{site_id}", json={"grid_number_order": "left_to_right"}
    )
    assert resp.status_code == 200
    assert resp.json()["grid_number_order"] == "left_to_right"


def test_grid_number_order_invalid_value_rejected():
    site_id = get_storage_unit_id()
    resp = client.patch(
        f"/api/locations/{site_id}", json={"grid_number_order": "sideways"}
    )
    assert resp.status_code == 422


def test_grid_number_order_rejected_on_non_site():
    garage_id = get_garage_id()
    zone_id = client.post(
        "/api/locations",
        json={"name": "Grid Order Zone", "kind": "zone", "parent_id": garage_id},
    ).json()["id"]
    resp = client.patch(
        f"/api/locations/{zone_id}", json={"grid_number_order": "front_to_back"}
    )
    assert resp.status_code == 409


def test_location_bins_ordered_top_to_bottom_with_is_buried():
    garage_id = get_garage_id()
    zone_id = client.post(
        "/api/locations",
        json={"name": "Reverse Zone", "kind": "zone", "parent_id": garage_id},
    ).json()["id"]
    stack_id = client.post(
        "/api/locations",
        json={"name": "Reverse Stack", "kind": "stack", "parent_id": zone_id},
    ).json()["id"]

    bottom = client.post(
        "/api/bins",
        json={"label": "Bottom", "location_id": stack_id, "stack_position": 1},
    ).json()
    top = client.post(
        "/api/bins",
        json={"label": "Top", "location_id": stack_id, "stack_position": 2},
    ).json()
    client.post(f"/api/bins/{top['id']}/items", json={"name": "widget"})

    resp = client.get(f"/api/locations/{stack_id}/bins")
    assert resp.status_code == 200
    bins = resp.json()
    assert [b["id"] for b in bins] == [top["id"], bottom["id"]]
    assert bins[0]["is_buried"] is False
    assert bins[1]["is_buried"] is True
    assert bins[0]["item_names"] == ["widget"]
    assert bins[1]["item_names"] == []


def test_location_bins_include_descendants_and_stay_grouped_by_stack():
    garage_id = get_garage_id()
    zone_id = client.post(
        "/api/locations",
        json={"name": "Descendant Zone", "kind": "zone", "parent_id": garage_id},
    ).json()["id"]
    stack_a = client.post(
        "/api/locations",
        json={"name": "Stack A", "kind": "stack", "parent_id": zone_id},
    ).json()["id"]
    stack_b = client.post(
        "/api/locations",
        json={"name": "Stack B", "kind": "stack", "parent_id": zone_id},
    ).json()["id"]

    in_a = client.post(
        "/api/bins",
        json={"label": "In A", "location_id": stack_a, "stack_position": 5},
    ).json()
    in_b = client.post(
        "/api/bins",
        json={"label": "In B", "location_id": stack_b, "stack_position": 1},
    ).json()
    client.post(f"/api/bins/{in_b['id']}/items", json={"name": "widget"})

    resp = client.get(f"/api/locations/{zone_id}/bins")
    assert resp.status_code == 200
    ids = {b["id"] for b in resp.json()}
    assert ids == {in_a["id"], in_b["id"]}
    # A high stack_position in one stack must not mark a bin in a different
    # stack as buried underneath it.
    assert all(b["is_buried"] is False for b in resp.json())

    empty_resp = client.get(f"/api/locations/{zone_id}/bins?empty=true")
    assert [b["id"] for b in empty_resp.json()] == [in_a["id"]]
