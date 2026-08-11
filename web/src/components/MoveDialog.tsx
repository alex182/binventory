import { FormEvent, useState } from "react";
import { Location } from "../api";

interface Props {
  title: string;
  locations: Location[];
  onMove: (toLocationId: number) => Promise<void>;
  onClose: () => void;
}

export default function MoveDialog({ title, locations, onMove, onClose }: Props) {
  const [targetId, setTargetId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (targetId === "") return;
    setBusy(true);
    try {
      await onMove(targetId);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="move-dialog" onSubmit={handleSubmit}>
      <h3>{title}</h3>
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value === "" ? "" : Number(e.target.value))}
      >
        <option value="">— choose a location —</option>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
      <div className="actions">
        <button type="submit" disabled={targetId === "" || busy}>
          Move
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
