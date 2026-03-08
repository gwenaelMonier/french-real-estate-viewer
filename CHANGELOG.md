# Changelog — French real estate viewer

## 1.6.0 — Land plot filter

- Added **Land** property type to filters
- `process.py`: new `raw_terrain` CTE to isolate building land transactions
- Added fields: `med_m2_terrain`, `nb_terrain` (aggregate and per year)

---

## 1.5.1 — DuckDB pipeline optimization

- Refactored SQL queries in `process.py` for better performance
- Simplified CTE structure, identical output format

---

## 1.5.0 — Removed average prices

- **Removed average prices**, keeping only medians
- `STAT_COLS` reduced to `med_m2`, `med_m2_maison`, `med_m2_appart`

---

## 1.4.0 — Municipality search

- **Municipality search field** with results filtered on keypress
- Results display name and department code
- Clear/reset button
- Clicking a result automatically zooms to the municipality

---

## 1.3.0 — Year range slider

- **Dual-handle year slider** for the evolution mode
- Custom CSS for range slider with fill between the two handles
- Dynamic selection of base year and end year

---

## 1.2.0 — Filter panel

- **Filter control panel** positioned top-left on the map
- Dedicated CSS classes: `.filter-control`, `.filter-section`, `.filter-label`, `.filter-select`
- HTML structure for property type and year selectors

---

## 1.1.0 — Median price and evolution mode

- **Calculation mode**: Mean / Median selector (applies to both Price and Evolution modes)
- **Evolution mode**: visualizes % change between a base year and the latest available year
  - Green→red gradient centered on 0%
  - Conditional "Since" selector (replaces the Year selector in Evolution mode)
  - Tooltip: `+X.X% (2020→2025)` with base and recent price
  - Adapted legend: `−range% | 0% | +range%`
- **`process.py`**: added `med_m2`, `med_m2_maison`, `med_m2_appart` columns via `MEDIAN()` in global and yearly aggregates
- Minimum sale thresholds: `HAVING COUNT(*) >= 10` (global) and `>= 5` (per year)

---

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
