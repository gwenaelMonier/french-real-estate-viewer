import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import maplibregl from "maplibre-gl";
import type { FilterType, ModeType } from "../types";
import { getModeConfig, ARROW_DARK } from "../config";
import { enrichGeoJSON } from "../data";
import { useData } from "../context/DataContext";

interface Props {
  activeFilter: FilterType;
  activeYear: string;
  activeMode: ModeType;
  showChange: boolean;
  baseYear: string;
  endYear: string;
  onMapReady: (map: maplibregl.Map, popup: maplibregl.Popup) => void;
}

const GEOJSON_URL =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes-version-simplifiee.geojson";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geojsonCacheRef = useRef<any>(null);
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
      fetch(GEOJSON_URL)
        .then((r) => r.json())
        .then((geojson) => {
          const st = stateRef.current;
          geojsonCacheRef.current = enrichGeoJSON(
            stateRef.current.computed,
            geojson,
            st.activeMode,
            st.activeFilter,
            st.activeYear,
            st.showChange,
            st.baseYear,
            st.endYear,
          );

          const labelLayerId = map
            .getStyle()
            .layers.find((l) => l.type === "symbol")?.id;

          map.addSource("communes", {
            type: "geojson",
            data: geojsonCacheRef.current,
          });

          map.addLayer(
            {
              id: "communes-fill",
              type: "fill",
              source: "communes",
              paint: {
                "fill-color": [
                  "case",
                  ["!=", ["get", "fillColor"], ""],
                  ["get", "fillColor"],
                  "rgba(0,0,0,0)",
                ],
                "fill-opacity": 0.45,
              },
            },
            labelLayerId,
          );

          map.addLayer(
            {
              id: "communes-line",
              type: "line",
              source: "communes",
              paint: {
                "line-color": "#888",
                "line-width": 0.3,
                "line-opacity": 0.15,
              },
            },
            labelLayerId,
          );

          sourceReadyRef.current = true;
          map.once("idle", () => setTilesLoading(false));

          map.on("mousemove", "communes-fill", (e) => {
            if (!e.features?.[0]) return;
            const p = e.features[0].properties!;
            if (!p.cityName) return;
            map.getCanvas().style.cursor = "pointer";
            const st = stateRef.current;
            const cfg = getModeConfig(st.t, st.locale, st.computed)[st.activeMode];
            let html: string;
            if (st.showChange && (p.change as number) > -999) {
              const sign = (p.change as number) >= 0 ? "+" : "";
              const detail = cfg.changeDetail(
                Number(p.changeBase),
                Number(p.changeEnd),
              );
              html = `<b>${p.cityName}</b> (${p.deptCode})<br>${sign}${Number(p.change).toFixed(1)}% (${st.baseYear} ${ARROW_DARK} ${st.endYear})<br>${detail}`;
            } else {
              const body = cfg.tooltipHtml(p as Record<string, unknown>);
              html = body
                ? `<b>${p.cityName}</b> (${p.deptCode})<br>${body}`
                : `<b>${p.cityName}</b><br><small style="color:#999">${st.t("noData")}</small>`;
            }
            popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
          });

          map.on("mouseleave", "communes-fill", () => {
            map.getCanvas().style.cursor = "";
            popup.remove();
          });
        });
    });

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw on state change
  useEffect(() => {
    if (!sourceReadyRef.current || !geojsonCacheRef.current) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const source = map.getSource("communes") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    setTilesLoading(true);
    enrichGeoJSON(
      computed,
      geojsonCacheRef.current,
      activeMode,
      activeFilter,
      activeYear,
      showChange,
      baseYear,
      endYear,
    );
    source.setData(geojsonCacheRef.current);
    map.once("idle", () => setTilesLoading(false));
  }, [activeFilter, activeYear, activeMode, showChange, baseYear, endYear]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div id="map" ref={containerRef} />
      {tilesLoading !== null && (
        <div className={`map-loader${tilesLoading ? "" : " map-loader--hidden"}`} onTransitionEnd={() => setTilesLoading(null)} />
      )}
    </div>
  );
}
