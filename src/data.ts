import type { Commune, ComputedData, FilterType, ModeType, YearData } from "./types";
import { FILTER_FIELDS, getScaleForMode, type Scale } from "./config";
import type maplibregl from "maplibre-gl";

const MIN_SAMPLES_PER_YEAR = 15;

export function getStats(c: Commune, activeYear: string): YearData | null {
  if (activeYear === "all") return c;
  return c.years?.[activeYear] ?? null;
}

export function getValue(
  c: Commune,
  mode: ModeType,
  filter: FilterType,
  year: string,
): number | null {
  const s = getStats(c, year);
  if (!s) return null;
  const ff = FILTER_FIELDS[filter];
  if (mode === "yield") {
    const price = (s as Record<string, unknown>)[ff.price] as number | undefined;
    const rent = ff.rent ? (s as Record<string, unknown>)[ff.rent] as number | undefined : undefined;
    return price && rent ? ((rent * 12) / price) * 100 : null;
  }
  const field = mode === "rent" ? ff.rent : ff.price;
  return field ? ((s as Record<string, unknown>)[field] as number | null) ?? null : null;
}

export function getChange(
  c: Commune,
  mode: ModeType,
  filter: FilterType,
  baseYear: string,
  endYear: string,
): { pct: number; base: number; end: number } | null {
  const ff = FILTER_FIELDS[filter];
  if (mode === "yield") {
    const bPrice = (c.years?.[baseYear] as Record<string, unknown> | undefined)?.[ff.price] as number | undefined;
    const bRent = ff.rent ? (c.years?.[baseYear] as Record<string, unknown> | undefined)?.[ff.rent] as number | undefined : undefined;
    const ePrice = (c.years?.[endYear] as Record<string, unknown> | undefined)?.[ff.price] as number | undefined;
    const eRent = ff.rent ? (c.years?.[endYear] as Record<string, unknown> | undefined)?.[ff.rent] as number | undefined : undefined;
    if (!bPrice || !bRent || !ePrice || !eRent) return null;
    const rBase = ((bRent * 12) / bPrice) * 100;
    const rEnd = ((eRent * 12) / ePrice) * 100;
    return { pct: ((rEnd - rBase) / rBase) * 100, base: rBase, end: rEnd };
  }
  const field = mode === "rent" ? ff.rent : ff.price;
  if (!field) return null;
  const base = (c.years?.[baseYear] as Record<string, unknown> | undefined)?.[field] as number | undefined;
  const end = (c.years?.[endYear] as Record<string, unknown> | undefined)?.[field] as number | undefined;
  if (!base || !end) return null;
  return { pct: ((end - base) / base) * 100, base, end };
}

export function valueToColor(value: number, p4: number, p96: number): string {
  const t = Math.max(0, Math.min(1, (value - p4) / (p96 - p4)));
  return `hsl(${Math.round(120 * (1 - t))}, 80%, 45%)`;
}

export function changeToColor(
  pct: number,
  mode: ModeType,
  filter: FilterType,
  baseYear: string,
  endYear: string,
  changeScales: Record<string, Scale>,
): string {
  const scaleKey = `${baseYear}_${endYear}_${mode}_${filter}`;
  const scale = changeScales[scaleKey];
  if (!scale) return "";
  const range = Math.max(Math.abs(scale.p4), Math.abs(scale.p96));
  return valueToColor(pct, -range, range);
}

export function buildCityIndex(communes: Commune[]): Record<string, Commune> {
  const idx: Record<string, Commune> = {};
  communes.forEach((c) => { idx[c.city_code] = c; });
  return idx;
}

