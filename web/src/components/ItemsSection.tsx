import { FormEvent, useEffect, useState } from "react";
import { Item, createItem, deleteItem, listItems, loanItem, returnItem } from "../api";

function LoanControl({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [borrower, setBorrower] = useState("");

  if (item.loaned_to) {
    return (
      <span className="loan-control">
        <span className="badge loaned">Loaned to {item.loaned_to}</span>
        <button
          onClick={async () => {
            await returnItem(item.id);
            onChanged();
          }}
        >
          Return
        </button>
      </span>
    );
  }

  return (
    <span className="loan-control">
      <input
        placeholder="Borrower"
        value={borrower}
        onChange={(e) => setBorrower(e.target.value)}
      />
      <button
        disabled={!borrower.trim()}
        onClick={async () => {
          await loanItem(item.id, borrower);
          setBorrower("");
          onChanged();
        }}
      >
        Loan
      </button>
    </span>
  );
}

export default function ItemsSection({ binId }: { binId: number }) {
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

  const loanedCount = items.filter((item) => item.loaned_to).length;

  return (
    <div className="items-section">
      <h3>
        Contents
        {loanedCount > 0 && <span className="badge loaned">{loanedCount} loaned out</span>}
      </h3>
      <ul className="item-list">
        {items.map((item) => (
          <li key={item.id}>
            {item.name} × {item.qty}
            <LoanControl item={item} onChanged={refresh} />
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
