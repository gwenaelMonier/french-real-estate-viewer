import { describe, it, expect } from "vitest";
import { TEST_COMMUNES, TEST_COMPUTED } from "./fixtures";
import {
  getStats,
  getValue,
  getChange,
  valueToColor,
  changeToColor,
  buildCityIndex,
  enrichGeoJSON,
} from "../data";

const [communeA, communeB, communeC, communeD] = TEST_COMMUNES;

const { changeScales } = TEST_COMPUTED;
const computed = TEST_COMPUTED;

// ── getStats ────────────────────────────────────────

describe("getStats", () => {
  it("returns yearly sub-object for a valid year", () => {
    const s = getStats(communeA, "2020");
    expect(s).toBe(communeA.years["2020"]);
  });

  it('returns the commune itself for "all"', () => {
    expect(getStats(communeA, "all")).toBe(communeA);
  });

  it("returns null for a missing year", () => {
    expect(getStats(communeA, "2019")).toBeNull();
  });

  it("returns null when years is empty", () => {
    expect(getStats(communeD, "2020")).toBeNull();
  });
});

// ── getValue ────────────────────────────────────────

describe("getValue", () => {
  it("price mode: returns correct median_sqm value", () => {
    expect(getValue(communeA, "price", "residential", "2020")).toBe(2000);
  });

  it("price mode: returns null when field is missing", () => {
    // communeB has no median_sqm_house in 2020
    expect(getValue(communeB, "price", "house", "2020")).toBeNull();
  });

  it("rent mode: returns correct rent field", () => {
    expect(getValue(communeA, "rent", "residential", "2020")).toBe(10);
  });

  it("rent mode + land filter: returns null (land has no rent)", () => {
    expect(getValue(communeA, "rent", "land", "2020")).toBeNull();
  });

  it("yield: computes (rent * 12 / price) * 100", () => {
    // communeA 2020: rent_residential=10, median_sqm=2000
    // yield = (10 * 12 / 2000) * 100 = 6.0
    expect(getValue(communeA, "yield", "residential", "2020")).toBe(6.0);
  });

  it("yield: returns null when price or rent missing", () => {
    // communeC 2022 has no rent_residential
    expect(getValue(communeC, "yield", "residential", "2022")).toBeNull();
  });

  it("yield: returns null for land filter (no rent field)", () => {
    expect(getValue(communeA, "yield", "land", "2020")).toBeNull();
  });

  it('year="all" uses aggregate data', () => {
    expect(getValue(communeA, "price", "residential", "all")).toBe(2300);
  });
});

// ── getChange ───────────────────────────────────────

describe("getChange", () => {
  it("price: correct pct, base, end", () => {
    // communeA: 2000 → 2600 = +30%
    const ch = getChange(communeA, "price", "residential", "2020", "2023");
    expect(ch).not.toBeNull();
    expect(ch!.base).toBe(2000);
    expect(ch!.end).toBe(2600);
    expect(ch!.pct).toBeCloseTo(30, 5);
  });

  it("returns null when base year missing", () => {
    expect(getChange(communeB, "price", "residential", "2021", "2023")).toBeNull();
  });

  it("rent mode: correct structure", () => {
    // communeA: rent_residential 2020=10, 2023=13 → +30%
    const ch = getChange(communeA, "rent", "residential", "2020", "2023");
    expect(ch).not.toBeNull();
    expect(ch!.base).toBe(10);
    expect(ch!.end).toBe(13);
    expect(ch!.pct).toBeCloseTo(30, 5);
  });

  it("yield mode: computes yield at both years and returns % change", () => {
    // communeA 2020: yield = (10*12/2000)*100 = 6.0
    // communeA 2023: yield = (13*12/2600)*100 = 6.0
    // pct = 0%
    const ch = getChange(communeA, "yield", "residential", "2020", "2023");
    expect(ch).not.toBeNull();
    expect(ch!.base).toBeCloseTo(6.0, 5);
    expect(ch!.end).toBeCloseTo(6.0, 5);
    expect(ch!.pct).toBeCloseTo(0, 5);
  });

  it("yield: returns null when rent missing at one year", () => {
    // communeB has no 2021 data at all
    expect(getChange(communeB, "yield", "residential", "2020", "2021")).toBeNull();
  });

  it("returns null for rent mode with land filter", () => {
    expect(getChange(communeA, "rent", "land", "2020", "2023")).toBeNull();
  });
});

// ── valueToColor ────────────────────────────────────

