# Changelog — French real estate viewer

## 3.3.0 — Lucide icons

- Added `lucide-react` dependency
- Mode tabs: icon displayed above label (`DollarSign`, `Home`, `Percent`)
- ViewMode and filter segmented controls: inline icons (`BarChart2`, `TrendingUp`, `Building2`, `House`, `Building`, `Layers`)
- Search bar: magnifying glass icon (`SearchIcon`) positioned left of the input
- CSS: `.mode-tabs label` as `flex-direction: column`, `.seg-group label` as inline flex, `.search-icon` absolutely positioned
- 4-option filter (Price mode): `seg-group--wrap` switches to a 2×2 grid to prevent the Land button from overflowing

---

##  3.2.0 — Biome linting

- Added **Biome** as linter and formatter (`biome.json`)
- `lint` (`biome check --write src`) and `lint:check` scripts in `package.json`
- Package renamed to `french-real-estate-viewer`
- All source files formatted and fixed according to Biome rules

---

## 3.1.0 — Component tests

- React component tests: `FilterPanel`, `Search`, `Legend`, `LanguageToggle`
- Shared test infrastructure: `renderWith.tsx`, `fixtures.ts`, `i18n-test.ts`, `setup.ts`
- Added `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`
- `vitest.config.ts` with jsdom environment and setupFiles

---

## 3.0.0 — PMTiles migration

- **Replaced `cities.json` with PMTiles vector tiles**
- Added `pmtiles` dependency and registered the `pmtiles://` protocol
- Geometries loaded on demand over the network (no more monolithic JS file)
- `tilesLoading` state to manage MapLibre source initialization
- Tile generation via `tippecanoe` (documented in README)
- `process.py` now outputs `cities.pmtiles` alongside the data JSON

---

## 2.5.0 — Progress bar

- Detailed progress bar during data loading
- Load split into chunks for granular progress tracking
- Better visual feedback during initialization on large datasets

---

## 2.4.0 — Loading state

- `DataContext` exposes a `loading` state while fetching `cities.json`
- Visual indicator shown until data is available
- Improved user experience on first load

---

## 2.3.0 — DataContext and dynamic loading

- **`DataProvider`**: data is now fetched at runtime (`fetch`) instead of being injected globally
- `DataContext.tsx` centralizes `cities`, `years`, `computed`
- `App` wrapped in `DataProvider`
- Removed `window.*` global variables

---

## 2.2.0 — Unit tests

- Set up **Vitest** as the test runner
- First tests: `config.test.ts`, `data.test.ts`, `normalize.test.ts`
- `src/__tests__/` directory with fixtures and setup
- `test` script added to `package.json`

---

## 2.1.0 — Internationalization

- Added **i18next** and **react-i18next**
- `LanguageToggle` component (FR / EN)
- Translation files `fr.json` and `en.json`
- Default language: French
- `process.py` updated for bilingual labels

---

## 2.0.1 — Minor post-migration fixes

- Minor adjustments to dependencies and TypeScript types

---

## 2.0.0 — React + TypeScript migration

- **Full rewrite in React + TypeScript with Vite**
- Component architecture: `MapView`, `Legend`, `Search`, `FilterPanel`
- `types.ts` for shared types (`City`, `ComputedData`, `Scale`, etc.)
- `config.ts`: filter fields, scale computation, `getScaleForMode`
- `data.ts`: `getStats`, `getValue`, `getChange`, `valueToColor`, `changeToColor`, `computeFeatureState`, `getTooltipData`
- Vite build, strict TypeScript compilation (`noUncheckedIndexedAccess`, etc.)
- Replaced global variables with React props and context

---

## 1.11.1 — Refactor cleanup

- Reduced `app.js` (~20 KB vs 24 KB) after code simplification

---

## 1.11.0 — Split into separate files

- **Split monolithic HTML** into three files: `index.html`, `app.js`, `style.css`
- `index.html` reduced to a minimal shell
- Architectural preparation before the React migration

---

## 1.10.0 — Redesigned evolution mode

- Full visual redesign of the evolution mode
- `showEvolution` flag to toggle between absolute price and % change
- Freely selectable base year and end year for comparison
- Tooltip and legend adapted for the evolution mode

---

## 1.9.1 — Data size optimization

- Reduced `communes.js` from 45.8 MB to 21.5 MB (−53%)
- Removed redundant client-side fields
- Noticeably improved initial load time

---

## 1.9.0 — UI redesign

- Redesigned control panel (layout, typography, spacing)
- Improved visual design for filters and legend

---

## 1.8.0 — Gross yields

- **Gross yield calculation**: `(annual_rent / price_per_m²) × 100`
- New "Yield" visualization mode
- Legend and tooltip adapted for percentages
- Builds on rental data introduced in 1.7.0

---

## 1.7.0 — Rental price data

- **MEF/DHUP rental price integration** (apartments, houses, residential)
- Added fields: `loyer_appart`, `loyer_maison`, `loyer_residentiel` (€/m²/month)
- Weighted residential rent computed from property counts
- 2022–2025 CSV files imported in `process.py`

---

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
