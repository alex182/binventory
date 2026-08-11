import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def test_loan_and_return_item():
    bin_ = client.post("/api/bins", json={"label": "Tools"}).json()
    item = client.post(f"/api/bins/{bin_['id']}/items", json={"name": "drill"}).json()

    loan_resp = client.post(f"/api/items/{item['id']}/loan", json={"loaned_to": "Alex"})
    assert loan_resp.status_code == 200
    loaned = loan_resp.json()
    assert loaned["loaned_to"] == "Alex"
    assert loaned["loaned_at"] is not None

    loans = client.get("/api/loans").json()
    assert any(loan["item_id"] == item["id"] and loan["loaned_to"] == "Alex" for loan in loans)

    return_resp = client.post(f"/api/items/{item['id']}/return")
    assert return_resp.status_code == 200
    returned = return_resp.json()
    assert returned["loaned_to"] is None
    assert returned["loaned_at"] is None

    loans_after = client.get("/api/loans").json()
    assert all(loan["item_id"] != item["id"] for loan in loans_after)
