import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t("pageTitle");
  }, [lang, t]);

  return (
    <div className="lang-toggle">
      <button
        className={lang === "fr" ? "active" : ""}
        onClick={() => i18n.changeLanguage("fr")}
      >
        🇫🇷&nbsp; FR
      </button>
      <button
        className={lang === "en" ? "active" : ""}
        onClick={() => i18n.changeLanguage("en")}
      >
        🇬🇧&nbsp; EN
      </button>
    </div>
  );
}
