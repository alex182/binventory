import { useEffect, useState } from "react";
import { Bin, Location, binAddress, getBinByCode, listLocations } from "../api";
import { navigate } from "../router";

interface Props {
  code: string;
}

export default function BinDetail({ code }: Props) {
  const [bin, setBin] = useState<Bin | null | undefined>(undefined);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    setBin(undefined);
    Promise.all([getBinByCode(code), listLocations()]).then(([b, locs]) => {
      setBin(b);
      setLocations(locs);
    });
  }, [code]);

  if (bin === undefined) {
    return <p>Loading…</p>;
  }

  if (bin === null) {
    return (
      <div className="bin-detail not-found">
        <p>No bin found for code "{code}".</p>
        <button onClick={() => navigate("/")}>Create a new bin</button>
      </div>
    );
  }

  if (bin.status === "blank") {
    return (
      <div className="bin-detail blank">
        <p>This tote (code {bin.code}) hasn't been claimed yet.</p>
        <button onClick={() => navigate("/")}>Back to locations</button>
      </div>
    );
  }

  return (
    <div className="bin-detail">
      <h2>{bin.label}</h2>
      <p className="address">{binAddress(locations, bin)}</p>
      <p>Code: {bin.code}</p>
      <p>Fullness: {bin.fullness}</p>
      {bin.notes && <p>Notes: {bin.notes}</p>}
      <button onClick={() => navigate("/")}>Back to locations</button>
    </div>
  );
}
