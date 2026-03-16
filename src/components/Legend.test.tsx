import { describe, expect, it } from "vitest";
import { renderWith } from "../test/renderWith";
import Legend from "./Legend";

const baseProps = {
  activeMode: "price" as const,
  activeFilter: "residential" as const,
  activeYear: "all",
  showChange: false,
  baseYear: "2020",
  endYear: "2023",
};

describe("Legend", () => {
  it("renders value legend with p4/mid/p96 labels", () => {
    const { container } = renderWith(<Legend {...baseProps} />);
    const labels = container.querySelectorAll(".legend-labels span");
    expect(labels).toHaveLength(3);
    // p4=1500, p96=10000, mid=5750
    expect(labels[0].textContent).toContain("1");
    expect(labels[2].textContent).toContain("10");
  });

  it("renders change legend with ±range", () => {
    const { container } = renderWith(
      <Legend {...baseProps} showChange={true} />
    );
    const labels = container.querySelectorAll(".legend-labels span");
    expect(labels).toHaveLength(3);
    // changeScales 2020_2023_price_residential: p4=10.5, p96=30 → range=30
    expect(labels[0].textContent).toContain("-30%");
    expect(labels[1].textContent).toBe("0%");
    expect(labels[2].textContent).toContain("+30%");
  });

  it("returns null if no scale found", () => {
    const { container } = renderWith(
      <Legend {...baseProps} showChange={true} baseYear="2020" endYear="2020" />
    );
    expect(container.querySelector(".legend")).toBeNull();
  });
});
