import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import { DataContext } from "../context/DataContext";
import { TEST_CITIES, TEST_COMPUTED } from "./fixtures";
import i18nTest from "./i18n-test";

const TEST_YEARS = [2020, 2021, 2022, 2023];

const defaultData = {
  cities: TEST_CITIES,
  years: TEST_YEARS,
  computed: TEST_COMPUTED,
};

export function renderWith(
  ui: ReactElement,
  options?: RenderOptions & { data?: Partial<typeof defaultData> }
) {
  const { data, ...renderOptions } = options ?? {};
  const value = { ...defaultData, ...data };

  return render(
    <I18nextProvider i18n={i18nTest}>
      <DataContext.Provider value={value}>{ui}</DataContext.Provider>
    </I18nextProvider>,
    renderOptions
  );
}
