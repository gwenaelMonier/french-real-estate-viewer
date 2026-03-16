import { describe, it, expect } from "vitest";
import { TEST_COMPUTED } from "./test/fixtures";
import {
  FILTER_FIELDS,
  getScaleForMode,
} from "./config";

const { scales, rentScales, yieldScales, changeScales } = TEST_COMPUTED;
const computed = TEST_COMPUTED;

describe("FILTER_FIELDS", () => {
  it("has 4 keys", () => {
    expect(Object.keys(FILTER_FIELDS)).toEqual(["residential", "house", "apt", "land"]);
  });

  it("land has rent: null", () => {
    expect(FILTER_FIELDS.land.rent).toBeNull();
  });
});

describe("scales", () => {
  it('has keys like "all_residential" and "2020_house"', () => {
    expect(scales["all_residential"]).toBeDefined();
    expect(scales["2020_house"]).toBeDefined();
  });

  it("each scale has p4 <= p96", () => {
    for (const [key, s] of Object.entries(scales)) {
      expect(s.p4, `scale ${key}`).toBeLessThanOrEqual(s.p96);
    }
  });
});

describe("rentScales", () => {
  it("has no land entries", () => {
    const landKeys = Object.keys(rentScales).filter((k) => k.endsWith("_land"));
    expect(landKeys).toHaveLength(0);
  });

  it("has residential entries", () => {
    expect(rentScales["all_residential"]).toBeDefined();
  });
});

describe("yieldScales", () => {
  it("has no land entries", () => {
    const landKeys = Object.keys(yieldScales).filter((k) => k.endsWith("_land"));
    expect(landKeys).toHaveLength(0);
  });
});

describe("getScaleForMode", () => {
  it("price → scales", () => {
    expect(getScaleForMode("price", "all", "residential", computed)).toBe(scales["all_residential"]);
  });

  it("rent + land → falls back to residential", () => {
    expect(getScaleForMode("rent", "all", "land", computed)).toBe(rentScales["all_residential"]);
  });

  it("yield → yieldScales", () => {
    expect(getScaleForMode("yield", "all", "residential", computed)).toBe(yieldScales["all_residential"]);
  });
});

describe("changeScales", () => {
  it('has keys like "2020_2023_price_residential"', () => {
    expect(changeScales["2020_2023_price_residential"]).toBeDefined();
  });

  it("no keys where endYear <= baseYear", () => {
    for (const key of Object.keys(changeScales)) {
      const parts = key.split("_");
      const base = parseInt(parts[0]);
      const end = parseInt(parts[1]);
      expect(end, `key ${key}`).toBeGreaterThan(base);
    }
  });
});
