import { FormEvent, useState } from "react";
import {
  Bin,
  BinInput,
  FULLNESS_OPTIONS,
  Fullness,
  Location,
  createBin,
  locationOptionLabel,
} from "../api";

interface Props {
  locations: Location[];
  defaultLocationId: number | null;
  onCancel: () => void;
  onSaved: (bin: Bin) => void;
}

export default function BinForm({ locations, defaultLocationId, onCancel, onSaved }: Props) {
  const [label, setLabel] = useState("");
  const [locationId, setLocationId] = useState<number | "">(defaultLocationId ?? "");
  const [stackPosition, setStackPosition] = useState("");
  const [fullness, setFullness] = useState<Fullness>("room");
  const [locationNote, setLocationNote] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      const result = await createBin(payload);
      onSaved(result);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="bin-form" onSubmit={handleSubmit}>
      <h3>New bin</h3>
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
      <p className="hint">You'll be able to add photos and contents after saving.</p>
      <div className="actions">
        <button type="submit">Save & add contents</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
