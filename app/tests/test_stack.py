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


def test_is_buried_flips_with_order():
    stack_id = make_stack()
    a = client.post("/api/bins", json={"label": "A"}).json()
    b = client.post("/api/bins", json={"label": "B"}).json()

    client.post(
        f"/api/locations/{stack_id}/reorder",
        json={"ordered_bin_ids": [a["id"], b["id"]]},
    )
    a_after = client.get(f"/api/bins/{a['id']}").json()
    b_after = client.get(f"/api/bins/{b['id']}").json()
    assert a_after["is_buried"] is True
    assert a_after["bins_on_top"] == 1
    assert b_after["is_buried"] is False
    assert b_after["bins_on_top"] == 0

    # Flip the order: B is now on the bottom, A on top.
    client.post(
        f"/api/locations/{stack_id}/reorder",
        json={"ordered_bin_ids": [b["id"], a["id"]]},
    )
    a_after2 = client.get(f"/api/bins/{a['id']}").json()
    b_after2 = client.get(f"/api/bins/{b['id']}").json()
    assert a_after2["is_buried"] is False
    assert b_after2["is_buried"] is True
    assert b_after2["bins_on_top"] == 1
