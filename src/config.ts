import type { FilterType, ModeType, YearData } from "./types";

export const FILTER_FIELDS: Record<
  FilterType,
  { price: keyof YearData; rent: (keyof YearData) | null; nb: keyof YearData; rentCount: (keyof YearData) | null }
> = {
  residential: { price: "med_m2", rent: "loyer_residentiel", nb: "nb", rentCount: "nb_loyer_residentiel" },
  house: { price: "med_m2_maison", rent: "loyer_maison", nb: "nb_maison", rentCount: "nb_loyer_maison" },
  apt: { price: "med_m2_appart", rent: "loyer_appart", nb: "nb_appart", rentCount: "nb_loyer_appart" },
  land: { price: "med_m2_terrain", rent: null, nb: "nb_terrain", rentCount: null },
};

export const ARR = (color = "#cbd5e1") =>
  `<svg width="14" height="8" viewBox="0 0 14 8" fill="none" style="vertical-align:middle;margin:0 2px"><path d="M1 4h12M9 1l4 3-4 3" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ARROW = ARR();
export const ARROW_DARK = ARR("#475569");

// ── Scale computation ────────────────────────────
function computePercentiles(values: (number | null | undefined)[]) {
  const sorted = values.filter((v): v is number => v != null).sort((a, b) => a - b);
  return {
    p4: sorted[Math.floor(sorted.length * 0.04)]!,
    p96: sorted[Math.floor(sorted.length * 0.96)]!,
  };
}

export type Scale = { p4: number; p96: number };

function buildScales(
  filterEntries: [string, ...string[]][],
  extractor: (s: YearData, ...fields: string[]) => number | null,
): Record<string, Scale> {
  const result: Record<string, Scale> = {};
  for (const year of ["all", ...YEARS.map(String)]) {
    for (const [filterKey, ...fields] of filterEntries) {
      const vals = COMMUNES.map((c) => {
        const s = year === "all" ? c : c.years?.[year];
        return s ? extractor(s, ...fields) : null;
      });
      result[`${year}_${filterKey}`] = computePercentiles(vals);
    }
  }
  return result;
}

export const scales: Record<string, Scale> = buildScales(
  Object.entries(FILTER_FIELDS).map(([k, v]) => [k, v.price as string]),
  (s, field) => (s as Record<string, unknown>)[field!] as number | null ?? null,
);

export const rentScales: Record<string, Scale> = buildScales(
  Object.entries(FILTER_FIELDS)
    .filter(([, v]) => v.rent)
    .map(([k, v]) => [k, v.rent as string]),
  (s, field) => (s as Record<string, unknown>)[field!] as number | null ?? null,
);

export const yieldScales: Record<string, Scale> = buildScales(
  Object.entries(FILTER_FIELDS)
    .filter(([, v]) => v.rent)
    .map(([k, v]) => [k, v.price as string, v.rent as string]),
  (s, pf, lf) => {
    const price = (s as Record<string, unknown>)[pf!] as number | null;
    const rent = (s as Record<string, unknown>)[lf!] as number | null;
    return price && rent ? ((rent * 12) / price) * 100 : null;
  },
);

export const changeScales: Record<string, Scale> = (() => {
  const result: Record<string, Scale> = {};
  const yearStrs = YEARS.map(String);
  const extractSimple = (c: { years?: Record<string, YearData> }, yr: string, f: string) =>
    (c.years?.[yr] as Record<string, unknown> | undefined)?.[f] as number | undefined;
  const extractYield = (c: { years?: Record<string, YearData> }, yr: string, pf: string, lf: string) => {
    const p = extractSimple(c, yr, pf);
    const l = extractSimple(c, yr, lf);
    return p && l ? ((l * 12) / p) * 100 : null;
  };
  const modes: [string, [string, ...string[]][], (c: typeof COMMUNES[number], yr: string, ...fields: string[]) => number | null | undefined][] = [
    [
      "price",
      Object.entries(FILTER_FIELDS).map(([k, v]) => [k, v.price as string]),
      (c, yr, f) => extractSimple(c, yr, f!),
    ],
    [
      "rent",
      Object.entries(FILTER_FIELDS).filter(([, v]) => v.rent).map(([k, v]) => [k, v.rent as string]),
      (c, yr, f) => extractSimple(c, yr, f!),
    ],
    [
      "yield",
      Object.entries(FILTER_FIELDS).filter(([, v]) => v.rent).map(([k, v]) => [k, v.price as string, v.rent as string]),
      (c, yr, pf, lf) => extractYield(c, yr, pf!, lf!),
    ],
  ];
  for (const baseYr of yearStrs) {
    for (const endYr of yearStrs) {
      if (endYr <= baseYr) continue;
      for (const [mode, filters, getVal] of modes) {
        for (const [fk, ...fields] of filters) {
          const vals = COMMUNES.map((c) => {
            const b = getVal(c, baseYr, ...fields);
            const e = getVal(c, endYr, ...fields);
            return b && e ? ((e - b) / b) * 100 : null;
          });
          result[`${baseYr}_${endYr}_${mode}_${fk}`] = computePercentiles(vals);
        }
      }
    }
  }
  return result;
})();

// ── Mode config ──────────────────────────────────
export interface ModeConfigEntry {
  label: string;
  modeLabel: string;
  getScale: (year: string, filter: FilterType) => Scale;
  legendFormat: (v: number) => string;
  changeDetail: (b: number, e: number) => string;
  tooltipHtml: (p: Record<string, unknown>) => string | null;
}

export const MODE_CONFIG: Record<ModeType, ModeConfigEntry> = {
  price: {
    label: "Prix médian au m²",
    modeLabel: "Prix",
    getScale: (year, filter) => scales[`${year}_${filter}`]!,
    legendFormat: (v) => `${Math.round(v).toLocaleString("fr-FR")} €`,
    changeDetail: (b, e) =>
      `<small>${b.toLocaleString("fr-FR")} ${ARROW_DARK} ${e.toLocaleString("fr-FR")} €/m²</small>`,
    tooltipHtml: (p) =>
      (p.price as number) >= 0
        ? `${Number(p.price).toLocaleString("fr-FR")} €/m²<br><small>${p.nb} ventes</small>`
        : null,
  },
  rent: {
    label: "Loyer au m² / mois",
    modeLabel: "Loyer",
    getScale: (year, filter) => rentScales[`${year}_${filter === "land" ? "residential" : filter}`]!,
    legendFormat: (v) => `${v.toFixed(1)} €`,
    changeDetail: (b, e) =>
      `<small>${b.toFixed(1)} ${ARROW_DARK} ${e.toFixed(1)} €/m²/mois</small>`,
    tooltipHtml: (p) =>
      (p.rent as number) >= 0
        ? `${Number(p.rent).toFixed(1)} €/m²/mois<br><small>${p.rentCount} annonces</small>`
        : null,
  },
  yield: {
    label: "Rentabilité brute / an",
    modeLabel: "Rentabilité",
    getScale: (year, filter) => yieldScales[`${year}_${filter}`]!,
    legendFormat: (v) => `${v.toFixed(1)}%`,
    changeDetail: (b, e) =>
      `<small>${b.toFixed(1)}% ${ARROW_DARK} ${e.toFixed(1)}% brut/an</small>`,
    tooltipHtml: (p) =>
      (p.yield as number) >= 0
        ? `${Number(p.yield).toFixed(1)}% brut/an<br><small>${Number(p.price).toLocaleString("fr-FR")} €/m² · ${Number(p.rent).toFixed(1)} €/m²/mois</small>`
        : null,
  },
};
