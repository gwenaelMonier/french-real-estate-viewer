import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const i18nTest = i18n.createInstance();
i18nTest.use(initReactI18next).init({
  lng: "fr",
  fallbackLng: "fr",
  resources: {},
  interpolation: { escapeValue: false },
  parseMissingKeyHandler: (key: string) => key,
});

export default i18nTest;
