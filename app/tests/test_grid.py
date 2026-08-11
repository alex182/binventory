import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def get_storage_unit_id() -> int:
    locations = client.get("/api/locations").json()
    return next(loc["id"] for loc in locations if loc["name"] == "Storage Unit")


def test_generate_and_fetch_grid():
    site_id = get_storage_unit_id()

    resp = client.post(f"/api/locations/{site_id}/grid", json={"rows": 3, "cols": 3})
    assert resp.status_code == 200
    created = resp.json()
    assert len(created) == 9
    assert all(cell["grid_row"] is not None for cell in created)

    grid = client.get(f"/api/locations/{site_id}/grid").json()
    assert grid["rows"] == 3
    assert grid["cols"] == 3
    assert len(grid["cells"]) == 9

    # Regenerating the same size doesn't duplicate cells.
    client.post(f"/api/locations/{site_id}/grid", json={"rows": 3, "cols": 3})
    grid_again = client.get(f"/api/locations/{site_id}/grid").json()
    assert len(grid_again["cells"]) == 9


def test_grid_cell_reflects_bin_count():
    site_id = get_storage_unit_id()
    client.post(f"/api/locations/{site_id}/grid", json={"rows": 1, "cols": 1})
    grid = client.get(f"/api/locations/{site_id}/grid").json()
    stack_id = grid["cells"][0]["stack_id"]

    client.post(
        "/api/bins",
        json={"label": "Grid bin", "location_id": stack_id, "stack_position": 1},
    )

    grid_after = client.get(f"/api/locations/{site_id}/grid").json()
    cell = next(c for c in grid_after["cells"] if c["stack_id"] == stack_id)
    assert cell["bin_count"] == 1
    assert cell["top_bin"]["label"] == "Grid bin"