export function computeFeatureState(
  c: Commune | undefined,
  computed: ComputedData,
  mode: ModeType,
  filter: FilterType,
  year: string,
  showChange: boolean,
  baseYear: string,
  endYear: string,
  scale: Scale | null,
): { fillColor: string } {
  if (!c) return { fillColor: "" };
  const ff = FILTER_FIELDS[filter];

  if (showChange) {
    const ch = getChange(c, mode, filter, baseYear, endYear);
    const nbField = mode === "rent" ? ff.rentCount : ff.nb;
    const baseStats = c.years?.[baseYear] as Record<string, unknown> | undefined;
    const endStats = c.years?.[endYear] as Record<string, unknown> | undefined;
    const nbBase = nbField && baseStats ? (baseStats[nbField] as number ?? 0) : 0;
    const nbEnd = nbField && endStats ? (endStats[nbField] as number ?? 0) : 0;
    const hasEnoughData = ch !== null && nbBase >= MIN_SAMPLES_PER_YEAR && nbEnd >= MIN_SAMPLES_PER_YEAR;
    return { fillColor: hasEnoughData ? changeToColor(ch!.pct, mode, filter, baseYear, endYear, computed.changeScales) : "" };
  }

  const val = getValue(c, mode, filter, year);
  return { fillColor: val != null && scale ? valueToColor(val, scale.p4, scale.p96) : "" };
}

export interface TooltipData {
  price: number;
  nb: number;
  rent: number;
  rentCount: number;
  yield: number;
  change: number;
  changeBase: number;
  changeEnd: number;
}

export function getTooltipData(
  c: Commune | undefined,
  mode: ModeType,
  filter: FilterType,
  year: string,
  showChange: boolean,
  baseYear: string,
  endYear: string,
): TooltipData {
  const defaults: TooltipData = { price: -1, nb: 0, rent: -1, rentCount: 0, yield: -1, change: -999, changeBase: -1, changeEnd: -1 };
  if (!c) return defaults;
  const ff = FILTER_FIELDS[filter];

  if (showChange) {
    const ch = getChange(c, mode, filter, baseYear, endYear);
    const nbField = mode === "rent" ? ff.rentCount : ff.nb;
    const baseStats = c.years?.[baseYear] as Record<string, unknown> | undefined;
    const endStats = c.years?.[endYear] as Record<string, unknown> | undefined;
    const nbBase = nbField && baseStats ? (baseStats[nbField] as number ?? 0) : 0;
    const nbEnd = nbField && endStats ? (endStats[nbField] as number ?? 0) : 0;
    const hasEnoughData = ch !== null && nbBase >= MIN_SAMPLES_PER_YEAR && nbEnd >= MIN_SAMPLES_PER_YEAR;
    return {
      ...defaults,
      change: hasEnoughData ? ch!.pct : -999,
      changeBase: hasEnoughData ? ch!.base : -1,
      changeEnd: hasEnoughData ? ch!.end : -1,
    };
  }

  const val = getValue(c, mode, filter, year);
  const s = getStats(c, year);
  if (mode === "price") {
    return { ...defaults, price: val ?? -1, nb: s ? ((s as Record<string, unknown>)[ff.nb] as number ?? 0) : 0 };
  } else if (mode === "rent") {
    return { ...defaults, rent: val ?? -1, rentCount: val != null ? ((s as Record<string, unknown>)?.[ff.rentCount!] as number ?? 0) : 0 };
  } else {
    return {
      ...defaults,
      yield: val ?? -1,
      price: val != null ? ((s as Record<string, unknown>)?.[ff.price] as number ?? -1) : -1,
      rent: val != null && ff.rent ? ((s as Record<string, unknown>)?.[ff.rent] as number ?? -1) : -1,
    };
  }
}

export function applyAllFeatureStates(
  map: maplibregl.Map,
  computed: ComputedData,
  mode: ModeType,
  filter: FilterType,
  year: string,
  showChange: boolean,
  baseYear: string,
  endYear: string,
): void {
  map.removeFeatureState({ source: "communes", sourceLayer: "communes" });
  const scale = !showChange ? getScaleForMode(mode, year, filter, computed) : null;
  for (const [code, c] of Object.entries(computed.cityIndex)) {
    const state = computeFeatureState(c, computed, mode, filter, year, showChange, baseYear, endYear, scale);
    if (state.fillColor) {
      map.setFeatureState(
        { source: "communes", sourceLayer: "communes", id: code },
        state,
      );
    }
  }
}
