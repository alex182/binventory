import { FormEvent, useEffect, useState } from "react";
import { GRID_NUMBER_ORDER_OPTIONS, Grid, GridNumberOrder, Location, createGrid, getGrid, updateLocation } from "../api";

interface Props {
  site: Location;
  onSelectStack: (stackId: number) => void;
  onGridChanged: () => void;
}

export default function GridView({ site, onSelectStack, onGridChanged }: Props) {
  const siteId = site.id;
  const [grid, setGrid] = useState<Grid | null>(null);
  const [rows, setRows] = useState("3");
  const [cols, setCols] = useState("3");

  async function refresh() {
    setGrid(await getGrid(siteId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    await createGrid(siteId, Number(rows), Number(cols));
    await refresh();
    onGridChanged();
  }

  async function handleOrderChange(value: GridNumberOrder) {
    await updateLocation(siteId, { grid_number_order: value });
    onGridChanged();
  }

  if (grid == null) return <p>Loading…</p>;

  const cellByPos = new Map(grid.cells.map((c) => [`${c.grid_row}-${c.grid_col}`, c]));

  return (
    <div className="grid-view">
      <label>
        Stack numbering direction
        <select
          value={site.grid_number_order ?? "front_to_back"}
          onChange={(e) => handleOrderChange(e.target.value as GridNumberOrder)}
        >
          {GRID_NUMBER_ORDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={handleGenerate} className="grid-generate">
        <label>
          Rows
          <input type="number" min={1} value={rows} onChange={(e) => setRows(e.target.value)} />
        </label>
        <label>
          Cols
          <input type="number" min={1} value={cols} onChange={(e) => setCols(e.target.value)} />
        </label>
        <button type="submit">Generate grid</button>
      </form>
      {grid.rows === 0 || grid.cols === 0 ? (
        <p>No grid yet — generate one above.</p>
      ) : (
        <table className="grid-table">
          <tbody>
            {Array.from({ length: grid.rows }, (_, i) => i + 1).map((r) => (
              <tr key={r}>
                {Array.from({ length: grid.cols }, (_, j) => j + 1).map((c) => {
                  const cell = cellByPos.get(`${r}-${c}`);
                  return (
                    <td key={c}>
                      {cell ? (
                        <button onClick={() => onSelectStack(cell.stack_id)}>
                          R{r}C{c}
                          <br />
                          {cell.bin_count} tote{cell.bin_count === 1 ? "" : "s"}
                        </button>
                      ) : (
                        <span className="empty-cell">
                          R{r}C{c}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
