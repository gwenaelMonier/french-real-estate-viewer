import { describe, it, expect } from "vitest";
import { normalize } from "../utils";

describe("normalize", () => {
  it('"Paris" → "paris"', () => {
    expect(normalize("Paris")).toBe("paris");
  });

  it('"Béziers" → "beziers"', () => {
    expect(normalize("Béziers")).toBe("beziers");
  });

  it('"Saint-Étienne-du-Rouvray" → "saint-etienne-du-rouvray"', () => {
    expect(normalize("Saint-Étienne-du-Rouvray")).toBe("saint-etienne-du-rouvray");
  });

  it('"lyon" → "lyon"', () => {
    expect(normalize("lyon")).toBe("lyon");
  });

  it('"" → ""', () => {
    expect(normalize("")).toBe("");
  });
});
