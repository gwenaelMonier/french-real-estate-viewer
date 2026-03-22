import type maplibregl from "maplibre-gl";
import {
  changeScaleKey,
  FILTER_FIELDS,
  getScaleForMode,
  type Scale,
} from "./config";
import type {
  City,
  ComputedData,
  FilterType,
  ModeType,
  TooltipData,
  YearData,
} from "./types";

const MIN_SAMPLES_PER_YEAR = 15;

function computeYield(pricePerSqm: number, rent: number): number {
  return ((rent * 12) / pricePerSqm) * 100;
}

type ValidatedChange = NonNullable<ReturnType<typeof getChange>>;

function getValidatedChange(
  city: City,
  mode: ModeType,
  filter: FilterType,
  baseYear: string,
  endYear: string
): ValidatedChange | null {
  const changeResult = getChange(city, mode, filter, baseYear, endYear);
  if (!changeResult) {
    return null;
  }
  const fields = FILTER_FIELDS[filter];
  const countField = mode === "rent" ? fields.rentCount : fields.nb;
  const baseYearData = city.years?.[baseYear];
  const endYearData = city.years?.[endYear];
  const nbBase =
    countField && baseYearData ? (baseYearData[countField] ?? 0) : 0;
  const nbEnd = countField && endYearData ? (endYearData[countField] ?? 0) : 0;
  if (nbBase < MIN_SAMPLES_PER_YEAR || nbEnd < MIN_SAMPLES_PER_YEAR) {
    return null;
  }
  return changeResult;
}

export function getStats(city: City, activeYear: string): YearData | null {
  if (activeYear === "all") {
    return city;
  }
  return city.years?.[activeYear] ?? null;
}

export function getValue(
  city: City,
  mode: ModeType,
  filter: FilterType,
  year: string
): number | null {
  const stats = getStats(city, year);
  if (!stats) {
    return null;
  }
  const fields = FILTER_FIELDS[filter];
  if (mode === "yield") {
    const pricePerSqm = stats[fields.price];
    const rent = fields.rent ? stats[fields.rent] : undefined;
    return pricePerSqm && rent ? computeYield(pricePerSqm, rent) : null;
  }
  const field = mode === "rent" ? fields.rent : fields.price;
  return field ? (stats[field] ?? null) : null;
}

export function getChange(
  city: City,
  mode: ModeType,
  filter: FilterType,
  baseYear: string,
  endYear: string
): { pct: number; base: number; end: number } | null {
  const fields = FILTER_FIELDS[filter];
  const baseYearData = city.years?.[baseYear];
  const endYearData = city.years?.[endYear];
  if (mode === "yield") {
    const basePricePerSqm = baseYearData?.[fields.price];
    const baseRent = fields.rent ? baseYearData?.[fields.rent] : undefined;
    const endPricePerSqm = endYearData?.[fields.price];
    const endRent = fields.rent ? endYearData?.[fields.rent] : undefined;
    if (!basePricePerSqm || !baseRent || !endPricePerSqm || !endRent) {
      return null;
    }
    const yieldBase = computeYield(basePricePerSqm, baseRent);
    const yieldEnd = computeYield(endPricePerSqm, endRent);
    return {
      pct: ((yieldEnd - yieldBase) / yieldBase) * 100,
      base: yieldBase,
      end: yieldEnd,
    };
  }
  const field = mode === "rent" ? fields.rent : fields.price;
  if (!field) {
    return null;
  }
  const base = baseYearData?.[field];
  const end = endYearData?.[field];
  if (!base || !end) {
    return null;
  }
  return { pct: ((end - base) / base) * 100, base, end };
}

export function valueToColor(value: number, p4: number, p96: number): string {
  const ratio = Math.max(0, Math.min(1, (value - p4) / (p96 - p4)));
  return `hsl(${Math.round(120 * (1 - ratio))}, 80%, 45%)`;
}

export function changeToColor(
  pct: number,
  mode: ModeType,
  filter: FilterType,
  baseYear: string,
  endYear: string,
  changeScales: Record<string, Scale>
): string {
  const scale = changeScales[changeScaleKey(baseYear, endYear, mode, filter)];
  if (!scale) {
    return "";
  }
  const range = Math.max(Math.abs(scale.p4), Math.abs(scale.p96));
  return valueToColor(pct, -range, range);
}

export function buildCityIndex(cities: City[]): Record<string, City> {
  const index: Record<string, City> = {};
  for (const city of cities) {
    index[city.city_code] = city;
  }
  return index;
}

export function computeFeatureState(
  city: City | undefined,
  computed: ComputedData,
  mode: ModeType,
  filter: FilterType,
  year: string,
  showChange: boolean,
  baseYear: string,
  endYear: string,
  scale: Scale | undefined
): { fillColor: string } {
  if (!city) {
    return { fillColor: "" };
  }

  if (showChange) {
    const validated = getValidatedChange(city, mode, filter, baseYear, endYear);
    return {
      fillColor: validated
        ? changeToColor(
            validated.pct,
            mode,
            filter,
            baseYear,
            endYear,
            computed.changeScales
          )
        : "",
    };
  }

  const value = getValue(city, mode, filter, year);
  return {
    fillColor:
      value != null && scale ? valueToColor(value, scale.p4, scale.p96) : "",
  };
}

export function getTooltipData(
  city: City | undefined,
  mode: ModeType,
  filter: FilterType,
  year: string,
  showChange: boolean,
  baseYear: string,
  endYear: string
): TooltipData {
  const defaults: TooltipData = {
    price: -1,
    nb: 0,
    rent: -1,
    rentCount: 0,
    yield: -1,
    change: -999,
    changeBase: -1,
    changeEnd: -1,
  };
  if (!city) {
    return defaults;
  }

  if (showChange) {
    const validated = getValidatedChange(city, mode, filter, baseYear, endYear);
    return {
      ...defaults,
      change: validated ? validated.pct : -999,
      changeBase: validated ? validated.base : -1,
      changeEnd: validated ? validated.end : -1,
    };
  }

  const fields = FILTER_FIELDS[filter];
  const value = getValue(city, mode, filter, year);
  const stats = getStats(city, year);
  if (mode === "price") {
    return {
      ...defaults,
      price: value ?? -1,
      nb: stats ? (stats[fields.nb] ?? 0) : 0,
    };
  } else if (mode === "rent") {
    return {
      ...defaults,
      rent: value ?? -1,
      rentCount:
        value != null && fields.rentCount
          ? (stats?.[fields.rentCount] ?? 0)
          : 0,
    };
  } else {
    return {
      ...defaults,
      yield: value ?? -1,
      price: value != null ? (stats?.[fields.price] ?? -1) : -1,
      rent: value != null && fields.rent ? (stats?.[fields.rent] ?? -1) : -1,
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
  endYear: string
): void {
  map.removeFeatureState({ source: "cities", sourceLayer: "cities" });
  const scale = !showChange
    ? getScaleForMode(mode, year, filter, computed)
    : undefined;
  for (const [code, city] of Object.entries(computed.cityIndex)) {
    const state = computeFeatureState(
      city,
      computed,
      mode,
      filter,
      year,
      showChange,
      baseYear,
      endYear,
      scale
    );
    if (state.fillColor) {
      map.setFeatureState(
        { source: "cities", sourceLayer: "cities", id: code },
        state
      );
    }
  }
}
