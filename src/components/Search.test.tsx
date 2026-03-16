import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWith } from "../test/renderWith";
import Search from "./Search";

const mapRef = { current: { flyTo: vi.fn() } } as any;

describe("Search", () => {
  it("shows no results on mount", () => {
    const { container } = renderWith(<Search mapRef={mapRef} />);
    expect(container.querySelector("#search-results")).toBeNull();
  });

  it("typing filters communes", async () => {
    const user = userEvent.setup();
    const { container } = renderWith(<Search mapRef={mapRef} />);
    const input = container.querySelector("input")!;
    await user.type(input, "Ville");
    const items = container.querySelectorAll("#search-results li");
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].textContent).toContain("Ville-A");
  });

  it("startsWith matches are sorted first", async () => {
    const user = userEvent.setup();
    const { container } = renderWith(<Search mapRef={mapRef} />);
    const input = container.querySelector("input")!;
    await user.type(input, "par");
    const items = container.querySelectorAll("#search-results li");
    expect(items[0].textContent).toContain("Paris");
  });

  it("clicking a result calls flyTo and closes results", async () => {
    const flyTo = vi.fn();
    const ref = { current: { flyTo } } as any;
    const user = userEvent.setup();
    const { container } = renderWith(<Search mapRef={ref} />);
    const input = container.querySelector("input")!;
    await user.type(input, "Paris");
    const item = container.querySelector("#search-results li")!;
    await user.click(item);
    expect(flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [2.35, 48.86], zoom: 12 }),
    );
    expect(container.querySelector("#search-results")).toBeNull();
  });

  it("clear button resets the search", async () => {
    const user = userEvent.setup();
    const { container } = renderWith(<Search mapRef={mapRef} />);
    const input = container.querySelector("input") as HTMLInputElement;
    await user.type(input, "Paris");
    expect(input.value).toBe("Paris");
    const clearBtn = container.querySelector("button")!;
    await user.click(clearBtn);
    expect(input.value).toBe("");
  });

  it("normalizes accents for search", async () => {
    const user = userEvent.setup();
    const { container } = renderWith(<Search mapRef={mapRef} />);
    const input = container.querySelector("input")!;
    await user.type(input, "ville");
    const items = container.querySelectorAll("#search-results li");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
