import { useState, useCallback, useRef } from "react";
import type maplibregl from "maplibre-gl";
import type { FilterType, ModeType } from "./types";
import { useData } from "./context/DataContext";
import MapView from "./components/MapView";
import Legend from "./components/Legend";
import FilterPanel from "./components/FilterPanel";
import Search from "./components/Search";
import LanguageToggle from "./components/LanguageToggle";

export default function App() {
  const { years } = useData();
  const LATEST_YEAR = String(Math.max(...years));

  const [activeFilter, setActiveFilter] = useState<FilterType>("residential");
  const [activeYear, setActiveYear] = useState("all");
  const [activeMode, setActiveMode] = useState<ModeType>("price");
  const [showChange, setShowChange] = useState(false);
  const [baseYear, setBaseYear] = useState(String(years[0]));
  const [endYear, setEndYear] = useState(LATEST_YEAR);

  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const onMapReady = useCallback((map: maplibregl.Map, popup: maplibregl.Popup) => {
    mapRef.current = map;
    popupRef.current = popup;
  }, []);

  const handleModeChange = useCallback(
    (mode: ModeType) => {
      setActiveMode(mode);
      if ((mode === "rent" || mode === "yield") && activeFilter === "land") {
        setActiveFilter("residential");
      }
      popupRef.current?.remove();
    },
    [activeFilter],
  );

  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter);
    popupRef.current?.remove();
  }, []);

  const handleYearChange = useCallback((year: string) => {
    setActiveYear(year);
    popupRef.current?.remove();
  }, []);

  const handleViewModeChange = useCallback((change: boolean) => {
    setShowChange(change);
    popupRef.current?.remove();
  }, []);

  const handleBaseYearChange = useCallback((year: string) => {
    setBaseYear(year);
  }, []);

  const handleEndYearChange = useCallback((year: string) => {
    setEndYear(year);
  }, []);

  return (
    <>
      <MapView
        activeFilter={activeFilter}
        activeYear={activeYear}
        activeMode={activeMode}
        showChange={showChange}
        baseYear={baseYear}
        endYear={endYear}
        onMapReady={onMapReady}
      />
      <Legend
        activeMode={activeMode}
        activeFilter={activeFilter}
        activeYear={activeYear}
        showChange={showChange}
        baseYear={baseYear}
        endYear={endYear}
      />
      <FilterPanel
        activeMode={activeMode}
        activeFilter={activeFilter}
        activeYear={activeYear}
        showChange={showChange}
        baseYear={baseYear}
        endYear={endYear}
        onModeChange={handleModeChange}
        onFilterChange={handleFilterChange}
        onYearChange={handleYearChange}
        onViewModeChange={handleViewModeChange}
        onBaseYearChange={handleBaseYearChange}
        onEndYearChange={handleEndYearChange}
      />
      <Search mapRef={mapRef} />
      <LanguageToggle />
    </>
  );
}
