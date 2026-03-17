import { useTranslation } from "react-i18next";
import { ARROW_DARK, getModeConfig } from "../config";
import { useData } from "../context/DataContext";
import type { FilterType, ModeType } from "../types";

interface Props {
  activeMode: ModeType;
  activeFilter: FilterType;
  activeYear: string;
  showChange: boolean;
  baseYear: string;
  endYear: string;
}

export default function Legend({
  activeMode,
  activeFilter,
  activeYear,
  showChange,
  baseYear,
  endYear,
}: Props) {
  const { t, i18n } = useTranslation();
  const { computed } = useData();
  const MODE_CONFIG = getModeConfig(t, i18n.language, computed);

  if (showChange) {
    const { modeLabel } = MODE_CONFIG[activeMode];
    const scale =
      computed.changeScales[
        `${baseYear}_${endYear}_${activeMode}_${activeFilter}`
      ];
    if (!scale) {
      return null;
    }
    const range = Math.max(Math.abs(scale.p4), Math.abs(scale.p96));

    return (
      <div className="legend">
        <b
          dangerouslySetInnerHTML={{
            __html: `${t("evolPrefix")} ${modeLabel} ${baseYear} ${ARROW_DARK} ${endYear}`,
          }}
        />
        <div className="legend-gradient legend-gradient-evol" />
        <div className="legend-labels">
          <span>{(-range).toFixed(0)}%</span>
          <span>0%</span>
          <span>+{range.toFixed(0)}%</span>
        </div>
      </div>
    );
  }

  const cfg = MODE_CONFIG[activeMode];
  const scale = cfg.getScale(activeYear, activeFilter);
  if (!scale) {
    return null;
  }

  return (
    <div className="legend">
      <b>{cfg.label}</b>
      <div className="legend-gradient" />
      <div className="legend-labels">
        <span>{cfg.legendFormat(scale.p4)}</span>
        <span>{cfg.legendFormat((scale.p4 + scale.p96) / 2)}</span>
        <span>{cfg.legendFormat(scale.p96)}</span>
      </div>
    </div>
  );
}
