import { FormEvent, useEffect, useState } from "react";
import {
  Bin,
  Item,
  Location,
  binAddress,
  createItem,
  deleteItem,
  getBinByCode,
  listItems,
  listLocations,
} from "../api";
import { navigate } from "../router";
import ClaimBin from "./ClaimBin";

interface Props {
  code: string;
}

function ItemsSection({ binId }: { binId: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");

  function refresh() {
    listItems(binId).then(setItems);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createItem(binId, { name, qty: Number(qty) || 1, notes: "" });
    setName("");
    setQty("1");
    refresh();
  }

  async function handleDelete(id: number) {
    await deleteItem(id);
    refresh();
  }

  return (
    <div className="items-section">
      <h3>Contents</h3>
      <ul className="item-list">
        {items.map((item) => (
          <li key={item.id}>
            {item.name} × {item.qty}
            <button onClick={() => handleDelete(item.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} className="add-item-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
        <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        <button type="submit">Add item</button>
      </form>
    </div>
  );
}

export default function BinDetail({ code }: Props) {
  const [bin, setBin] = useState<Bin | null | undefined>(undefined);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    setBin(undefined);
    Promise.all([getBinByCode(code), listLocations()]).then(([b, locs]) => {
      setBin(b);
      setLocations(locs);
    });
  }, [code]);

  if (bin === undefined) {
    return <p>Loading…</p>;
  }

  if (bin === null) {
    return (
      <div className="bin-detail not-found">
        <p>No bin found for code "{code}".</p>
        <button onClick={() => navigate("/")}>Create a new bin</button>
      </div>
    );
  }

  if (bin.status === "blank") {
    return <ClaimBin bin={bin} locations={locations} onClaimed={setBin} />;
  }

  return (
    <div className="bin-detail">
      <h2>{bin.label}</h2>
      <p className="address">{binAddress(locations, bin)}</p>
      <p>Code: {bin.code}</p>
      <p>Fullness: {bin.fullness}</p>
      {bin.notes && <p>Notes: {bin.notes}</p>}
      <ItemsSection binId={bin.id} />
      <button onClick={() => navigate("/")}>Back to locations</button>
    </div>
  );
}
