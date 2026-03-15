import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Commune, ComputedData } from "../types";
import { computeScales } from "../config";
import { buildCityIndex } from "../data";

interface DataContextValue {
  communes: Commune[];
  years: number[];
  computed: ComputedData;
}

const DataContext = createContext<DataContextValue | null>(null);

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
      .then(({ communes, years }: { communes: Commune[]; years: number[] }) => {
        const { scales, rentScales, yieldScales, changeScales } = computeScales(communes, years);
        const cityIndex = buildCityIndex(communes);
        setData({
          communes,
          years,
          computed: { cityIndex, scales, rentScales, yieldScales, changeScales },
        });
      });
  }, []);

  if (!data) return <div className="loading-screen">Chargement…</div>;
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
