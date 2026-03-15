import type { Commune, ComputedData, FilterType, ModeType, YearData } from "./types";
import { FILTER_FIELDS, getScaleForMode, type Scale } from "./config";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function enrichGeoJSON(
  computed: ComputedData,
  geojson: any,
  mode: ModeType,
  filter: FilterType,
  year: string,
  showChange: boolean,
  baseYear: string,
  endYear: string,
): any {
  const ff = FILTER_FIELDS[filter];
  const scale = !showChange ? getScaleForMode(mode, year, filter, computed) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geojson.features.forEach((f: any) => {
    const code = String(f.properties.code);
    const c = computed.cityIndex[code];
    f.properties.cityName = c?.city_name ?? f.properties.nom ?? "";
    f.properties.deptCode = c?.dept_code ?? "";

    f.properties.price = -1;
    f.properties.nb = 0;
    f.properties.change = -999;
    f.properties.changeBase = -1;
    f.properties.changeEnd = -1;
    f.properties.rent = -1;
    f.properties.rentCount = 0;
    f.properties.yield = -1;

    if (showChange) {
      const ch = c ? getChange(c, mode, filter, baseYear, endYear) : null;
      const nbField = mode === "rent" ? ff.rentCount : ff.nb;
      const baseStats = c?.years?.[baseYear] as Record<string, unknown> | undefined;
      const endStats = c?.years?.[endYear] as Record<string, unknown> | undefined;
      const nbBase = nbField && baseStats ? (baseStats[nbField] as number ?? 0) : 0;
      const nbEnd = nbField && endStats ? (endStats[nbField] as number ?? 0) : 0;
      const hasEnoughData = ch !== null && nbBase >= MIN_SAMPLES_PER_YEAR && nbEnd >= MIN_SAMPLES_PER_YEAR;
      f.properties.fillColor = hasEnoughData ? changeToColor(ch!.pct, mode, filter, baseYear, endYear, computed.changeScales) : "";
      f.properties.change = hasEnoughData ? ch!.pct : -999;
      f.properties.changeBase = hasEnoughData ? ch!.base : -1;
      f.properties.changeEnd = hasEnoughData ? ch!.end : -1;
    } else {
      const val = c ? getValue(c, mode, filter, year) : null;
      f.properties.fillColor = val != null && scale ? valueToColor(val, scale.p4, scale.p96) : "";
      if (mode === "price") {
        f.properties.price = val ?? -1;
        const s = c ? getStats(c, year) : null;
        f.properties.nb = s ? (s as Record<string, unknown>)[ff.nb] ?? 0 : 0;
      } else if (mode === "rent") {
        f.properties.rent = val ?? -1;
        const s = c ? getStats(c, year) : null;
        f.properties.rentCount = val != null ? ((s as Record<string, unknown>)?.[ff.rentCount!] ?? 0) : 0;
      } else {
        f.properties.yield = val ?? -1;
        const s = c ? getStats(c, year) : null;
        f.properties.price = val != null ? ((s as Record<string, unknown>)?.[ff.price] ?? -1) : -1;
        f.properties.rent = val != null && ff.rent ? ((s as Record<string, unknown>)?.[ff.rent] ?? -1) : -1;
      }
    }
  });
  return geojson;
}
