import { useEffect, useState } from "react";
import { Bin, Location, batchCreateBins, binAddress, listBins, listLocations } from "../api";
import "./PrintSheet.css";

const LABELS_PER_SHEET = 30;

interface LabelInstance {
  bin: Bin;
  key: string;
}

export default function PrintSheet() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copies, setCopies] = useState(3);
  const [batchCount, setBatchCount] = useState(10);

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

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedBins = bins.filter((b) => selected.has(b.id));

  const labels: LabelInstance[] = [];
  for (const bin of selectedBins) {
    for (let i = 0; i < copies; i++) {
      labels.push({ bin, key: `${bin.id}-${i}` });
    }
  }

  const sheets: LabelInstance[][] = [];
  for (let i = 0; i < labels.length; i += LABELS_PER_SHEET) {
    sheets.push(labels.slice(i, i + LABELS_PER_SHEET));
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
        <ul className="bin-select-list">
          {bins.map((bin) => (
            <li key={bin.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(bin.id)}
                  onChange={() => toggle(bin.id)}
                />
                {bin.status === "blank" ? `[blank] ${bin.code}` : `${bin.label} (${bin.code})`}
              </label>
            </li>
          ))}
        </ul>
        <button onClick={() => window.print()} disabled={labels.length === 0}>
          Print {labels.length} label{labels.length === 1 ? "" : "s"} across {sheets.length} sheet
          {sheets.length === 1 ? "" : "s"}
        </button>
      </div>
      {sheets.map((sheetLabels, sheetIndex) => (
        <div className="sheet avery-5160" key={sheetIndex}>
          {sheetLabels.map((label) => (
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
          ))}
        </div>
      ))}
    </div>
  );
}
