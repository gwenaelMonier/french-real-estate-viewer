import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Commune, ComputedData } from "../types";
import type { Scale } from "../config";
import { buildCityIndex } from "../data";

interface DataContextValue {
  communes: Commune[];
  years: number[];
  computed: ComputedData;
}

interface CitiesJson {
  communes: Commune[];
  years: number[];
  scales: Record<string, Scale>;
  rentScales: Record<string, Scale>;
  yieldScales: Record<string, Scale>;
  changeScales: Record<string, Scale>;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataContextValue | null>(null);

  useEffect(() => {
    fetch("/cities.json")
      .then((r) => r.json())
      .then(({ communes, years, scales, rentScales, yieldScales, changeScales }: CitiesJson) => {
        const cityIndex = buildCityIndex(communes);
        setData({
          communes,
          years,
          computed: { cityIndex, scales, rentScales, yieldScales, changeScales },
        });
      });
  }, []);

  if (!data) return <div className="loading-screen"><span className="loading-label"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21V14h6v7"/></svg>Chargement…</span></div>;
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
