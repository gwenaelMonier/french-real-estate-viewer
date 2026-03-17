import { describe, expect, it } from "vitest";
import { FILTER_FIELDS, getModeConfig, getScaleForMode } from "./config";
import { TEST_COMPUTED } from "./test/fixtures";
import type { TooltipData } from "./types";

const { scales, rentScales, yieldScales, changeScales } = TEST_COMPUTED;
const computed = TEST_COMPUTED;

describe("FILTER_FIELDS", () => {
  it("has 4 keys", () => {
    expect(Object.keys(FILTER_FIELDS)).toEqual([
      "residential",
      "house",
      "apt",
      "land",
    ]);
  });

  it("land has rent: null", () => {
    expect(FILTER_FIELDS.land.rent).toBeNull();
  });
});

describe("scales", () => {
  it('has keys like "all_residential" and "2020_house"', () => {
    expect(scales.all_residential).toBeDefined();
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
    expect(rentScales.all_residential).toBeDefined();
  });
});

describe("yieldScales", () => {
  it("has no land entries", () => {
    const landKeys = Object.keys(yieldScales).filter((k) =>
      k.endsWith("_land")
    );
    expect(landKeys).toHaveLength(0);
  });
});

describe("getScaleForMode", () => {
  it("price → scales", () => {
    expect(getScaleForMode("price", "all", "residential", computed)).toBe(
      scales.all_residential
    );
  });

  it("rent + land → falls back to residential", () => {
    expect(getScaleForMode("rent", "all", "land", computed)).toBe(
      rentScales.all_residential
    );
  });

  it("yield → yieldScales", () => {
    expect(getScaleForMode("yield", "all", "residential", computed)).toBe(
      yieldScales.all_residential
    );
  });
});

describe("changeScales", () => {
  it('has keys like "2020_2023_price_residential"', () => {
    expect(changeScales["2020_2023_price_residential"]).toBeDefined();
  });

  it("no keys where endYear <= baseYear", () => {
    for (const key of Object.keys(changeScales)) {
      const parts = key.split("_");
      const base = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      expect(end, `key ${key}`).toBeGreaterThan(base);
    }
  });
});

describe("getModeConfig formatting", () => {
  const t = (key: string) => key;
  const config = getModeConfig(t, "fr", computed);

  describe("legendFormat", () => {
    it("price formats with euro and locale grouping", () => {
      const result = config.price.legendFormat(2345);
      expect(result).toContain("€");
      // fr-FR uses narrow no-break space (U+202F) as group separator
      expect(result).toMatch(/2\s*345/);
    });

    it("rent formats with one decimal and euro", () => {
      const result = config.rent.legendFormat(12.567);
      expect(result).toContain("12.6");
      expect(result).toContain("€");
    });

    it("yield formats with one decimal and percent", () => {
      const result = config.yield.legendFormat(5.432);
      expect(result).toContain("5.4%");
    });
  });

  describe("tooltipHtml", () => {
    const baseTooltip: TooltipData = {
      price: 3500,
      nb: 42,
      rent: 15.3,
      rentCount: 100,
      yield: 5.2,
      change: 10,
      changeBase: 2000,
      changeEnd: 2600,
    };

    it("price tooltip contains formatted price and nb", () => {
      const html = config.price.tooltipHtml(baseTooltip);
      expect(html).not.toBeNull();
      expect(html).toMatch(/3\s*500/);
      expect(html).toContain("42");
    });

    it("price tooltip returns null for negative price", () => {
      expect(
        config.price.tooltipHtml({ ...baseTooltip, price: -1 })
      ).toBeNull();
    });

    it("rent tooltip returns null for negative rent", () => {
      expect(config.rent.tooltipHtml({ ...baseTooltip, rent: -1 })).toBeNull();
    });

    it("yield tooltip returns null for negative yield", () => {
      expect(
        config.yield.tooltipHtml({ ...baseTooltip, yield: -1 })
      ).toBeNull();
    });
  });

  describe("changeDetail", () => {
    it("price changeDetail contains both formatted values", () => {
      const result = config.price.changeDetail(2000, 2600);
      expect(result).toMatch(/2\s*000/);
      expect(result).toMatch(/2\s*600/);
    });
  });
});
