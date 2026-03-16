import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWith } from "../test/renderWith";
import FilterPanel from "./FilterPanel";

const noop = () => {};

const baseProps = {
  activeMode: "price" as const,
  activeFilter: "residential" as const,
  activeYear: "all",
  showChange: false,
  baseYear: "2020",
  endYear: "2023",
  onModeChange: noop,
  onFilterChange: noop,
  onYearChange: noop,
  onViewModeChange: noop,
  onBaseYearChange: noop,
  onEndYearChange: noop,
};

describe("FilterPanel", () => {
  it("renders 3 mode tabs (price, rent, yield)", () => {
    const { container } = renderWith(<FilterPanel {...baseProps} />);
    const modeInputs = container.querySelectorAll('.mode-tabs input[name="mode"]');
    expect(modeInputs).toHaveLength(3);
  });

  it("shows 4 filters in price mode (including land)", () => {
    const { container } = renderWith(<FilterPanel {...baseProps} />);
    const filterInputs = container.querySelectorAll('input[name="filter"]');
    expect(filterInputs).toHaveLength(4);
  });

  it("shows 3 filters in rent mode (land hidden)", () => {
    const { container } = renderWith(
      <FilterPanel {...baseProps} activeMode="rent" />,
    );
    const filterInputs = container.querySelectorAll('input[name="filter"]');
    expect(filterInputs).toHaveLength(3);
  });

  it("shows year selector when showChange=false", () => {
    const { container } = renderWith(<FilterPanel {...baseProps} />);
    expect(container.querySelector('select[name="year"]')).not.toBeNull();
  });

  it("shows period sliders when showChange=true", () => {
    const { container } = renderWith(
      <FilterPanel {...baseProps} showChange={true} />,
    );
    expect(container.querySelector('select[name="year"]')).toBeNull();
    const sliders = container.querySelectorAll('input[type="range"]');
    expect(sliders).toHaveLength(2);
  });

  it("calls onModeChange when clicking a mode tab", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const { container } = renderWith(
      <FilterPanel {...baseProps} onModeChange={onModeChange} />,
    );
    const modeInputs = container.querySelectorAll('.mode-tabs input[name="mode"]');
    await user.click(modeInputs[1]); // "rent" radio input
    expect(onModeChange).toHaveBeenCalledWith("rent");
  });

  it("calls onFilterChange when clicking a filter", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const { container } = renderWith(
      <FilterPanel {...baseProps} onFilterChange={onFilterChange} />,
    );
    const filterInputs = container.querySelectorAll('input[name="filter"]');
    await user.click(filterInputs[2]); // "apt" radio input
    expect(onFilterChange).toHaveBeenCalledWith("apt");
  });

  it("calls onYearChange when selecting a year", async () => {
    const user = userEvent.setup();
    const onYearChange = vi.fn();
    const { container } = renderWith(
      <FilterPanel {...baseProps} onYearChange={onYearChange} />,
    );
    const select = container.querySelector('select[name="year"]') as HTMLSelectElement;
    await user.selectOptions(select, "2022");
    expect(onYearChange).toHaveBeenCalledWith("2022");
  });
});
