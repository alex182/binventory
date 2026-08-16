import { useEffect, useState } from "react";
import {
  Bin,
  GRID_NUMBER_ORDER_OPTIONS,
  GridNumberOrder,
  Location,
  listLocations,
  updateLocation,
} from "../api";
import { navigate } from "../router";
import BinForm from "./BinForm";
import LocationDetail from "./LocationDetail";

export default function Locations() {
  // Sites only — zones, stacks, and slots are reached by selecting a site
  // and browsing its recursive bin list, not via a tree.
  const [sites, setSites] = useState<Location[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [emptyOnly, setEmptyOnly] = useState(false);

  const selectedLocation = locations.find((l) => l.id === selectedId) ?? null;
  const isSite = selectedLocation?.kind === "site";

  async function refreshTree() {
    const l = await listLocations();
    setSites(l.filter((loc) => loc.kind === "site"));
    setLocations(l);
  }

  useEffect(() => {
    refreshTree();
  }, []);

  function selectLocation(id: number) {
    setSelectedId(id);
  }

  function goToBin(bin: Bin) {
    navigate(`/b/${bin.code}`);
  }

  return (
    <div className="locations-page">
      <aside>
        <h2>Locations</h2>
        <ul className="tree">
          {sites.map((site) => (
            <li key={site.id}>
              <button
                className={site.id === selectedId ? "selected" : ""}
                onClick={() => selectLocation(site.id)}
              >
                {site.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main>
        <h2>Bins</h2>
        {selectedId == null ? (
          <p>Select a location to see its bins.</p>
        ) : (
          <>
            {isSite && selectedLocation && (
              <label className="grid-order-inline">
                Stack numbering direction
                <select
                  value={selectedLocation.grid_number_order ?? "front_to_back"}
                  onChange={async (e) => {
                    await updateLocation(selectedLocation.id, {
                      grid_number_order: e.target.value as GridNumberOrder,
                    });
                    refreshTree();
                  }}
                >
                  {GRID_NUMBER_ORDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={() => setShowForm(true)}>+ New bin here</button>
            <label className="empty-filter">
              <input
                type="checkbox"
                checked={emptyOnly}
                onChange={(e) => setEmptyOnly(e.target.checked)}
              />
              Show only empty bins
            </label>
            <LocationDetail
              locationId={selectedId}
              locations={locations}
              refreshToken={refreshToken}
              emptyOnly={emptyOnly}
              onSelectBin={goToBin}
            />
          </>
        )}
        {showForm && (
          <BinForm
            locations={locations}
            defaultLocationId={selectedId}
            onCancel={() => setShowForm(false)}
            onSaved={(savedBin) => {
              setShowForm(false);
              goToBin(savedBin);
            }}
          />
        )}
      </main>
    </div>
  );
}
