import { FormEvent, useState } from "react";
import { Bin, BinInput, Fullness, Location, createBin, deleteBin, updateBin } from "../api";
import ItemsSection from "../components/ItemsSection";
import PhotoGrid from "../components/PhotoGrid";

const FULLNESS_OPTIONS: { value: Fullness; label: string }[] = [
  { value: "empty", label: "Empty" },
  { value: "room", label: "Has room" },
  { value: "full", label: "Full" },
];

function depthOf(locations: Location[], loc: Location): number {
  const byId = new Map(locations.map((l) => [l.id, l]));
  let depth = 0;
  let current: Location | undefined = loc;
  while (current?.parent_id != null) {
    depth += 1;
    current = byId.get(current.parent_id);
  }
  return depth;
}

function optionLabel(locations: Location[], loc: Location): string {
  const name =
    loc.kind === "stack" && loc.grid_row != null && loc.grid_col != null
      ? `R${loc.grid_row}C${loc.grid_col}`
      : loc.name;
  return `${"— ".repeat(depthOf(locations, loc))}${name}`;
}

interface Props {
  bin: Bin | null;
  locations: Location[];
  defaultLocationId: number | null;
  onCancel: () => void;
  onSaved: (bin: Bin) => void;
  onDeleted: () => void;
}

export default function BinForm({
  bin,
  locations,
  defaultLocationId,
  onCancel,
  onSaved,
  onDeleted,
}: Props) {
  const [label, setLabel] = useState(bin?.label ?? "");
  const [locationId, setLocationId] = useState<number | "">(
    bin?.location_id ?? defaultLocationId ?? "",
  );
  const [stackPosition, setStackPosition] = useState(
    bin?.stack_position != null ? String(bin.stack_position) : "",
  );
  const [fullness, setFullness] = useState<Fullness>(bin?.fullness ?? "room");
  const [locationNote, setLocationNote] = useState(bin?.location_note ?? "");
  const [notes, setNotes] = useState(bin?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedBin, setSavedBin] = useState<Bin | null>(null);

  async function handleDelete() {
    if (!bin) return;
    if (!window.confirm(`Delete "${bin.label || bin.code}"? This can't be undone.`)) {
      return;
    }
    try {
      await deleteBin(bin.id);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: BinInput = {
      label,
      location_id: locationId === "" ? null : locationId,
      stack_position: stackPosition === "" ? null : Number(stackPosition),
      fullness,
      location_note: locationNote,
      notes,
    };
    try {
      const result = bin ? await updateBin(bin.id, payload) : await createBin(payload);
      setSavedBin(result);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (savedBin) {
    return (
      <div className="bin-form">
        <h3>{bin ? "Bin updated" : "Bin created"}</h3>
        <p>{savedBin.label || savedBin.code}</p>
        <PhotoGrid binId={savedBin.id} />
        <ItemsSection binId={savedBin.id} />
        <div className="actions">
          <button type="button" onClick={() => onSaved(savedBin)}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="bin-form" onSubmit={handleSubmit}>
      <h3>{bin ? "Edit bin" : "New bin"}</h3>
      {bin && (
        <>
          <PhotoGrid binId={bin.id} />
          <ItemsSection binId={bin.id} />
        </>
      )}
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
              {optionLabel(locations, loc)}
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
      {!bin && <p className="hint">You'll be able to add photos and contents after saving.</p>}
      <div className="actions">
        <button type="submit">{bin ? "Save" : "Save & add contents"}</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {bin && (
          <button type="button" className="delete-bin" onClick={handleDelete}>
            Delete bin
          </button>
        )}
      </div>
    </form>
  );
}
