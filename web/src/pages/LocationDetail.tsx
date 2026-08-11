import { useEffect, useState } from "react";
import { BinWithBuried, Fullness, Location, binAddress, getLocationBins, moveStack } from "../api";
import MoveDialog from "../components/MoveDialog";

const FULLNESS_LABEL: Record<Fullness, string> = {
  empty: "Empty",
  room: "Has room",
  full: "Full",
};

interface Props {
  locationId: number;
  locations: Location[];
  onSelectBin: (bin: BinWithBuried) => void;
  refreshToken: number;
}

export default function LocationDetail({ locationId, locations, onSelectBin, refreshToken }: Props) {
  const [bins, setBins] = useState<BinWithBuried[]>([]);
  const [showMoveStack, setShowMoveStack] = useState(false);

  function refresh() {
    getLocationBins(locationId).then(setBins);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, refreshToken]);

  const isStack = locations.find((l) => l.id === locationId)?.kind === "stack";

  return (
    <div className="location-detail">
      {isStack && bins.length > 0 && (
        <button onClick={() => setShowMoveStack(true)}>Move whole stack</button>
      )}
      {showMoveStack && (
        <MoveDialog
          title="Move whole stack"
          locations={locations.filter((l) => l.id !== locationId)}
          onMove={async (toLocationId) => {
            await moveStack(locationId, toLocationId);
            refresh();
          }}
          onClose={() => setShowMoveStack(false)}
        />
      )}
      {bins.length === 0 ? (
        <p>No bins here yet.</p>
      ) : (
        <ul className="bin-list">
          {bins.map((bin) => (
            <li key={bin.id}>
              <button onClick={() => onSelectBin(bin)}>{bin.label || bin.code}</button>
              <span className={`badge fullness-${bin.fullness}`}>
                {FULLNESS_LABEL[bin.fullness]}
              </span>
              {bin.is_buried && (
                <span className="badge buried">
                  {bin.bins_on_top} tote{bin.bins_on_top === 1 ? "" : "s"} on top
                </span>
              )}
              <span className="address">{binAddress(locations, bin)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
