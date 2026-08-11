import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def test_export_shape():
    resp = client.get("/api/export")
    assert resp.status_code == 200
    dump = resp.json()
    assert "bins" in dump and "items" in dump


def test_export_then_import_round_trips():
    bin_ = client.post("/api/bins", json={"label": "Roundtrip"}).json()
    client.post(f"/api/bins/{bin_['id']}/items", json={"name": "widget", "qty": 3})

    dump = client.get("/api/export").json()

    resp = client.post("/api/import", json=dump)
    assert resp.status_code == 200

    bins_after = client.get("/api/bins", params={"include_blank": "true"}).json()
    assert any(b["id"] == bin_["id"] and b["label"] == "Roundtrip" for b in bins_after)

    items_after = client.get(f"/api/bins/{bin_['id']}/items").json()
    assert any(i["name"] == "widget" and i["qty"] == 3 for i in items_after)

    sites = [loc["name"] for loc in client.get("/api/locations").json() if loc["kind"] == "site"]
    assert sorted(sites) == ["Basement", "Garage", "Storage Unit"]


def test_export_csv_has_header_and_row():
    client.post("/api/bins", json={"label": "CSV bin"})
    resp = client.get("/api/export.csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.splitlines()
    assert lines[0] == "bin_code,bin_label,location_path,item_name,item_qty,item_notes"
    assert any("CSV bin" in line for line in lines[1:])
