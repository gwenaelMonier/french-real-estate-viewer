import { Fragment, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FilterType, ModeType } from "../types";
import { ARROW_DARK } from "../config";
import { useData } from "../context/DataContext";

interface Props {
  activeMode: ModeType;
  activeFilter: FilterType;
  activeYear: string;
  showChange: boolean;
  baseYear: string;
  endYear: string;
  onModeChange: (mode: ModeType) => void;
  onFilterChange: (filter: FilterType) => void;
  onYearChange: (year: string) => void;
  onViewModeChange: (showChange: boolean) => void;
  onBaseYearChange: (year: string) => void;
  onEndYearChange: (year: string) => void;
}

function SegGroup({
  name,
  options,
  active,
  onChange,
}: {
  name: string;
  options: [string, string][];
  active: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="seg-group">
      {options.map(([val, label]) => (
        <Fragment key={val}>
          <input
            type="radio"
            name={name}
            id={`seg-${name}-${val}`}
            value={val}
            checked={active === val}
            onChange={() => onChange(val)}
          />
          <label htmlFor={`seg-${name}-${val}`}>{label}</label>
        </Fragment>
      ))}
    </div>
  );
}

export default function FilterPanel({
  activeMode,
  activeFilter,
  activeYear,
  showChange,
  baseYear,
  endYear,
  onModeChange,
  onFilterChange,
  onYearChange,
  onViewModeChange,
  onBaseYearChange,
  onEndYearChange,
}: Props) {
  const { t } = useTranslation();
  const { years } = useData();

  const modes: [ModeType, string][] = [
    ["price", t("modePrice")],
    ["rent", t("modeRent")],
    ["yield", t("modeYield")],
  ];

  const filterOptions: [string, string][] =
    activeMode === "rent" || activeMode === "yield"
      ? [
          ["residential", t("filterResidential")],
          ["house", t("filterHouse")],
          ["apt", t("filterApt")],
        ]
      : [
          ["residential", t("filterResidential")],
          ["house", t("filterHouse")],
          ["apt", t("filterApt")],
          ["land", t("filterLand")],
        ];

  const n = years.length - 1;
  const baseIdx = years.map(String).indexOf(baseYear);
  const endIdx = years.map(String).indexOf(endYear);

  const handleBaseSlider = (e: ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    if (idx >= endIdx) {
      e.target.value = String(endIdx - 1);
      return;
    }
    onBaseYearChange(String(years[idx]));
  };

  const handleEndSlider = (e: ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    if (idx <= baseIdx) {
      e.target.value = String(baseIdx + 1);
      return;
    }
    onEndYearChange(String(years[idx]));
  };

  return (
    <div
      className="filter-control"
      style={{ position: "absolute", top: 76, left: 10, zIndex: 1 }}
    >
      <div className="mode-tabs">
        {modes.map(([val, label]) => (
          <Fragment key={val}>
            <input
              type="radio"
              name="mode"
              id={`seg-mode-${val}`}
              value={val}
              checked={activeMode === val}
              onChange={() => onModeChange(val)}
            />
            <label htmlFor={`seg-mode-${val}`}>{label}</label>
          </Fragment>
        ))}
      </div>

      <div className="filter-body">
        <div className="filter-section">
          <SegGroup
            name="viewMode"
            options={[
              ["value", t("viewValue")],
              ["change", t("viewChange")],
            ]}
            active={showChange ? "change" : "value"}
            onChange={(val) => onViewModeChange(val === "change")}
          />
        </div>

        <div className="filter-section">
          <SegGroup
            name="filter"
            options={filterOptions}
            active={activeFilter}
            onChange={(val) => onFilterChange(val as FilterType)}
          />
        </div>

        {!showChange ? (
          <div className="filter-section">
            <div className="year-inline">
              <span className="filter-label">{t("yearLabel")}</span>
              <select
                name="year"
                className="filter-select"
                value={activeYear}
                onChange={(e) => onYearChange(e.target.value)}
              >
                <option value="all">{t("yearAll")}</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="filter-section">
            <div className="year-slider-header">
              <span className="filter-label">{t("periodLabel")}</span>
              <span
                className="year-slider-values"
                dangerouslySetInnerHTML={{
                  __html: `<span>${baseYear}</span> ${ARROW_DARK} <span>${endYear}</span>`,
                }}
              />
            </div>
            <div className="year-slider-wrap">
              <div className="year-slider-bg">
                <div
                  className="year-slider-fill"
                  style={{
                    left: `${(baseIdx / n) * 100}%`,
                    width: `${((endIdx - baseIdx) / n) * 100}%`,
                  }}
                />
              </div>
              <input
                type="range"
                className="year-slider"
                name="baseYearIdx"
                min="0"
                max={n}
                step="1"
                value={baseIdx}
                onInput={handleBaseSlider}
              />
              <input
                type="range"
                className="year-slider"
                name="endYearIdx"
                min="0"
                max={n}
                step="1"
                value={endIdx}
                onInput={handleEndSlider}
              />
            </div>
            <div className="year-slider-ticks">
              {years.map((y) => (
                <span key={y}>{y}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
