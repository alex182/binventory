import { useEffect, useState } from "react";
import { SearchResult, search } from "../api";
import { navigate } from "../router";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      search(q).then(setResults);
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function goToResult(result: SearchResult) {
    navigate(`/b/${encodeURIComponent(result.code)}`);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search bins & contents…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.bin_id}>
              <button onClick={() => goToResult(r)}>
                <span className="search-result-label">{r.label || r.code}</span>
                <span className="search-result-path">{r.location_path}</span>
                <span className="search-result-field">{r.matched_field}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