describe("valueToColor", () => {
  it("at p4 → green (hsl 120)", () => {
    expect(valueToColor(100, 100, 200)).toBe("hsl(120, 80%, 45%)");
  });

  it("at p96 → red (hsl 0)", () => {
    expect(valueToColor(200, 100, 200)).toBe("hsl(0, 80%, 45%)");
  });

  it("midpoint → yellow (hsl 60)", () => {
    expect(valueToColor(150, 100, 200)).toBe("hsl(60, 80%, 45%)");
  });

  it("below p4 → clamped to green", () => {
    expect(valueToColor(50, 100, 200)).toBe("hsl(120, 80%, 45%)");
  });

  it("above p96 → clamped to red", () => {
    expect(valueToColor(250, 100, 200)).toBe("hsl(0, 80%, 45%)");
  });
});

// ── changeToColor ───────────────────────────────────

describe("changeToColor", () => {
  it("known scale key → valid HSL string", () => {
    const keys = Object.keys(changeScales);
    expect(keys.length).toBeGreaterThan(0);
    const key = keys[0];
    const [baseYear, endYear, mode, filter] = key.split("_");
    const color = changeToColor(0, mode as any, filter as any, baseYear, endYear, changeScales);
    expect(color).toMatch(/^hsl\(\d+, 80%, 45%\)$/);
  });

  it("unknown key → empty string", () => {
    expect(changeToColor(10, "price", "residential", "1900", "1901", changeScales)).toBe("");
  });

  it("symmetric hues for ± same magnitude", () => {
    const keys = Object.keys(changeScales);
    const key = keys[0];
    const [baseYear, endYear, mode, filter] = key.split("_");
    const pos = changeToColor(5, mode as any, filter as any, baseYear, endYear, changeScales);
    const neg = changeToColor(-5, mode as any, filter as any, baseYear, endYear, changeScales);
    // Both should be valid colors
    expect(pos).toMatch(/^hsl\(\d+, 80%, 45%\)$/);
    expect(neg).toMatch(/^hsl\(\d+, 80%, 45%\)$/);
    // Extract hues — they should sum to 120 (symmetric around midpoint 60)
    const huePos = parseInt(pos.match(/hsl\((\d+)/)?.[1] ?? "0");
    const hueNeg = parseInt(neg.match(/hsl\((\d+)/)?.[1] ?? "0");
    expect(huePos + hueNeg).toBe(120);
  });
});

// ── cityIndex ───────────────────────────────────────

describe("buildCityIndex", () => {
  it("contains all fixtures keyed by city_code", () => {
    for (const c of TEST_COMMUNES) {
      expect(computed.cityIndex[c.city_code]).toBeDefined();
    }
  });

  it("lookup returns the correct object", () => {
    expect(computed.cityIndex["01001"]!.city_name).toBe("Ville-A");
    expect(computed.cityIndex["75056"]!.city_name).toBe("Paris");
  });
});

// ── enrichGeoJSON ───────────────────────────────────

describe("enrichGeoJSON", () => {
  function makeGeo(codes: string[]) {
    return {
      features: codes.map((code) => ({
        properties: { code, nom: `Nom-${code}` },
      })),
    };
  }

  it("value mode: sets fillColor, price, nb", () => {
    const geo = makeGeo(["01001"]);
    enrichGeoJSON(computed, geo, "price", "residential", "2020", false, "", "");
    const p = geo.features[0].properties as any;
    expect(p.price).toBe(2000);
    expect(p.nb).toBe(50);
    expect(p.fillColor).toMatch(/^hsl\(/);
  });

  it("unknown city code → defaults (price: -1, fillColor: '')", () => {
    const geo = makeGeo(["00000"]);
    enrichGeoJSON(computed, geo, "price", "residential", "2020", false, "", "");
    const p = geo.features[0].properties as any;
    expect(p.price).toBe(-1);
    expect(p.fillColor).toBe("");
  });

  it("change mode: sets change, changeBase, changeEnd", () => {
    const geo = makeGeo(["01001"]);
    enrichGeoJSON(computed, geo, "price", "residential", "all", true, "2020", "2023");
    const p = geo.features[0].properties as any;
    expect(p.change).toBeCloseTo(30, 0);
    expect(p.changeBase).toBe(2000);
    expect(p.changeEnd).toBe(2600);
    expect(p.fillColor).toMatch(/^hsl\(/);
  });

  it("change + insufficient data → change: -999, fillColor: ''", () => {
    // communeC (99999) has count=10 in 2022, below MIN_SAMPLES_PER_YEAR=15
    const geo = makeGeo(["99999"]);
    enrichGeoJSON(computed, geo, "price", "residential", "all", true, "2020", "2022");
    const p = geo.features[0].properties as any;
    expect(p.change).toBe(-999);
    expect(p.fillColor).toBe("");
  });

  it("empty features → no crash, returns same ref", () => {
    const geo = { features: [] };
    const result = enrichGeoJSON(computed, geo, "price", "residential", "2020", false, "", "");
    expect(result).toBe(geo);
    expect(result.features).toHaveLength(0);
  });
});
