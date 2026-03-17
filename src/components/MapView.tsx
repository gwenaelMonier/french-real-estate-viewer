import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ARROW_DARK, getModeConfig } from "../config";
import { useData } from "../context/DataContext";
import { applyAllFeatureStates, getTooltipData } from "../data";
import type { FilterType, ModeType } from "../types";

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
  const stateRef = useRef({
    activeFilter,
    activeYear,
    activeMode,
    showChange,
    baseYear,
    endYear,
    t,
    locale: i18n.language,
    computed,
  });
  stateRef.current = {
    activeFilter,
    activeYear,
    activeMode,
    showChange,
    baseYear,
    endYear,
    t,
    locale: i18n.language,
    computed,
  };

  // Init map once
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

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

      map.addSource("cities", {
        type: "vector",
        url: `pmtiles://${import.meta.env.BASE_URL}cities.pmtiles`,
        promoteId: { cities: "code" },
      });

      map.addLayer(
        {
          id: "cities-fill",
          type: "fill",
          source: "cities",
          "source-layer": "cities",
          paint: {
            "fill-color": [
              "coalesce",
              ["feature-state", "fillColor"],
              "rgba(0,0,0,0)",
            ],
            "fill-opacity": 0,
          },
        },
        labelLayerId
      );

      map.addLayer(
        {
          id: "cities-line",
          type: "line",
          source: "cities",
          "source-layer": "cities",
          paint: {
            "line-color": "#888",
            "line-width": 0.3,
            "line-opacity": 0,
          },
        },
        labelLayerId
      );

      sourceReadyRef.current = true;
      const state = stateRef.current;
      applyAllFeatureStates(
        map,
        state.computed,
        state.activeMode,
        state.activeFilter,
        state.activeYear,
        state.showChange,
        state.baseYear,
        state.endYear
      );
      map.once("idle", () => {
        map.setPaintProperty("cities-fill", "fill-opacity", 0.45);
        map.setPaintProperty("cities-line", "line-opacity", 0.15);
        setTilesLoading(false);
      });

      map.on("mousemove", "cities-fill", (e) => {
        if (!e.features?.[0]) {
          return;
        }
        const code = String(e.features[0].properties?.code);
        const state = stateRef.current;
        const city = state.computed.cityIndex[code];
        const cityName = city?.city_name ?? e.features[0].properties?.nom ?? "";
        const deptCode = city?.dept_code ?? "";
        if (!cityName) {
          return;
        }
        map.getCanvas().style.cursor = "pointer";
        const cfg = getModeConfig(state.t, state.locale, state.computed)[
          state.activeMode
        ];
        const td = getTooltipData(
          city,
          state.activeMode,
          state.activeFilter,
          state.activeYear,
          state.showChange,
          state.baseYear,
          state.endYear
        );
        let html: string;
        if (state.showChange && td.change > -999) {
          const sign = td.change >= 0 ? "+" : "";
          const detail = cfg.changeDetail(td.changeBase, td.changeEnd);
          html = `<b>${cityName}</b> (${deptCode})<br>${sign}${td.change.toFixed(1)}% (${state.baseYear} ${ARROW_DARK} ${state.endYear})<br>${detail}`;
        } else {
          const body = cfg.tooltipHtml(td);
          html = body
            ? `<b>${cityName}</b> (${deptCode})<br>${body}`
            : `<b>${cityName}</b><br><small style="color:#999">${state.t("noData")}</small>`;
        }
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "cities-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });

    return () => {
      map.remove();
    };
  }, []);

  // Redraw on state change
  useEffect(() => {
    if (!sourceReadyRef.current) {
      return;
    }
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }
    applyAllFeatureStates(
      map,
      computed,
      activeMode,
      activeFilter,
      activeYear,
      showChange,
      baseYear,
      endYear
    );
  }, [
    activeFilter,
    activeYear,
    activeMode,
    showChange,
    baseYear,
    endYear,
    computed,
  ]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div id="map" ref={containerRef} />
      {tilesLoading !== null && (
        <div
          className={`map-loader${tilesLoading ? "" : " map-loader--hidden"}`}
          onTransitionEnd={() => setTilesLoading(null)}
        />
      )}
    </div>
  );
}
