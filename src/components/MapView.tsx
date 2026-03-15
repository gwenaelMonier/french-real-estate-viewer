import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { FilterType, ModeType } from "../types";
import { getModeConfig, ARROW_DARK } from "../config";
import { applyAllFeatureStates, getTooltipData } from "../data";
import { useData } from "../context/DataContext";

const protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

interface Props {
  activeFilter: FilterType;
  activeYear: string;
  activeMode: ModeType;
  showChange: boolean;
  baseYear: string;
  endYear: string;
  onMapReady: (map: maplibregl.Map, popup: maplibregl.Popup) => void;
}

export default function MapView({
  activeFilter,
  activeYear,
  activeMode,
  showChange,
  baseYear,
  endYear,
  onMapReady,
}: Props) {
  const { t, i18n } = useTranslation();
  const { computed } = useData();
  const [tilesLoading, setTilesLoading] = useState<boolean | null>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const popupInstanceRef = useRef<maplibregl.Popup | null>(null);
  const sourceReadyRef = useRef(false);

  // Keep a ref to current state for tooltip closure
  const stateRef = useRef({ activeFilter, activeYear, activeMode, showChange, baseYear, endYear, t, locale: i18n.language, computed });
  stateRef.current = { activeFilter, activeYear, activeMode, showChange, baseYear, endYear, t, locale: i18n.language, computed };

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [1.888334, 46.603354],
      zoom: 6,
      attributionControl: { compact: true },
    });

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    });

    mapInstanceRef.current = map;
    popupInstanceRef.current = popup;
    onMapReady(map, popup);

    map.on("load", () => {
      const labelLayerId = map
        .getStyle()
        .layers.find((l) => l.type === "symbol")?.id;

      map.addSource("communes", {
        type: "vector",
        url: "pmtiles:///communes.pmtiles",
        promoteId: { communes: "code" },
      });

      map.addLayer(
        {
          id: "communes-fill",
          type: "fill",
          source: "communes",
          "source-layer": "communes",
          paint: {
            "fill-color": [
              "coalesce",
              ["feature-state", "fillColor"],
              "rgba(0,0,0,0)",
            ],
            "fill-opacity": 0,
          },
        },
        labelLayerId,
      );

      map.addLayer(
        {
          id: "communes-line",
          type: "line",
          source: "communes",
          "source-layer": "communes",
          paint: {
            "line-color": "#888",
            "line-width": 0.3,
            "line-opacity": 0,
          },
        },
        labelLayerId,
      );

      sourceReadyRef.current = true;
      const st = stateRef.current;
      applyAllFeatureStates(map, st.computed, st.activeMode, st.activeFilter, st.activeYear, st.showChange, st.baseYear, st.endYear);
      map.once("idle", () => {
        map.setPaintProperty("communes-fill", "fill-opacity", 0.45);
        map.setPaintProperty("communes-line", "line-opacity", 0.15);
        setTilesLoading(false);
      });

      map.on("mousemove", "communes-fill", (e) => {
        if (!e.features?.[0]) return;
        const code = String(e.features[0].properties!.code);
        const st = stateRef.current;
        const c = st.computed.cityIndex[code];
        const cityName = c?.city_name ?? e.features[0].properties!.nom ?? "";
        const deptCode = c?.dept_code ?? "";
        if (!cityName) return;
        map.getCanvas().style.cursor = "pointer";
        const cfg = getModeConfig(st.t, st.locale, st.computed)[st.activeMode];
        const td = getTooltipData(c, st.activeMode, st.activeFilter, st.activeYear, st.showChange, st.baseYear, st.endYear);
        let html: string;
        if (st.showChange && td.change > -999) {
          const sign = td.change >= 0 ? "+" : "";
          const detail = cfg.changeDetail(td.changeBase, td.changeEnd);
          html = `<b>${cityName}</b> (${deptCode})<br>${sign}${td.change.toFixed(1)}% (${st.baseYear} ${ARROW_DARK} ${st.endYear})<br>${detail}`;
        } else {
          const body = cfg.tooltipHtml(td as unknown as Record<string, unknown>);
          html = body
            ? `<b>${cityName}</b> (${deptCode})<br>${body}`
            : `<b>${cityName}</b><br><small style="color:#999">${st.t("noData")}</small>`;
        }
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "communes-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw on state change
  useEffect(() => {
    if (!sourceReadyRef.current) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    applyAllFeatureStates(map, computed, activeMode, activeFilter, activeYear, showChange, baseYear, endYear);
  }, [activeFilter, activeYear, activeMode, showChange, baseYear, endYear, computed]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div id="map" ref={containerRef} />
      {tilesLoading !== null && (
        <div className={`map-loader${tilesLoading ? "" : " map-loader--hidden"}`} onTransitionEnd={() => setTilesLoading(null)} />
      )}
    </div>
  );
}
