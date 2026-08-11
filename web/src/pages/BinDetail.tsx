import { useEffect, useState } from "react";
import {
  Bin,
  Location,
  MoveLogEntry,
  binAddress,
  deleteBin,
  getBinByCode,
  getBinHistory,
  listLocations,
  moveBin,
} from "../api";
import ItemsSection from "../components/ItemsSection";
import MoveDialog from "../components/MoveDialog";
import PhotoGrid from "../components/PhotoGrid";
import { navigate } from "../router";
import ClaimBin from "./ClaimBin";

interface Props {
  code: string;
}

function HistorySection({ binId, refreshToken }: { binId: number; refreshToken: number }) {
  const [history, setHistory] = useState<MoveLogEntry[]>([]);

  useEffect(() => {
    getBinHistory(binId).then(setHistory);
  }, [binId, refreshToken]);

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="history-section">
      <h3>History</h3>
      <ul className="history-list">
        {history.map((entry) => (
          <li key={entry.id}>
            {entry.from_location_name ?? "—"} → {entry.to_location_name ?? "—"}
            <span className="history-date">{new Date(entry.moved_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BinDetail({ code }: Props) {
  const [bin, setBin] = useState<Bin | null | undefined>(undefined);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

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
      <PhotoGrid binId={bin.id} />
      <ItemsSection binId={bin.id} />
      <button onClick={() => setShowMoveDialog(true)}>Move</button>
      {showMoveDialog && (
        <MoveDialog
          title={`Move ${bin.label || bin.code}`}
          locations={locations}
          onMove={async (toLocationId) => {
            const moved = await moveBin(bin.id, toLocationId);
            setBin(moved);
            setHistoryRefreshToken((t) => t + 1);
          }}
          onClose={() => setShowMoveDialog(false)}
        />
      )}
      <HistorySection binId={bin.id} refreshToken={historyRefreshToken} />
      <button onClick={() => navigate("/")}>Back to locations</button>
      <button
        className="delete-bin"
        onClick={async () => {
          if (!window.confirm(`Delete "${bin.label || bin.code}"? This can't be undone.`)) {
            return;
          }
          await deleteBin(bin.id);
          navigate("/");
        }}
      >
        Delete bin
      </button>
    </div>
  );
}
