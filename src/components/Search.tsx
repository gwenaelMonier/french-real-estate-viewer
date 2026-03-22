import { Search as SearchIcon } from "lucide-react";
import type maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useData } from "../context/DataContext";
import type { City } from "../types";
import { normalize } from "../utils";

const MAX_RESULTS = 8;

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>;
}

export default function Search({ mapRef }: Props) {
  const { t } = useTranslation();
  const { cities } = useData();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [showResults, setShowResults] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  const normalizedCities = useMemo(
    () => cities.map((city) => ({ city, normalized: normalize(city.city_name) })),
    [cities]
  );

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      const q = normalize(value.trim());
      if (!q) {
        setShowResults(false);
        setResults([]);
        return;
      }
      const matches = normalizedCities
        .filter(({ normalized }) => normalized.includes(q))
        .sort((a, b) => {
          const aStarts = a.normalized.startsWith(q);
          const bStarts = b.normalized.startsWith(q);
          if (aStarts !== bStarts) {
            return aStarts ? -1 : 1;
          }
          return a.city.city_name.localeCompare(b.city.city_name);
        })
        .map(({ city }) => city)
        .slice(0, MAX_RESULTS);
      setResults(matches);
      setShowResults(matches.length > 0);
    },
    [normalizedCities]
  );

  const handleSelect = useCallback(
    (city: City) => {
      if (city.lat != null && city.lon != null) {
        mapRef.current?.flyTo({
          center: [city.lon, city.lat],
          zoom: 12,
          duration: 800,
        });
      }
      setQuery(city.city_name);
      setShowResults(false);
    },
    [mapRef]
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
        <SearchIcon size={14} className="search-icon" />
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
          {results.map((city) => (
            <li key={city.city_code} onClick={() => handleSelect(city)}>
              <span>{city.city_name}</span>
              <span className="dep">{city.dept_code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
