import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  onClose: noop,
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
    const modeInputs = container.querySelectorAll(
      '.mode-tabs input[name="mode"]'
    );
    expect(modeInputs).toHaveLength(3);
  });

  it("shows 4 filters in price mode (including land)", () => {
    const { container } = renderWith(<FilterPanel {...baseProps} />);
    const filterInputs = container.querySelectorAll('input[name="filter"]');
    expect(filterInputs).toHaveLength(4);
  });

  it("shows 3 filters in rent mode (land hidden)", () => {
    const { container } = renderWith(
      <FilterPanel {...baseProps} activeMode="rent" />
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
      <FilterPanel {...baseProps} showChange={true} />
    );
    expect(container.querySelector('select[name="year"]')).toBeNull();
    const sliders = container.querySelectorAll('input[type="range"]');
    expect(sliders).toHaveLength(2);
  });

  it("calls onModeChange when clicking a mode tab", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const { container } = renderWith(
      <FilterPanel {...baseProps} onModeChange={onModeChange} />
    );
    const modeInputs = container.querySelectorAll(
      '.mode-tabs input[name="mode"]'
    );
    await user.click(modeInputs[1]); // "rent" radio input
    expect(onModeChange).toHaveBeenCalledWith("rent");
  });

  it("calls onFilterChange when clicking a filter", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const { container } = renderWith(
      <FilterPanel {...baseProps} onFilterChange={onFilterChange} />
    );
    const filterInputs = container.querySelectorAll('input[name="filter"]');
    await user.click(filterInputs[2]); // "apt" radio input
    expect(onFilterChange).toHaveBeenCalledWith("apt");
  });

  it("calls onYearChange when selecting a year", async () => {
    const user = userEvent.setup();
    const onYearChange = vi.fn();
    const { container } = renderWith(
      <FilterPanel {...baseProps} onYearChange={onYearChange} />
    );
    const select = container.querySelector(
      'select[name="year"]'
    ) as HTMLSelectElement;
    await user.selectOptions(select, "2022");
    expect(onYearChange).toHaveBeenCalledWith("2022");
  });

  it("calls onClose when clicking the drawer close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = renderWith(
      <FilterPanel {...baseProps} onClose={onClose} />
    );
    const closeButton = container.querySelector(
      ".drawer-close"
    ) as HTMLButtonElement;
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe("slider guards", () => {
    // years = [2020, 2021, 2022, 2023], baseYear="2020" (idx 0), endYear="2023" (idx 3)
    it("base slider cannot exceed end slider", () => {
      const onBaseYearChange = vi.fn();
      const { container } = renderWith(
        <FilterPanel
          {...baseProps}
          showChange={true}
          onBaseYearChange={onBaseYearChange}
        />
      );
      const baseSlider = container.querySelector(
        'input[name="baseYearIdx"]'
      ) as HTMLInputElement;
      // Try to set base to index 3 (same as end) — should be rejected
      fireEvent.change(baseSlider, { target: { value: "3" } });
      expect(onBaseYearChange).not.toHaveBeenCalled();
    });

    it("end slider cannot go below base slider", () => {
      const onEndYearChange = vi.fn();
      const { container } = renderWith(
        <FilterPanel
          {...baseProps}
          showChange={true}
          onEndYearChange={onEndYearChange}
        />
      );
      const endSlider = container.querySelector(
        'input[name="endYearIdx"]'
      ) as HTMLInputElement;
      // Try to set end to index 0 (same as base) — should be rejected
      fireEvent.change(endSlider, { target: { value: "0" } });
      expect(onEndYearChange).not.toHaveBeenCalled();
    });

    it("valid base slider change calls onBaseYearChange", () => {
      const onBaseYearChange = vi.fn();
      const { container } = renderWith(
        <FilterPanel
          {...baseProps}
          showChange={true}
          onBaseYearChange={onBaseYearChange}
        />
      );
      const baseSlider = container.querySelector(
        'input[name="baseYearIdx"]'
      ) as HTMLInputElement;
      // Set base to index 1 (2021) — valid since end is at index 3
      fireEvent.change(baseSlider, { target: { value: "1" } });
      expect(onBaseYearChange).toHaveBeenCalledWith("2021");
    });

    it("valid end slider change calls onEndYearChange", () => {
      const onEndYearChange = vi.fn();
      const { container } = renderWith(
        <FilterPanel
          {...baseProps}
          showChange={true}
          onEndYearChange={onEndYearChange}
        />
      );
      const endSlider = container.querySelector(
        'input[name="endYearIdx"]'
      ) as HTMLInputElement;
      // Set end to index 2 (2022) — valid since base is at index 0
      fireEvent.change(endSlider, { target: { value: "2" } });
      expect(onEndYearChange).toHaveBeenCalledWith("2022");
    });
  });
});
