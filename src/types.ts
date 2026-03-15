export interface YearData {
  median_sqm?: number | null;
  median_sqm_house?: number | null;
  median_sqm_apt?: number | null;
  median_sqm_land?: number | null;
  count?: number;
  count_house?: number;
  count_apt?: number;
  count_land?: number | null;
  rent_residential?: number;
  rent_house?: number;
  rent_apt?: number;
  rent_count_residential?: number;
  rent_count_house?: number;
  rent_count_apt?: number;
}

export interface Commune extends YearData {
  city_code: string;
  city_name: string;
  dept_code: string;
  lat?: number | null;
  lon?: number | null;
  years: Record<string, YearData>;
}

export type FilterType = "residential" | "house" | "apt" | "land";
export type ModeType = "price" | "rent" | "yield";

import type { Scale } from "./config";

export interface ComputedData {
  cityIndex: Record<string, Commune>;
  scales: Record<string, Scale>;
  rentScales: Record<string, Scale>;
  yieldScales: Record<string, Scale>;
  changeScales: Record<string, Scale>;
}
