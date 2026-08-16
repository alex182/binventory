import { useEffect, useState } from "react";
import {
  Bin,
  Location,
  batchCreateBins,
  binAddress,
  listBins,
  listLocations,
  locationPath,
} from "../api";
import "./PrintSheet.css";

const LABELS_PER_SHEET = 30;
const OFFSET_X_KEY = "binventory-print-offset-x";
const OFFSET_Y_KEY = "binventory-print-offset-y";

function loadOffset(key: string, fallback: number): number {
  const stored = localStorage.getItem(key);
  if (stored === null) return fallback;
  const value = Number(stored);
  return Number.isFinite(value) ? value : fallback;
}

interface LabelInstance {
  bin: Bin;
  key: string;
}

interface LocationGroup {
  key: string;
  label: string;
  bins: Bin[];
}

function groupBinsByLocation(bins: Bin[], locations: Location[]): LocationGroup[] {
  const blank: Bin[] = [];
  const byLocation = new Map<number | null, Bin[]>();
  for (const bin of bins) {
    if (bin.status === "blank") {
      blank.push(bin);
      continue;
    }
    const list = byLocation.get(bin.location_id) ?? [];
    list.push(bin);
    byLocation.set(bin.location_id, list);
  }

  const locationGroups = [...byLocation.entries()].map(([locationId, groupBins]) => ({
    key: String(locationId),
    label: locationId != null ? locationPath(locations, locationId) : "No location assigned",
    bins: groupBins,
  }));
  locationGroups.sort((a, b) => a.label.localeCompare(b.label));

  const groups: LocationGroup[] = [];
  if (blank.length > 0) {
    groups.push({ key: "blank", label: "Unclaimed (blank)", bins: blank });
  }
  return [...groups, ...locationGroups];
}

export default function PrintSheet() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copies, setCopies] = useState(3);
  const [skip, setSkip] = useState(0);
  const [batchCount, setBatchCount] = useState(10);
  const [offsetX, setOffsetX] = useState(() => loadOffset(OFFSET_X_KEY, -0.75));
  const [offsetY, setOffsetY] = useState(() => loadOffset(OFFSET_Y_KEY, -0.2));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function refreshBins() {
    listBins({ include_blank: true }).then(setBins);
  }

  useEffect(() => {
    refreshBins();
    listLocations().then(setLocations);
  }, []);

  async function handleBatchGenerate() {
    const created = await batchCreateBins(batchCount);
    refreshBins();
    setSelected((prev) => {
      const next = new Set(prev);
      for (const bin of created) next.add(bin.id);
      return next;
    });
  }

  function updateOffsetX(value: number) {
    setOffsetX(value);
    localStorage.setItem(OFFSET_X_KEY, String(value));
  }

  function updateOffsetY(value: number) {
    setOffsetY(value);
    localStorage.setItem(OFFSET_Y_KEY, String(value));
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroupExpanded(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroupSelected(group: LocationGroup, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const bin of group.bins) {
        if (checked) next.add(bin.id);
        else next.delete(bin.id);
      }
      return next;
    });
  }

  const groups = groupBinsByLocation(bins, locations);
  const selectedBins = bins.filter((b) => selected.has(b.id));

  const labels: LabelInstance[] = [];
  for (const bin of selectedBins) {
    for (let i = 0; i < copies; i++) {
      labels.push({ bin, key: `${bin.id}-${i}` });
    }
  }

  const skipCount = Math.min(skip, LABELS_PER_SHEET - 1);
  const slots: (LabelInstance | null)[] = [
    ...Array<null>(skipCount).fill(null),
    ...labels,
  ];

  const sheets: (LabelInstance | null)[][] = [];
  for (let i = 0; i < slots.length; i += LABELS_PER_SHEET) {
    sheets.push(slots.slice(i, i + LABELS_PER_SHEET));
  }

  return (
    <div className="print-sheet-page">
      <div className="controls no-print">
        <h2>Print label sheets</h2>
        <div className="batch-generate">
          <label>
            Generate blank codes
            <input
              type="number"
              min={1}
              value={batchCount}
              onChange={(e) => setBatchCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <button type="button" onClick={handleBatchGenerate}>
            Generate
          </button>
        </div>
        <label>
          Copies per bin
          <input
            type="number"
            min={1}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label>
          Skip labels (already used on this sheet)
          <input
            type="number"
            min={0}
            max={LABELS_PER_SHEET - 1}
            value={skip}
            onChange={(e) =>
              setSkip(Math.min(LABELS_PER_SHEET - 1, Math.max(0, Number(e.target.value) || 0)))
            }
          />
        </label>
        <div className="print-offset">
          <label>
            Nudge left/right (in)
            <input
              type="number"
              step={0.05}
              value={offsetX}
              onChange={(e) => updateOffsetX(Number(e.target.value) || 0)}
            />
          </label>
          <label>
            Nudge up/down (in)
            <input
              type="number"
              step={0.05}
              value={offsetY}
              onChange={(e) => updateOffsetY(Number(e.target.value) || 0)}
            />
          </label>
          <p className="hint">
            If labels print off-center from the sticker sheet, print once, measure the
            offset, and adjust here (negative = left/up). Saved on this device for next
            time.
          </p>
        </div>
        <div className="bin-select-groups">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.key);
            const selectedCount = group.bins.filter((b) => selected.has(b.id)).length;
            const allSelected = group.bins.length > 0 && selectedCount === group.bins.length;
            const someSelected = selectedCount > 0 && !allSelected;
            return (
              <div className="bin-select-group" key={group.key}>
                <div className="bin-select-group-header">
                  <button
                    type="button"
                    className="group-toggle"
                    onClick={() => toggleGroupExpanded(group.key)}
                  >
                    <span className="group-toggle-icon">{isExpanded ? "▾" : "▸"}</span>
                    {group.label}
                  </button>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => toggleGroupSelected(group, e.target.checked)}
                  />
                </div>
                {isExpanded && (
                  <table className="bin-select-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Label</th>
                        <th>Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.bins.map((bin) => (
                        <tr key={bin.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.has(bin.id)}
                              onChange={() => toggle(bin.id)}
                            />
                          </td>
                          <td>{bin.status === "blank" ? "[blank]" : bin.label}</td>
                          <td>{bin.code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={() => window.print()} disabled={labels.length === 0}>
          Print {labels.length} label{labels.length === 1 ? "" : "s"} across {sheets.length} sheet
          {sheets.length === 1 ? "" : "s"}
        </button>
      </div>
      {sheets.map((sheetLabels, sheetIndex) => (
        <div
          className="sheet avery-5160"
          key={sheetIndex}
          style={{
            marginLeft: `${offsetX}in`,
            paddingTop: `${Math.max(0, 0.5 + offsetY)}in`,
          }}
        >
          {sheetLabels.map((label, slotIndex) =>
            label === null ? (
              <div className="label label-empty" key={`empty-${slotIndex}`} />
            ) : (
              <div className="label" key={label.key}>
                <img src={`/api/bins/${label.bin.id}/qr.svg`} alt="" className="label-qr" />
                <div className="label-text">
                  <div className="label-name">
                    {label.bin.status === "blank"
                      ? label.bin.code
                      : label.bin.label || label.bin.code}
                  </div>
                  <div className="label-code">{label.bin.code}</div>
                  {label.bin.status !== "blank" && (
                    <div className="label-path">{binAddress(locations, label.bin)}</div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}
