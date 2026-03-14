const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  center: [1.888334, 46.603354],
  zoom: 6,
});

// Active filters
let activeFilter = "residential"; // 'residential' | 'house' | 'apt' | 'land'
let activeYear = "all"; // 'all' | '2019' | '2020' | ...
let activeMode = "price"; // 'price' | 'rent' | 'yield'
let showChange = false;
const LATEST_YEAR = String(Math.max(...YEARS));
let baseYear = String(YEARS[0]);
let endYear = LATEST_YEAR;

// ── Config tables ────────────────────────────────
const FILTER_FIELDS = {
  residential: { price: "med_m2",         rent: "loyer_residentiel", nb: "nb",         rentCount: "nb_loyer_residentiel" },
  house:       { price: "med_m2_maison",  rent: "loyer_maison",      nb: "nb_maison",  rentCount: "nb_loyer_maison" },
  apt:         { price: "med_m2_appart",  rent: "loyer_appart",      nb: "nb_appart",  rentCount: "nb_loyer_appart" },
  land:        { price: "med_m2_terrain", rent: null,                 nb: "nb_terrain", rentCount: null },
};

// Reusable SVG arrow
const ARR = (color = "#cbd5e1") =>
  `<svg width="14" height="8" viewBox="0 0 14 8" fill="none" style="vertical-align:middle;margin:0 2px"><path d="M1 4h12M9 1l4 3-4 3" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW = ARR(); // light gray (panel)
const ARROW_DARK = ARR("#475569"); // slate-600 (tooltip, legend)

// ── Scale computation ────────────────────────────
function computePercentiles(values) {
  const sorted = values.filter((v) => v != null).sort((a, b) => a - b);
  return { p4: sorted[Math.floor(sorted.length * 0.04)], p96: sorted[Math.floor(sorted.length * 0.96)] };
}

function buildScales(filterEntries, extractor) {
  const result = {};
  for (const year of ["all", ...YEARS.map(String)]) {
    for (const [filterKey, ...fields] of filterEntries) {
      const vals = COMMUNES.map((c) => {
        const s = year === "all" ? c : c.years?.[year];
        return s ? extractor(s, ...fields) : null;
      });
      result[`${year}_${filterKey}`] = computePercentiles(vals);
    }
  }
  return result;
}

const scales = buildScales(
  Object.entries(FILTER_FIELDS).map(([k, v]) => [k, v.price]),
  (s, field) => s[field] ?? null,
);

const rentScales = buildScales(
  Object.entries(FILTER_FIELDS).filter(([, v]) => v.rent).map(([k, v]) => [k, v.rent]),
  (s, field) => s[field] ?? null,
);

const yieldScales = buildScales(
  Object.entries(FILTER_FIELDS).filter(([, v]) => v.rent).map(([k, v]) => [k, v.price, v.rent]),
  (s, pf, lf) => {
    const price = s[pf], rent = s[lf];
    return (price && rent) ? (rent * 12 / price) * 100 : null;
  },
);

const changeScales = (() => {
  const result = {};
  const yearStrs = YEARS.map(String);
  const extractSimple = (c, yr, f) => c.years?.[yr]?.[f];
  const extractYield = (c, yr, pf, lf) => {
    const p = c.years?.[yr]?.[pf], l = c.years?.[yr]?.[lf];
    return (p && l) ? (l * 12 / p) * 100 : null;
  };
  const modes = [
    ["price", Object.entries(FILTER_FIELDS).map(([k, v]) => [k, v.price]), extractSimple],
    ["rent", Object.entries(FILTER_FIELDS).filter(([, v]) => v.rent).map(([k, v]) => [k, v.rent]), extractSimple],
    ["yield", Object.entries(FILTER_FIELDS).filter(([, v]) => v.rent).map(([k, v]) => [k, v.price, v.rent]), extractYield],
  ];
  for (const baseYr of yearStrs) {
    for (const endYr of yearStrs) {
      if (endYr <= baseYr) continue;
      for (const [mode, filters, getVal] of modes) {
        for (const [fk, ...fields] of filters) {
          const vals = COMMUNES.map((c) => {
            const b = getVal(c, baseYr, ...fields);
            const e = getVal(c, endYr, ...fields);
            return (b && e) ? ((e - b) / b) * 100 : null;
          });
          result[`${baseYr}_${endYr}_${mode}_${fk}`] = computePercentiles(vals);
        }
      }
    }
  }
  return result;
})();

// ── Mode config ──────────────────────────────────
const MODE_CONFIG = {
  price: {
    label: "Prix médian au m²",
    modeLabel: "Prix",
    getScale: () => scales[`${activeYear}_${activeFilter}`],
    legendFormat: (v) => `${Math.round(v).toLocaleString("fr-FR")} €`,
    changeDetail: (b, e) =>
      `<small>${b.toLocaleString("fr-FR")} ${ARROW_DARK} ${e.toLocaleString("fr-FR")} €/m²</small>`,
    tooltipHtml: (p) => p.price >= 0
      ? `${Number(p.price).toLocaleString("fr-FR")} €/m²<br><small>${p.nb} ventes</small>` : null,
  },
  rent: {
    label: "Loyer au m² / mois",
    modeLabel: "Loyer",
    getScale: () => rentScales[`${activeYear}_${activeFilter === "land" ? "residential" : activeFilter}`],
    legendFormat: (v) => `${v.toFixed(1)} €`,
    changeDetail: (b, e) =>
      `<small>${b.toFixed(1)} ${ARROW_DARK} ${e.toFixed(1)} €/m²/mois</small>`,
    tooltipHtml: (p) => p.rent >= 0
      ? `${Number(p.rent).toFixed(1)} €/m²/mois<br><small>${p.rentCount} annonces</small>` : null,
  },
  yield: {
    label: "Rentabilité brute / an",
    modeLabel: "Rentabilité",
    getScale: () => yieldScales[`${activeYear}_${activeFilter}`],
    legendFormat: (v) => `${v.toFixed(1)}%`,
    changeDetail: (b, e) =>
      `<small>${b.toFixed(1)}% ${ARROW_DARK} ${e.toFixed(1)}% brut/an</small>`,
    tooltipHtml: (p) => p.yield >= 0
      ? `${Number(p.yield).toFixed(1)}% brut/an<br><small>${Number(p.price).toLocaleString("fr-FR")} €/m² · ${Number(p.rent).toFixed(1)} €/m²/mois</small>` : null,
  },
};

// ── Data accessors ───────────────────────────────
function getStats(c) {
  if (activeYear === "all") return c;
  return c.years?.[activeYear] ?? null;
}

function getValue(c) {
  const s = getStats(c);
  if (!s) return null;
  const ff = FILTER_FIELDS[activeFilter];
  if (activeMode === "yield") {
    const price = s[ff.price], rent = s[ff.rent];
    return (price && rent) ? (rent * 12 / price) * 100 : null;
  }
  const field = activeMode === "rent" ? ff.rent : ff.price;
  return field ? s[field] ?? null : null;
}

function getChange(c) {
  const ff = FILTER_FIELDS[activeFilter];
  if (activeMode === "yield") {
    const bPrice = c.years?.[baseYear]?.[ff.price];
    const bRent  = c.years?.[baseYear]?.[ff.rent];
    const ePrice = c.years?.[endYear]?.[ff.price];
    const eRent  = c.years?.[endYear]?.[ff.rent];
    if (!bPrice || !bRent || !ePrice || !eRent) return null;
    const rBase = (bRent * 12 / bPrice) * 100;
    const rEnd  = (eRent * 12 / ePrice) * 100;
    return { pct: ((rEnd - rBase) / rBase) * 100, base: rBase, end: rEnd };
  }
  const field = activeMode === "rent" ? ff.rent : ff.price;
  const base = c.years?.[baseYear]?.[field];
  const end  = c.years?.[endYear]?.[field];
  if (!base || !end) return null;
  return { pct: ((end - base) / base) * 100, base, end };
}

// ── Color functions ──────────────────────────────
function valueToColor(value, p4, p96) {
  const t = Math.max(0, Math.min(1, (value - p4) / (p96 - p4)));
  return `hsl(${Math.round(120 * (1 - t))}, 80%, 45%)`;
}

function changeToColor(pct) {
  const { p4, p96 } = changeScales[`${baseYear}_${endYear}_${activeMode}_${activeFilter}`];
  const range = Math.max(Math.abs(p4), Math.abs(p96));
  return valueToColor(pct, -range, range);
}

// Index COMMUNES by city code
const cityIndex = {};
COMMUNES.forEach((c) => {
  cityIndex[c.code_commune] = c;
});

// Enriched GeoJSON cache
let geojsonCache = null;

function enrichGeoJSON(geojson) {
  const ff = FILTER_FIELDS[activeFilter];
  const scale = !showChange ? MODE_CONFIG[activeMode].getScale() : null;

  geojson.features.forEach((f) => {
    const code = String(f.properties.code);
    const c = cityIndex[code];
    f.properties.cityName = c?.nom_commune ?? f.properties.nom ?? "";
    f.properties.deptCode = c?.code_dep ?? "";

    // Defaults
    f.properties.price     = -1;
    f.properties.nb        = 0;
    f.properties.change    = -999;
    f.properties.changeBase = -1;
    f.properties.changeEnd  = -1;
    f.properties.rent      = -1;
    f.properties.rentCount = 0;
    f.properties.yield     = -1;

    if (showChange) {
      const ch = c ? getChange(c) : null;
      f.properties.fillColor   = ch ? changeToColor(ch.pct) : "";
      f.properties.change      = ch ? ch.pct  : -999;
      f.properties.changeBase  = ch ? ch.base : -1;
      f.properties.changeEnd   = ch ? ch.end  : -1;
    } else {
      const val = c ? getValue(c) : null;
      f.properties.fillColor = val != null ? valueToColor(val, scale.p4, scale.p96) : "";
      if (activeMode === "price") {
        f.properties.price = val ?? -1;
        const s = c ? getStats(c) : null;
        f.properties.nb = s ? s[ff.nb] ?? 0 : 0;
      } else if (activeMode === "rent") {
        f.properties.rent = val ?? -1;
        const s = c ? getStats(c) : null;
        f.properties.rentCount = val != null ? (s?.[ff.rentCount] ?? 0) : 0;
      } else {
        f.properties.yield = val ?? -1;
        const s = c ? getStats(c) : null;
        f.properties.price = val != null ? (s?.[ff.price] ?? -1) : -1;
        f.properties.rent  = val != null ? (s?.[ff.rent]  ?? -1) : -1;
      }
    }
  });
  return geojson;
}

function getFirstLabelLayerId() {
  return map.getStyle().layers.find((l) => l.type === "symbol")?.id;
}

function redrawMap() {
  if (!map.getSource("communes")) return;
  enrichGeoJSON(geojsonCache);
  map.getSource("communes").setData(geojsonCache);
}

// Dynamic legend
const legendDiv = document.getElementById("legend");
function updateLegend() {
  if (showChange) {
    const { modeLabel } = MODE_CONFIG[activeMode];
    const { p4, p96 } =
      changeScales[`${baseYear}_${endYear}_${activeMode}_${activeFilter}`];
    const range = Math.max(Math.abs(p4), Math.abs(p96));
    legendDiv.innerHTML =
      `<b>Évol. ${modeLabel} ${baseYear} ${ARROW_DARK} ${endYear}</b>` +
      '<div class="legend-gradient legend-gradient-evol"></div>' +
      '<div class="legend-labels">' +
      `<span>${(-range).toFixed(0)}%</span><span>0%</span><span>+${range.toFixed(0)}%</span>` +
      "</div>";
  } else {
    const cfg = MODE_CONFIG[activeMode];
    const { p4, p96 } = cfg.getScale();
    legendDiv.innerHTML =
      `<b>${cfg.label}</b>` +
      '<div class="legend-gradient"></div>' +
      '<div class="legend-labels">' +
      `<span>${cfg.legendFormat(p4)}</span>` +
      `<span>${cfg.legendFormat((p4 + p96) / 2)}</span>` +
      `<span>${cfg.legendFormat(p96)}</span>` +
      "</div>";
  }
}
updateLegend();

// Filter panel
const filterDiv = document.getElementById("filter-control");

function seg(name, options, active, wrap = false) {
  return (
    `<div class="seg-group${wrap ? " seg-group--wrap" : ""}">` +
    options
      .map(
        ([val, label]) =>
          `<input type="radio" name="${name}" id="seg-${name}-${val}" value="${val}"${active === val ? " checked" : ""}>` +
          `<label for="seg-${name}-${val}">${label}</label>`,
      )
      .join("") +
    "</div>"
  );
}

function updateSliderFill() {
  const n = YEARS.length - 1;
  const startIdx = YEARS.map(String).indexOf(baseYear);
  const endIdx = YEARS.map(String).indexOf(endYear);
  const fill = document.getElementById("sl-fill");
  if (fill) {
    fill.style.left = (startIdx / n) * 100 + "%";
    fill.style.width = ((endIdx - startIdx) / n) * 100 + "%";
  }
  const elBase = document.getElementById("sl-base");
  const elEnd = document.getElementById("sl-end");
  if (elBase) elBase.textContent = baseYear;
  if (elEnd) elEnd.textContent = endYear;
}

function modeTabs(active) {
  const modes = [
    ["price", "Prix /m²"],
    ["rent",  "Loyer /m²"],
    ["yield", "Rendement"],
  ];
  return '<div class="mode-tabs">' +
    modes.map(([val, label]) =>
      `<input type="radio" name="mode" id="seg-mode-${val}" value="${val}"${active === val ? " checked" : ""}>` +
      `<label for="seg-mode-${val}">${label}</label>`
    ).join("") +
    '</div>';
}

function renderFilterPanel() {
  const n = YEARS.length - 1;
  const baseIdx = YEARS.map(String).indexOf(baseYear);
  const endIdx = YEARS.map(String).indexOf(endYear);

  const filterOptions =
    activeMode === "rent" || activeMode === "yield"
      ? [
          ["residential", "Résidentiel"],
          ["house",        "Maison"],
          ["apt",          "Appart"],
        ]
      : [
          ["residential", "Résidentiel"],
          ["house",        "Maison"],
          ["apt",          "Appart"],
          ["land",         "Terrain"],
        ];

  const viewModeToggle = `<div class="filter-section">
        ${seg("viewMode", [["value", "Valeur"], ["change", "Évolution"]], showChange ? "change" : "value")}
      </div>`;

  const yearSection = !showChange
      ? `<div class="filter-section">
          <div class="year-inline">
            <span class="filter-label">Année</span>
            <select name="year" class="filter-select">
              <option value="all"${activeYear === "all" ? " selected" : ""}>Toutes</option>
              ${YEARS.map((y) => `<option value="${y}"${String(y) === activeYear ? " selected" : ""}>${y}</option>`).join("")}
            </select>
          </div>
        </div>`
      : `<div class="filter-section">
        <div class="year-slider-header">
          <span class="filter-label">Période</span>
          <span class="year-slider-values">
            <span id="sl-base">${baseYear}</span>
            ${ARROW_DARK}
            <span id="sl-end">${endYear}</span>
          </span>
        </div>
        <div class="year-slider-wrap">
          <div class="year-slider-bg">
            <div class="year-slider-fill" id="sl-fill"
              style="left:${(baseIdx / n) * 100}%;width:${((endIdx - baseIdx) / n) * 100}%"></div>
          </div>
          <input type="range" class="year-slider" name="baseYearIdx"
            min="0" max="${n}" step="1" value="${baseIdx}">
          <input type="range" class="year-slider" name="endYearIdx"
            min="0" max="${n}" step="1" value="${endIdx}">
        </div>
        <div class="year-slider-ticks">
          ${YEARS.map((y) => `<span>${y}</span>`).join("")}
        </div>
      </div>`;

  filterDiv.innerHTML =
    modeTabs(activeMode) +
    `<div class="filter-body">
      ${viewModeToggle}
      <div class="filter-section">
        ${seg("filter", filterOptions, activeFilter)}
      </div>
      ${yearSection}
    </div>`;
}

renderFilterPanel();

filterDiv.addEventListener("change", (e) => {
  if (e.target.name === "mode") {
    activeMode = e.target.value;
    if ((activeMode === "rent" || activeMode === "yield") && activeFilter === "land") {
      activeFilter = "residential";
    }
    renderFilterPanel();
  }
  if (e.target.name === "viewMode") {
    showChange = e.target.value === "change";
    renderFilterPanel();
  }
  if (e.target.name === "filter") activeFilter = e.target.value;
  if (e.target.name === "year") activeYear = e.target.value;
  popup.remove();
  redrawMap();
  updateLegend();
});

filterDiv.addEventListener("input", (e) => {
  if (e.target.name === "baseYearIdx") {
    const idx = parseInt(e.target.value);
    const endIdx = YEARS.map(String).indexOf(endYear);
    if (idx >= endIdx) {
      e.target.value = endIdx - 1;
      return;
    }
    baseYear = String(YEARS[idx]);
    updateSliderFill();
    redrawMap();
    updateLegend();
  }
  if (e.target.name === "endYearIdx") {
    const idx = parseInt(e.target.value);
    const baseIdx = YEARS.map(String).indexOf(baseYear);
    if (idx <= baseIdx) {
      e.target.value = baseIdx + 1;
      return;
    }
    endYear = String(YEARS[idx]);
    updateSliderFill();
    redrawMap();
    updateLegend();
  }
});

// ── City search ───────────────────────────────────
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
const resultsList = document.getElementById("search-results");
const MAX_RESULTS = 8;

function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function renderResults(matches) {
  if (!matches.length) {
    resultsList.hidden = true;
    return;
  }
  resultsList.innerHTML = matches
    .map(
      (c) =>
        `<li data-lon="${c.lon}" data-lat="${c.lat}" data-name="${c.nom_commune}">
      <span>${c.nom_commune}</span>
      <span class="dep">${c.code_dep}</span>
    </li>`,
    )
    .join("");
  resultsList.hidden = false;
}

searchInput.addEventListener("input", () => {
  const q = normalize(searchInput.value.trim());
  searchClear.hidden = !q;
  if (!q) {
    resultsList.hidden = true;
    return;
  }
  const matches = COMMUNES.filter((c) =>
    normalize(c.nom_commune).includes(q),
  )
    .sort((a, b) => {
      const aStarts = normalize(a.nom_commune).startsWith(q);
      const bStarts = normalize(b.nom_commune).startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.nom_commune.localeCompare(b.nom_commune);
    })
    .slice(0, MAX_RESULTS);
  renderResults(matches);
});

resultsList.addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  map.flyTo({
    center: [+li.dataset.lon, +li.dataset.lat],
    zoom: 12,
    duration: 800,
  });
  searchInput.value = li.dataset.name;
  resultsList.hidden = true;
  searchClear.hidden = false;
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  resultsList.hidden = true;
  searchClear.hidden = true;
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#search-control")) resultsList.hidden = true;
});

// Reusable popup
const popup = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10,
});

map.on("load", () => {
  fetch(
    "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes-version-simplifiee.geojson",
  )
    .then((r) => r.json())
    .then((geojson) => {
      geojsonCache = enrichGeoJSON(geojson);
      const labelLayerId = getFirstLabelLayerId();

      map.addSource("communes", { type: "geojson", data: geojsonCache });

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

      map.on("mousemove", "communes-fill", (e) => {
        const p = e.features[0].properties;
        if (!p.cityName) return;
        map.getCanvas().style.cursor = "pointer";
        const cfg = MODE_CONFIG[activeMode];
        let html;
        if (showChange && p.change > -999) {
          const sign = p.change >= 0 ? "+" : "";
          const detail = cfg.changeDetail(Number(p.changeBase), Number(p.changeEnd));
          html = `<b>${p.cityName}</b> (${p.deptCode})<br>${sign}${Number(p.change).toFixed(1)}% (${baseYear} ${ARROW_DARK} ${endYear})<br>${detail}`;
        } else {
          const body = cfg.tooltipHtml(p);
          html = body
            ? `<b>${p.cityName}</b> (${p.deptCode})<br>${body}`
            : `<b>${p.cityName}</b><br><small style="color:#999">Aucune donnée</small>`;
        }
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "communes-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });
});
