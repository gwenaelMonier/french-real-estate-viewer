import { MODE_CONFIG, ARROW_DARK, changeScales } from "../config";
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
  if (showChange) {
    const { modeLabel } = MODE_CONFIG[activeMode];
    const scale = changeScales[`${baseYear}_${endYear}_${activeMode}_${activeFilter}`];
    if (!scale) return null;
    const range = Math.max(Math.abs(scale.p4), Math.abs(scale.p96));

    return (
      <div
        className="legend"
        style={{ position: "absolute", bottom: 36, left: 10, zIndex: 1 }}
      >
        <b
          dangerouslySetInnerHTML={{
            __html: `Évol. ${modeLabel} ${baseYear} ${ARROW_DARK} ${endYear}`,
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
  if (!scale) return null;

  return (
    <div
      className="legend"
      style={{ position: "absolute", bottom: 36, left: 10, zIndex: 1 }}
    >
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
