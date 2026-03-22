import { describe, expect, it } from "vitest";
import { normalize } from "./utils";

describe("normalize", () => {
  it('"Paris" → "paris"', () => {
    expect(normalize("Paris")).toBe("paris");
  });

  it('"Béziers" → "beziers"', () => {
    expect(normalize("Béziers")).toBe("beziers");
  });

  it('"Saint-Étienne-du-Rouvray" → "saint etienne du rouvray"', () => {
    expect(normalize("Saint-Étienne-du-Rouvray")).toBe(
      "saint etienne du rouvray"
    );
  });

  it('"pont du casse" matches "pont-du-casse"', () => {
    expect(normalize("pont du casse")).toBe(normalize("pont-du-casse"));
  });

  it('"lyon" → "lyon"', () => {
    expect(normalize("lyon")).toBe("lyon");
  });

  it('"" → ""', () => {
    expect(normalize("")).toBe("");
  });
});
