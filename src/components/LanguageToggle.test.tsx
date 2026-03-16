import { describe, it, expect } from "vitest";
import { renderWith } from "../test/renderWith";
import LanguageToggle from "./LanguageToggle";
import i18nTest from "../test/i18n-test";

describe("LanguageToggle", () => {
  it("FR button has active class when lang=fr", () => {
    i18nTest.changeLanguage("fr");
    const { container } = renderWith(<LanguageToggle />);
    const buttons = container.querySelectorAll("button");
    expect(buttons[0]).toHaveClass("active");
  });

  it("EN button does not have active class when lang=fr", () => {
    i18nTest.changeLanguage("fr");
    const { container } = renderWith(<LanguageToggle />);
    const buttons = container.querySelectorAll("button");
    expect(buttons[1]).not.toHaveClass("active");
  });

  it("clicking EN calls changeLanguage('en')", async () => {
    i18nTest.changeLanguage("fr");
    const { container } = renderWith(<LanguageToggle />);
    const enButton = container.querySelectorAll("button")[1];
    enButton.click();
    expect(i18nTest.language).toBe("en");
  });

  it("updates document.documentElement.lang", async () => {
    i18nTest.changeLanguage("fr");
    renderWith(<LanguageToggle />);
    expect(document.documentElement.lang).toBe("fr");
  });
});
