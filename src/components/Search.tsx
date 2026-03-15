import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type maplibregl from "maplibre-gl";
import type { Commune } from "../types";

const MAX_RESULTS = 8;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>;
}

export default function Search({ mapRef }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Commune[]>([]);
  const [showResults, setShowResults] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    const q = normalize(value.trim());
    if (!q) {
      setShowResults(false);
      setResults([]);
      return;
    }
    const matches = COMMUNES.filter((c) => normalize(c.city_name).includes(q))
      .sort((a, b) => {
        const aStarts = normalize(a.city_name).startsWith(q);
        const bStarts = normalize(b.city_name).startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.city_name.localeCompare(b.city_name);
      })
      .slice(0, MAX_RESULTS);
    setResults(matches);
    setShowResults(matches.length > 0);
  }, []);

  const handleSelect = useCallback(
    (c: Commune) => {
      if (c.lat != null && c.lon != null) {
        mapRef.current?.flyTo({
          center: [c.lon, c.lat],
          zoom: 12,
          duration: 800,
        });
      }
      setQuery(c.city_name);
      setShowResults(false);
    },
    [mapRef],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setShowResults(false);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!controlRef.current?.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div id="search-control" ref={controlRef}>
      <div className="search-wrap">
        <input
          id="search-input"
          type="text"
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
        />
        {query && (
          <button id="search-clear" onClick={handleClear}>
            ✕
          </button>
        )}
      </div>
      {showResults && (
        <ul id="search-results">
          {results.map((c) => (
            <li key={c.city_code} onClick={() => handleSelect(c)}>
              <span>{c.city_name}</span>
              <span className="dep">{c.dept_code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
