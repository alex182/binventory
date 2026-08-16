import { useEffect, useState } from "react";
import { Bin, Location, listLocations } from "../api";
import { navigate } from "../router";
import BinForm from "./BinForm";
import GridView from "./GridView";
import LocationDetail from "./LocationDetail";

export default function Locations() {
  // Sites only — zones, stacks, and slots are reached by selecting a site
  // and browsing its (recursive) bin list or Grid view, not via a tree.
  const [sites, setSites] = useState<Location[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [view, setView] = useState<"bins" | "grid">("bins");
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
    setView("bins");
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
            {isSite && (
              <div className="view-toggle">
                <button disabled={view === "bins"} onClick={() => setView("bins")}>
                  Bins
                </button>
                <button disabled={view === "grid"} onClick={() => setView("grid")}>
                  Grid view
                </button>
              </div>
            )}
            {view === "grid" && selectedLocation && selectedLocation.kind === "site" ? (
              <GridView
                site={selectedLocation}
                onSelectStack={selectLocation}
                onGridChanged={refreshTree}
              />
            ) : (
              <>
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
