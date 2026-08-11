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
  loanItem,
  moveBin,
  returnItem,
} from "../api";
import MoveDialog from "../components/MoveDialog";
import { navigate } from "../router";
import ClaimBin from "./ClaimBin";

interface Props {
  code: string;
}

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

  const loanedCount = items.filter((item) => item.loaned_to).length;

  return (
    <div className="items-section">
      <h3>
        Contents
        {loanedCount > 0 && (
          <span className="badge loaned">
            {loanedCount} loaned out
          </span>
        )}
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

export default function BinDetail({ code }: Props) {
  const [bin, setBin] = useState<Bin | null | undefined>(undefined);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

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
      {bin.is_buried && (
        <p className="badge buried">
          {bin.bins_on_top} tote{bin.bins_on_top === 1 ? "" : "s"} on top
        </p>
      )}
      {bin.notes && <p>Notes: {bin.notes}</p>}
      <ItemsSection binId={bin.id} />
      <button onClick={() => setShowMoveDialog(true)}>Move</button>
      {showMoveDialog && (
        <MoveDialog
          title={`Move ${bin.label || bin.code}`}
          locations={locations}
          onMove={async (toLocationId) => {
            const moved = await moveBin(bin.id, toLocationId);
            setBin(moved);
          }}
          onClose={() => setShowMoveDialog(false)}
        />
      )}
      <button onClick={() => navigate("/")}>Back to locations</button>
    </div>
  );
}
