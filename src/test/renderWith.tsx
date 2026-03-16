import { render, type RenderOptions } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { DataContext } from "../context/DataContext";
import { TEST_COMMUNES, TEST_COMPUTED } from "./fixtures";
import i18nTest from "./i18n-test";
import type { ReactElement } from "react";

const TEST_YEARS = [2020, 2021, 2022, 2023];

const defaultData = {
  communes: TEST_COMMUNES,
  years: TEST_YEARS,
  computed: TEST_COMPUTED,
};

export function renderWith(
  ui: ReactElement,
  options?: RenderOptions & { data?: Partial<typeof defaultData> },
) {
  const { data, ...renderOptions } = options ?? {};
  const value = { ...defaultData, ...data };

  return render(
    <I18nextProvider i18n={i18nTest}>
      <DataContext.Provider value={value}>{ui}</DataContext.Provider>
    </I18nextProvider>,
    renderOptions,
  );
}
