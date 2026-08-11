import { useEffect, useState } from "react";
import { BinWithBuried, Fullness, Location, binAddress, getLocationBins } from "../api";

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

  useEffect(() => {
    getLocationBins(locationId).then(setBins);
  }, [locationId, refreshToken]);

  if (bins.length === 0) {
    return <p>No bins here yet.</p>;
  }

  return (
    <ul className="bin-list">
      {bins.map((bin) => (
        <li key={bin.id}>
          <button onClick={() => onSelectBin(bin)}>{bin.label || bin.code}</button>
          <span className={`badge fullness-${bin.fullness}`}>{FULLNESS_LABEL[bin.fullness]}</span>
          {bin.is_buried && <span className="badge buried">Buried</span>}
          <span className="address">{binAddress(locations, bin)}</span>
        </li>
      ))}
    </ul>
  );
}
