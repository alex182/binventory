import { FormEvent, useEffect, useState } from "react";
import {
  Bin,
  BinInput,
  FULLNESS_OPTIONS,
  Fullness,
  Location,
  MoveLogEntry,
  binAddress,
  deleteBin,
  getBinByCode,
  getBinHistory,
  listLocations,
  locationOptionLabel,
  moveBin,
  updateBin,
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

  const [label, setLabel] = useState("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [stackPosition, setStackPosition] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [fullness, setFullness] = useState<Fullness>("room");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBin(undefined);
    Promise.all([getBinByCode(code), listLocations()]).then(([b, locs]) => {
      setBin(b);
      setLocations(locs);
      if (b) {
        setLabel(b.label);
        setLocationId(b.location_id ?? "");
        setStackPosition(b.stack_position != null ? String(b.stack_position) : "");
        setLocationNote(b.location_note);
        setFullness(b.fullness);
        setNotes(b.notes);
      }
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

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!bin) return;
    setError(null);
    setSaving(true);
    const payload: BinInput = {
      label,
      location_id: locationId === "" ? null : locationId,
      stack_position: stackPosition === "" ? null : Number(stackPosition),
      fullness,
      location_note: locationNote,
      notes,
    };
    try {
      const updated = await updateBin(bin.id, payload);
      setBin(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bin-detail">
      <h2>{bin.label}</h2>
      <p className="address">{binAddress(locations, bin)}</p>
      <p>Code: {bin.code}</p>
      {bin.is_buried && (
        <p className="badge buried">
          {bin.bins_on_top} tote{bin.bins_on_top === 1 ? "" : "s"} on top
        </p>
      )}
      <PhotoGrid binId={bin.id} />
      <ItemsSection binId={bin.id} />

      <form className="bin-form" onSubmit={handleSave}>
        <h3>Edit bin</h3>
        <label>
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
        <label>
          Location
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">— none —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {locationOptionLabel(locations, loc)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stack position
          <input
            type="number"
            min={1}
            value={stackPosition}
            onChange={(e) => setStackPosition(e.target.value)}
          />
        </label>
        <label>
          Location note
          <input
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            placeholder="e.g. behind the water heater"
          />
        </label>
        <fieldset>
          <legend>Fullness</legend>
          {FULLNESS_OPTIONS.map((opt) => (
            <label key={opt.value}>
              <input
                type="radio"
                name="fullness"
                value={opt.value}
                checked={fullness === opt.value}
                onChange={() => setFullness(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" disabled={saving}>
            Save
          </button>
          <button type="button" onClick={() => setShowMoveDialog(true)}>
            Move
          </button>
          <button
            type="button"
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
      </form>

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
    </div>
  );
}
