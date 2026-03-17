import {
  BarChart2,
  Building,
  Building2,
  DollarSign,
  Home,
  House,
  Layers,
  type LucideIcon,
  Percent,
  TrendingUp,
  X,
} from "lucide-react";
import { type ChangeEvent, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { ARROW_DARK } from "../config";
import { useData } from "../context/DataContext";
import type { FilterType, ModeType } from "../types";

interface Props {
  activeMode: ModeType;
  activeFilter: FilterType;
  activeYear: string;
  showChange: boolean;
  baseYear: string;
  endYear: string;
  isOpen?: boolean;
  onClose: () => void;
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
  wrap,
}: {
  name: string;
  options: [string, string, LucideIcon?][];
  active: string;
  onChange: (val: string) => void;
  wrap?: boolean;
}) {
  return (
    <div className={`seg-group${wrap ? " seg-group--wrap" : ""}`}>
      {options.map(([val, label, Icon]) => (
        <Fragment key={val}>
          <input
            type="radio"
            name={name}
            id={`seg-${name}-${val}`}
            value={val}
            checked={active === val}
            onChange={() => onChange(val)}
          />
          <label htmlFor={`seg-${name}-${val}`}>
            {Icon && <Icon size={13} />}
            {label}
          </label>
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
  isOpen,
  onClose,
  onModeChange,
  onFilterChange,
  onYearChange,
  onViewModeChange,
  onBaseYearChange,
  onEndYearChange,
}: Props) {
  const { t } = useTranslation();
  const { years } = useData();

  const modes: [ModeType, string, LucideIcon][] = [
    ["price", t("modePrice"), DollarSign],
    ["rent", t("modeRent"), Home],
    ["yield", t("modeYield"), Percent],
  ];

  const filterOptions: [string, string, LucideIcon][] =
    activeMode === "rent" || activeMode === "yield"
      ? [
          ["residential", t("filterResidential"), Building2],
          ["house", t("filterHouse"), House],
          ["apt", t("filterApt"), Building],
        ]
      : [
          ["residential", t("filterResidential"), Building2],
          ["house", t("filterHouse"), House],
          ["apt", t("filterApt"), Building],
          ["land", t("filterLand"), Layers],
        ];

  const lastIndex = years.length - 1;
  const baseYearIndex = years.map(String).indexOf(baseYear);
  const endYearIndex = years.map(String).indexOf(endYear);

  const handleBaseSlider = (e: ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    if (index >= endYearIndex) {
      e.target.value = String(endYearIndex - 1);
      return;
    }
    onBaseYearChange(String(years[index]));
  };

  const handleEndSlider = (e: ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    if (index <= baseYearIndex) {
      e.target.value = String(baseYearIndex + 1);
      return;
    }
    onEndYearChange(String(years[index]));
  };

  return (
    <div
      className={`filter-control${isOpen ? " drawer-open" : ""}`}
    >
      <div className="drawer-header">
        <button className="drawer-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="mode-tabs">
        {modes.map(([val, label, Icon]) => (
          <Fragment key={val}>
            <input
              type="radio"
              name="mode"
              id={`seg-mode-${val}`}
              value={val}
              checked={activeMode === val}
              onChange={() => onModeChange(val)}
            />
            <label htmlFor={`seg-mode-${val}`}>
              <Icon size={14} />
              {label}
            </label>
          </Fragment>
        ))}
      </div>

      <div className="filter-body">
        <div className="filter-section">
          <SegGroup
            name="viewMode"
            options={[
              ["value", t("viewValue"), BarChart2],
              ["change", t("viewChange"), TrendingUp],
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
            wrap={filterOptions.length > 3}
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
                    left: `${(baseYearIndex / lastIndex) * 100}%`,
                    width: `${((endYearIndex - baseYearIndex) / lastIndex) * 100}%`,
                  }}
                />
              </div>
              <input
                type="range"
                className="year-slider"
                name="baseYearIdx"
                min="0"
                max={lastIndex}
                step="1"
                value={baseYearIndex}
                onChange={handleBaseSlider}
              />
              <input
                type="range"
                className="year-slider"
                name="endYearIdx"
                min="0"
                max={lastIndex}
                step="1"
                value={endYearIndex}
                onChange={handleEndSlider}
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
