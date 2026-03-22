import type {
  ComputedData,
  FilterType,
  ModeType,
  TooltipData,
  YearData,
} from "./types";

export const FILTER_FIELDS: Record<
  FilterType,
  {
    price: keyof YearData;
    rent: keyof YearData | null;
    nb: keyof YearData;
    rentCount: keyof YearData | null;
  }
> = {
  residential: {
    price: "median_sqm",
    rent: "rent_residential",
    nb: "count",
    rentCount: "rent_count_residential",
  },
  house: {
    price: "median_sqm_house",
    rent: "rent_house",
    nb: "count_house",
    rentCount: "rent_count_house",
  },
  apt: {
    price: "median_sqm_apt",
    rent: "rent_apt",
    nb: "count_apt",
    rentCount: "rent_count_apt",
  },
  land: {
    price: "median_sqm_land",
    rent: null,
    nb: "count_land",
    rentCount: null,
  },
};

export const ARR = (color = "#cbd5e1") =>
  `<svg width="14" height="8" viewBox="0 0 14 8" fill="none" style="vertical-align:middle;margin:0 2px"><path d="M1 4h12M9 1l4 3-4 3" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ARROW = ARR();
export const ARROW_DARK = ARR("#475569");

// ── Scales (pre-computed by process.py) ──────────
export type Scale = { p4: number; p96: number };

export function changeScaleKey(
  baseYear: string,
  endYear: string,
  mode: ModeType,
  filter: FilterType
): string {
  return `${baseYear}_${endYear}_${mode}_${filter}`;
}

export function getScaleForMode(
  mode: ModeType,
  year: string,
  filter: FilterType,
  computed: ComputedData
): Scale | undefined {
  if (mode === "price") {
    return computed.scales[`${year}_${filter}`];
  }
  if (mode === "rent") {
    return computed.rentScales[
      `${year}_${filter === "land" ? "residential" : filter}`
    ];
  }
  return computed.yieldScales[`${year}_${filter}`];
}

// ── Mode config ──────────────────────────────────
export interface ModeConfigEntry {
  label: string;
  modeLabel: string;
  getScale: (year: string, filter: FilterType) => Scale | undefined;
  legendFormat: (value: number) => string;
  changeDetail: (base: number, end: number) => string;
  tooltipHtml: (tooltip: TooltipData) => string | null;
}

type TFn = (key: string) => string;

export function getModeConfig(
  t: TFn,
  locale: string,
  computed: ComputedData
): Record<ModeType, ModeConfigEntry> {
  const loc = locale === "fr" ? "fr-FR" : "en-GB";
  return {
    price: {
      label: t("priceLabel"),
      modeLabel: t("priceModeLabel"),
      getScale: (year, filter) =>
        getScaleForMode("price", year, filter, computed),
      legendFormat: (value) => `${Math.round(value).toLocaleString(loc)} €`,
      changeDetail: (base, end) =>
        `<small>${base.toLocaleString(loc)} ${ARROW_DARK} ${end.toLocaleString(loc)} ${t("unitPerSqm")}</small>`,
      tooltipHtml: (tooltip) =>
        tooltip.price >= 0
          ? `${tooltip.price.toLocaleString(loc)} ${t("unitPerSqm")}<br><small>${tooltip.nb} ${t("unitSales")}</small>`
          : null,
    },
    rent: {
      label: t("rentLabel"),
      modeLabel: t("rentModeLabel"),
      getScale: (year, filter) =>
        getScaleForMode("rent", year, filter, computed),
      legendFormat: (value) => `${value.toFixed(1)} €`,
      changeDetail: (base, end) =>
        `<small>${base.toFixed(1)} ${ARROW_DARK} ${end.toFixed(1)} ${t("unitPerSqmMonth")}</small>`,
      tooltipHtml: (tooltip) =>
        tooltip.rent >= 0
          ? `${tooltip.rent.toFixed(1)} ${t("unitPerSqmMonth")}<br><small>${tooltip.rentCount} ${t("unitListings")}</small>`
          : null,
    },
    yield: {
      label: t("yieldLabel"),
      modeLabel: t("yieldModeLabel"),
      getScale: (year, filter) =>
        getScaleForMode("yield", year, filter, computed),
      legendFormat: (value) => `${value.toFixed(1)}%`,
      changeDetail: (base, end) =>
        `<small>${base.toFixed(1)}% ${ARROW_DARK} ${end.toFixed(1)}% ${t("unitGrossYear")}</small>`,
      tooltipHtml: (tooltip) =>
        tooltip.yield >= 0
          ? `${tooltip.yield.toFixed(1)}% ${t("unitGrossYear")}<br><small>${tooltip.price.toLocaleString(loc)} ${t("unitPerSqm")} · ${tooltip.rent.toFixed(1)} ${t("unitPerSqmMonth")}</small>`
          : null,
    },
  };
}
