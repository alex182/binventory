import { useEffect, useState } from "react";
import {
  Bin,
  Fullness,
  Location,
  LocationTreeNode,
  binAddress,
  getLocationTree,
  listBins,
  listLocations,
} from "../api";
import BinForm from "./BinForm";

const FULLNESS_LABEL: Record<Fullness, string> = {
  empty: "Empty",
  room: "Has room",
  full: "Full",
};

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
  const [bins, setBins] = useState<Bin[]>([]);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refreshTree() {
    const [t, l] = await Promise.all([getLocationTree(), listLocations()]);
    setTree(t);
    setLocations(l);
  }

  async function refreshBins() {
    if (selectedId == null) {
      setBins([]);
      return;
    }
    setBins(await listBins({ location_id: selectedId }));
  }

  useEffect(() => {
    refreshTree();
  }, []);

  useEffect(() => {
    refreshBins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="locations-page">
      <aside>
        <h2>Locations</h2>
        <ul className="tree">
          {tree.map((node) => (
            <TreeNode key={node.id} node={node} selectedId={selectedId} onSelect={setSelectedId} />
          ))}
        </ul>
      </aside>
      <main>
        <h2>Bins</h2>
        {selectedId == null ? (
          <p>Select a location to see its bins.</p>
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
            <ul className="bin-list">
              {bins.map((bin) => (
                <li key={bin.id}>
                  <button
                    onClick={() => {
                      setEditingBin(bin);
                      setShowForm(true);
                    }}
                  >
                    {bin.label || bin.code}
                  </button>
                  <span className={`badge fullness-${bin.fullness}`}>
                    {FULLNESS_LABEL[bin.fullness]}
                  </span>
                  <span className="address">{binAddress(locations, bin)}</span>
                </li>
              ))}
            </ul>
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
              await refreshBins();
            }}
          />
        )}
      </main>
    </div>
  );
}
