import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def create_bin() -> dict:
    return client.post("/api/bins", json={"label": "Items bin"}).json()


def test_create_and_list_items():
    bin_ = create_bin()
    resp = client.post(f"/api/bins/{bin_['id']}/items", json={"name": "tent", "qty": 1})
    assert resp.status_code == 201
    assert "id" in resp.json()

    items = client.get(f"/api/bins/{bin_['id']}/items").json()
    assert len(items) == 1
    assert items[0]["name"] == "tent"


def test_update_and_delete_item_does_not_change_bin_code():
    bin_ = create_bin()
    item = client.post(f"/api/bins/{bin_['id']}/items", json={"name": "tent"}).json()

    client.patch(f"/api/items/{item['id']}", json={"qty": 2})
    updated = client.get(f"/api/bins/{bin_['id']}/items").json()
    assert updated[0]["qty"] == 2

    unchanged_bin = client.get(f"/api/bins/{bin_['id']}").json()
    assert unchanged_bin["code"] == bin_["code"]

    client.delete(f"/api/items/{item['id']}")
    assert client.get(f"/api/bins/{bin_['id']}/items").json() == []
