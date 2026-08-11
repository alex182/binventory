import { useEffect, useState } from "react";
import { Bin, BinWithBuried, Location, LocationTreeNode, getLocationTree, listLocations } from "../api";
import BinForm from "./BinForm";
import GridView from "./GridView";
import LocationDetail from "./LocationDetail";

function nodeLabel(node: Location): string {
  if (node.kind === "stack" && node.grid_row != null && node.grid_col != null) {
    return `R${node.grid_row}C${node.grid_col}`;
  }
  return node.name;
}

function TreeNode({
  node,
  selectedId,
  onSelect,
}: {
  node: LocationTreeNode;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <li>
      <button
        className={node.id === selectedId ? "selected" : ""}
        onClick={() => onSelect(node.id)}
      >
        {nodeLabel(node)}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Locations() {
  const [tree, setTree] = useState<LocationTreeNode[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [view, setView] = useState<"bins" | "grid">("bins");

  const selectedLocation = locations.find((l) => l.id === selectedId) ?? null;
  const isSite = selectedLocation?.kind === "site";

  async function refreshTree() {
    const [t, l] = await Promise.all([getLocationTree(), listLocations()]);
    setTree(t);
    setLocations(l);
  }

  useEffect(() => {
    refreshTree();
  }, []);

  function selectLocation(id: number) {
    setSelectedId(id);
    setView("bins");
  }

  return (
    <div className="locations-page">
      <aside>
        <h2>Locations</h2>
        <ul className="tree">
          {tree.map((node) => (
            <TreeNode key={node.id} node={node} selectedId={selectedId} onSelect={selectLocation} />
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
            {view === "grid" && isSite ? (
              <GridView siteId={selectedId} onSelectStack={selectLocation} onGridChanged={refreshTree} />
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditingBin(null);
                    setShowForm(true);
                  }}
                >
                  + New bin here
                </button>
                <LocationDetail
                  locationId={selectedId}
                  locations={locations}
                  refreshToken={refreshToken}
                  onSelectBin={(bin: BinWithBuried) => {
                    setEditingBin(bin);
                    setShowForm(true);
                  }}
                />
              </>
            )}
          </>
        )}
        {showForm && (
          <BinForm
            bin={editingBin}
            locations={locations}
            defaultLocationId={selectedId}
            onCancel={() => setShowForm(false)}
            onSaved={async () => {
              setShowForm(false);
              await refreshTree();
              setRefreshToken((t) => t + 1);
            }}
          />
        )}
      </main>
    </div>
  );
}
