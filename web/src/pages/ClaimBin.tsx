import { FormEvent, useState } from "react";
import { Bin, BinInput, Fullness, Location, claimBin, resolveOrCreateBinLocation } from "../api";

const FULLNESS_OPTIONS: { value: Fullness; label: string }[] = [
  { value: "empty", label: "Empty" },
  { value: "room", label: "Has room" },
  { value: "full", label: "Full" },
];

const PICKABLE_KINDS: Location["kind"][] = ["site", "zone"];

interface Props {
  bin: Bin;
  locations: Location[];
  onClaimed: (bin: Bin) => void;
  onLocationsChanged?: (locations: Location[]) => void;
}

export default function ClaimBin({ bin, locations, onClaimed, onLocationsChanged }: Props) {
  const [label, setLabel] = useState("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [stackNumber, setStackNumber] = useState("");
  const [stackPosition, setStackPosition] = useState("");
  const [fullness, setFullness] = useState<Fullness>("room");
  const [locationNote, setLocationNote] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { locationId: resolvedLocationId, locations: updatedLocations } =
        await resolveOrCreateBinLocation(
          locations,
          locationId === "" ? null : locationId,
          stackNumber,
        );
      onLocationsChanged?.(updatedLocations);
      const payload: BinInput = {
        label,
        location_id: resolvedLocationId,
        stack_position: stackPosition === "" ? null : Number(stackPosition),
        fullness,
        location_note: locationNote,
        notes,
      };
      const claimed = await claimBin(bin.id, payload);
      onClaimed(claimed);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="claim-form" onSubmit={handleSubmit}>
      <h3>Claim tote {bin.code}</h3>
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
          {locations
            .filter((loc) => PICKABLE_KINDS.includes(loc.kind))
            .map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Stack Number
        <input
          type="number"
          min={1}
          value={stackNumber}
          onChange={(e) => setStackNumber(e.target.value)}
        />
      </label>
      <label>
        Position In Stack
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
              name="claim-fullness"
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
      <button type="submit">Claim</button>
    </form>
  );
}
