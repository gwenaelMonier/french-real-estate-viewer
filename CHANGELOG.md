# Changelog — French real estate viewer

## 1.0.0 — MapLibre GL migration

- **Migration Leaflet → MapLibre GL** (WebGL rendering, native vector tiles)
- CartoDB Voyager GL basemap (`voyager-gl-style/style.json`)
- Two MapLibre layers: `communes-fill` (colored polygons) + `communes-line` (borders)
- Client-side GeoJSON enrichment (`enrichGeoJSON`): `fillColor`, `price`, `nb` injected into properties
- Single reused MapLibre popup instance
- Filter panel and legend positioned as absolute HTML elements (no `L.control`)
- City labels removed (handled natively by the GL style)

---

## 0.4.0 — Major cities and CartoDB

- Basemap replaced with **CartoDB Voyager** (no labels, raster)
- Dedicated `labelsPane` to display labels above polygons
- 42 major cities hardcoded as textual `DivIcon` markers with conditional `minZoom`
- CartoDB `light_only_labels` tiles enabled from zoom 10

---

## 0.3.0 — Property type and year filters

- **Interactive filters**: All / House / Apartment radio buttons + All / individual year dropdown
- Pre-computed P3/P97 scales for each `year × type` combination
- `getStats()`, `getPrice()`, `getNb()` functions to access data by active filters
- Dynamic legend recomputed on each filter change
- **`process.py`**: added yearly aggregates (`years[year]`) and per-type fields (`avg_m2_maison`, `avg_m2_appart`, etc.)

---

## 0.2.1 — Bug fixes

- Added `clearTooltip()` to prevent ghost tooltips on drag/zoom
- Proper handling of `zoomstart` / `zoomend` / `dragstart` / `dragend` events

---

## 0.2.0 — Municipality polygons

- Switched from **circles to municipality polygons** (GeoJSON `communes-version-simplifiee.geojson`)
- Polygons filled with the price gradient
- Improved tooltip: follows mouse position, disabled during drag

---

## 0.1.0 — Initial release

- Library: **Leaflet 1.9.4**, OpenStreetMap basemap
- Municipalities represented as colored **circles** (fixed radius, green→red gradient)
- P2/P98 scale on average prices per m²
- Hover tooltip: name, department, price/m², number of sales
- **`process.py`**: DuckDB, aggregation per municipality, surface filter 9–1000 m², sales only
