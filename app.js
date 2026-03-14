const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  center: [1.888334, 46.603354],
  zoom: 6,
});

// Filtres actifs
let activeFilter = "residentiel"; // 'residentiel' | 'maison' | 'appart' | 'terrain'
let activeYear = "all"; // 'all' | '2019' | '2020' | ...
let activeMode = "prix"; // 'prix' | 'loyer' | 'rentabilite'
let showEvolution = false;
const LATEST_YEAR = String(Math.max(...YEARS));
let baseYear = String(YEARS[0]);
let endYear = LATEST_YEAR;

// Pré-calcul des échelles P4/P96 pour chaque combinaison année × type
const scales = {};
for (const year of ["all", ...YEARS.map(String)]) {
  for (const [filterKey, medField] of [
    ["residentiel", "med_m2"],
    ["maison", "med_m2_maison"],
    ["appart", "med_m2_appart"],
    ["terrain", "med_m2_terrain"],
  ]) {
    const vals = COMMUNES.map((c) => {
      const s = year === "all" ? c : c.years?.[year];
      return s ? s[medField] : null;
    })
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    scales[`${year}_${filterKey}`] = {
      p4: vals[Math.floor(vals.length * 0.04)],
      p96: vals[Math.floor(vals.length * 0.96)],
    };
  }
}

// Pré-calcul des échelles d'évolution (pour chaque mode × filtre × baseYear × endYear)
const evolutionScales = {};
// Prix evolution
for (const [filterKey, medField] of [
  ["residentiel", "med_m2"],
  ["maison", "med_m2_maison"],
  ["appart", "med_m2_appart"],
  ["terrain", "med_m2_terrain"],
]) {
  for (const baseYr of YEARS.map(String)) {
    for (const endYr of YEARS.map(String)) {
      if (endYr <= baseYr) continue;
      const evols = COMMUNES.map((c) => {
        const base = c.years?.[baseYr]?.[medField];
        const latest = c.years?.[endYr]?.[medField];
        if (!base || !latest) return null;
        return ((latest - base) / base) * 100;
      })
        .filter((v) => v != null)
        .sort((a, b) => a - b);
      evolutionScales[`${baseYr}_${endYr}_prix_${filterKey}`] = {
        p4: evols[Math.floor(evols.length * 0.04)],
        p96: evols[Math.floor(evols.length * 0.96)],
      };
    }
  }
}
// Loyer evolution
for (const [filterKey, field] of [
  ["residentiel", "loyer_residentiel"],
  ["maison", "loyer_maison"],
  ["appart", "loyer_appart"],
]) {
  for (const baseYr of YEARS.map(String)) {
    for (const endYr of YEARS.map(String)) {
      if (endYr <= baseYr) continue;
      const evols = COMMUNES.map((c) => {
        const base = c.years?.[baseYr]?.[field];
        const latest = c.years?.[endYr]?.[field];
        if (!base || !latest) return null;
        return ((latest - base) / base) * 100;
      })
        .filter((v) => v != null)
        .sort((a, b) => a - b);
      evolutionScales[`${baseYr}_${endYr}_loyer_${filterKey}`] = {
        p4: evols[Math.floor(evols.length * 0.04)],
        p96: evols[Math.floor(evols.length * 0.96)],
      };
    }
  }
}
// Rentabilite evolution
for (const [filterKey, prixField, lyrField] of [
  ["residentiel", "med_m2",        "loyer_residentiel"],
  ["maison",      "med_m2_maison", "loyer_maison"],
  ["appart",      "med_m2_appart", "loyer_appart"],
]) {
  for (const baseYr of YEARS.map(String)) {
    for (const endYr of YEARS.map(String)) {
      if (endYr <= baseYr) continue;
      const evols = COMMUNES.map((c) => {
        const bPrix = c.years?.[baseYr]?.[prixField];
        const bLoyer = c.years?.[baseYr]?.[lyrField];
        const ePrix = c.years?.[endYr]?.[prixField];
        const eLoyer = c.years?.[endYr]?.[lyrField];
        if (!bPrix || !bLoyer || !ePrix || !eLoyer) return null;
        const rBase = (bLoyer * 12 / bPrix) * 100;
        const rEnd = (eLoyer * 12 / ePrix) * 100;
        return ((rEnd - rBase) / rBase) * 100;
      })
        .filter((v) => v != null)
        .sort((a, b) => a - b);
      evolutionScales[`${baseYr}_${endYr}_rentabilite_${filterKey}`] = {
        p4: evols[Math.floor(evols.length * 0.04)],
        p96: evols[Math.floor(evols.length * 0.96)],
      };
    }
  }
}

// Pré-calcul des échelles loyer P4/P96 pour chaque combinaison année × type
const loyerScales = {};
for (const year of ["all", ...YEARS.map(String)]) {
  for (const [filterKey, field] of [
    ["residentiel", "loyer_residentiel"],
    ["maison", "loyer_maison"],
    ["appart", "loyer_appart"],
  ]) {
    const vals = COMMUNES.map((c) => {
      const s = year === "all" ? c : c.years?.[year];
      return s ? s[field] : null;
    })
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    loyerScales[`${year}_${filterKey}`] = {
      p4: vals[Math.floor(vals.length * 0.04)],
      p96: vals[Math.floor(vals.length * 0.96)],
    };
  }
}

// Pré-calcul des échelles rentabilité P4/P96 pour chaque combinaison année × type
const rentabiliteScales = {};
for (const year of ["all", ...YEARS.map(String)]) {
  for (const [filterKey, prixField, lyrField] of [
    ["residentiel", "med_m2",        "loyer_residentiel"],
    ["maison",      "med_m2_maison", "loyer_maison"],
    ["appart",      "med_m2_appart", "loyer_appart"],
  ]) {
    const vals = COMMUNES.map((c) => {
      const s = year === "all" ? c : c.years?.[year];
      if (!s) return null;
      const prix = s[prixField];
      const loyer = s[lyrField];
      if (!prix || !loyer) return null;
      return (loyer * 12 / prix) * 100;
    }).filter((v) => v != null).sort((a, b) => a - b);
    rentabiliteScales[`${year}_${filterKey}`] = {
      p4:  vals[Math.floor(vals.length * 0.04)],
      p96: vals[Math.floor(vals.length * 0.96)],
    };
  }
}

function getStats(c) {
  if (activeYear === "all") return c;
  return c.years?.[activeYear] ?? null;
}
function priceField() {
  if (activeFilter === "residentiel") return "med_m2";
  if (activeFilter === "maison") return "med_m2_maison";
  if (activeFilter === "appart") return "med_m2_appart";
  return "med_m2_terrain";
}

function getPrice(c) {
  const s = getStats(c);
  if (!s) return null;
  return s[priceField()] ?? null;
}
function getNb(c) {
  const s = getStats(c);
  if (!s) return null;
  if (activeFilter === "residentiel") return s.nb;
  if (activeFilter === "maison") return s.nb_maison;
  if (activeFilter === "appart") return s.nb_appart;
  return s.nb_terrain;
}

function priceToColor(price) {
  const { p4, p96 } = scales[`${activeYear}_${activeFilter}`];
  const t = Math.max(0, Math.min(1, (price - p4) / (p96 - p4)));
  return `hsl(${Math.round(120 * (1 - t))}, 80%, 45%)`;
}

function loyerField() {
  if (activeFilter === "maison") return "loyer_maison";
  if (activeFilter === "appart") return "loyer_appart";
  return "loyer_residentiel";
}

function getLoyer(c) {
  const s = getStats(c);
  if (!s) return null;
  return s[loyerField()] ?? null;
}

function loyerToColor(loyer) {
  const key = `${activeYear}_${activeFilter === "terrain" ? "residentiel" : activeFilter}`;
  const { p4, p96 } = loyerScales[key];
  const t = Math.max(0, Math.min(1, (loyer - p4) / (p96 - p4)));
  return `hsl(${Math.round(120 * (1 - t))}, 80%, 45%)`;
}

function getRentabilite(c) {
  const s = getStats(c);
  if (!s) return null;
  const prix  = s[priceField()];
  const loyer = s[loyerField()];
  if (!prix || !loyer) return null;
  return (loyer * 12 / prix) * 100;
}

function rentabiliteToColor(r) {
  const key = `${activeYear}_${activeFilter}`;
  const { p4, p96 } = rentabiliteScales[key];
  const t = Math.max(0, Math.min(1, (r - p4) / (p96 - p4)));
  return `hsl(${Math.round(120 * (1 - t))}, 80%, 45%)`;
}

function getEvolution(c) {
  if (activeMode === "rentabilite") {
    const pf = priceField(), lf = loyerField();
    const bPrix = c.years?.[baseYear]?.[pf];
    const bLoyer = c.years?.[baseYear]?.[lf];
    const ePrix = c.years?.[endYear]?.[pf];
    const eLoyer = c.years?.[endYear]?.[lf];
    if (!bPrix || !bLoyer || !ePrix || !eLoyer) return null;
    const rBase = (bLoyer * 12 / bPrix) * 100;
    const rEnd = (eLoyer * 12 / ePrix) * 100;
    return ((rEnd - rBase) / rBase) * 100;
  }
  const field = activeMode === "loyer" ? loyerField() : priceField();
  const base = c.years?.[baseYear]?.[field];
  const latest = c.years?.[endYear]?.[field];
  if (!base || !latest) return null;
  return ((latest - base) / base) * 100;
}

function getEvolutionValues(c) {
  if (activeMode === "rentabilite") {
    const pf = priceField(), lf = loyerField();
    const bPrix = c.years?.[baseYear]?.[pf];
    const bLoyer = c.years?.[baseYear]?.[lf];
    const ePrix = c.years?.[endYear]?.[pf];
    const eLoyer = c.years?.[endYear]?.[lf];
    if (!bPrix || !bLoyer || !ePrix || !eLoyer) return null;
    return { base: (bLoyer * 12 / bPrix) * 100, end: (eLoyer * 12 / ePrix) * 100 };
  }
  const field = activeMode === "loyer" ? loyerField() : priceField();
  const base = c.years?.[baseYear]?.[field];
  const end = c.years?.[endYear]?.[field];
  if (!base || !end) return null;
  return { base, end };
}

function evolutionToColor(pct) {
  const { p4, p96 } =
    evolutionScales[`${baseYear}_${endYear}_${activeMode}_${activeFilter}`];
  const range = Math.max(Math.abs(p4), Math.abs(p96));
  const t = Math.max(0, Math.min(1, (pct + range) / (2 * range)));
  return `hsl(${Math.round(120 * (1 - t))}, 80%, 45%)`;
}

// Index COMMUNES par code_commune
const communeIndex = {};
COMMUNES.forEach((c) => {
  communeIndex[c.code_commune] = c;
});

// Cache GeoJSON enrichi
let geojsonCache = null;

function enrichGeoJSON(geojson) {
  geojson.features.forEach((f) => {
    const code = String(f.properties.code);
    const c = communeIndex[code];
    f.properties.nomCommune = c?.nom_commune ?? f.properties.nom ?? "";
    f.properties.codeDep = c?.code_dep ?? "";

    // Defaults
    f.properties.price = -1;
    f.properties.nb = 0;
    f.properties.evol = -999;
    f.properties.evolBase = -1;
    f.properties.evolEnd = -1;
    f.properties.loyer = -1;
    f.properties.nbLoyer = 0;
    f.properties.rentabilite = -1;

    if (showEvolution) {
      const evol = c ? getEvolution(c) : null;
      f.properties.fillColor = evol != null ? evolutionToColor(evol) : "";
      f.properties.evol = evol != null ? evol : -999;
      const vals = c ? getEvolutionValues(c) : null;
      f.properties.evolBase = vals ? vals.base : -1;
      f.properties.evolEnd = vals ? vals.end : -1;
    } else if (activeMode === "prix") {
      const price = c ? getPrice(c) : null;
      f.properties.fillColor = price != null ? priceToColor(price) : "";
      f.properties.price = price != null ? price : -1;
      f.properties.nb = (c ? getNb(c) : null) ?? 0;
    } else if (activeMode === "rentabilite") {
      const r = c ? getRentabilite(c) : null;
      f.properties.fillColor = r != null ? rentabiliteToColor(r) : "";
      f.properties.rentabilite = r != null ? r : -1;
      f.properties.price   = r != null ? (getStats(c)?.[priceField()]  ?? -1) : -1;
      f.properties.loyer   = r != null ? (getStats(c)?.[loyerField()]  ?? -1) : -1;
    } else {
      // mode loyer
      const loyer = c ? getLoyer(c) : null;
      f.properties.fillColor = loyer != null ? loyerToColor(loyer) : "";
      f.properties.loyer = loyer != null ? loyer : -1;
      const nbField = loyerField().replace("loyer_", "nb_loyer_");
      f.properties.nbLoyer =
        loyer != null ? (getStats(c)?.[nbField] ?? 0) : 0;
    }
  });
  return geojson;
}

function getFirstLabelLayerId() {
  return map.getStyle().layers.find((l) => l.type === "symbol")?.id;
}

function redrawCommunes() {
  if (!map.getSource("communes")) return;
  enrichGeoJSON(geojsonCache);
  map.getSource("communes").setData(geojsonCache);
}

// Légende dynamique
const legendDiv = document.getElementById("legend");
function updateLegend() {
  if (showEvolution) {
    const modeLabel = activeMode === "prix" ? "Prix" : activeMode === "loyer" ? "Loyer" : "Rentabilité";
    const { p4, p96 } =
      evolutionScales[`${baseYear}_${endYear}_${activeMode}_${activeFilter}`];
    const range = Math.max(Math.abs(p4), Math.abs(p96));
    legendDiv.innerHTML =
      `<b>Évol. ${modeLabel} ${baseYear} ${ARROW_DARK} ${endYear}</b>` +
      '<div class="legend-gradient legend-gradient-evol"></div>' +
      '<div class="legend-labels">' +
      `<span>${(-range).toFixed(0)}%</span><span>0%</span><span>+${range.toFixed(0)}%</span>` +
      "</div>";
  } else if (activeMode === "prix") {
    const { p4, p96 } = scales[`${activeYear}_${activeFilter}`];
    legendDiv.innerHTML =
      `<b>Prix médian au m²</b>` +
      '<div class="legend-gradient"></div>' +
      '<div class="legend-labels">' +
      `<span>${Math.round(p4).toLocaleString("fr-FR")} €</span>` +
      `<span>${Math.round((p4 + p96) / 2).toLocaleString("fr-FR")} €</span>` +
      `<span>${Math.round(p96).toLocaleString("fr-FR")} €</span>` +
      "</div>";
  } else if (activeMode === "rentabilite") {
    const { p4, p96 } = rentabiliteScales[`${activeYear}_${activeFilter}`];
    legendDiv.innerHTML =
      `<b>Rentabilité brute / an</b>` +
      '<div class="legend-gradient"></div>' +
      '<div class="legend-labels">' +
      `<span>${p4.toFixed(1)}%</span>` +
      `<span>${((p4 + p96) / 2).toFixed(1)}%</span>` +
      `<span>${p96.toFixed(1)}%</span>` +
      "</div>";
  } else {
    const loyerKey = `${activeYear}_${activeFilter === "terrain" ? "residentiel" : activeFilter}`;
    const { p4, p96 } = loyerScales[loyerKey];
    legendDiv.innerHTML =
      `<b>Loyer au m² / mois</b>` +
      '<div class="legend-gradient"></div>' +
      '<div class="legend-labels">' +
      `<span>${p4.toFixed(1)} €</span>` +
      `<span>${((p4 + p96) / 2).toFixed(1)} €</span>` +
      `<span>${p96.toFixed(1)} €</span>` +
      "</div>";
  }
}
updateLegend();

// Encart filtre
const filterDiv = document.getElementById("filter-control");

// Flèche SVG réutilisable
const ARR = (color = "#cbd5e1") =>
  `<svg width="14" height="8" viewBox="0 0 14 8" fill="none" style="vertical-align:middle;margin:0 2px"><path d="M1 4h12M9 1l4 3-4 3" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW = ARR(); // gris clair (panel)
const ARROW_DARK = ARR("#475569"); // slate-600 (tooltip, légende)

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
    ["prix", "Prix /m²"],
    ["loyer", "Loyer /m²"],
    ["rentabilite", "Rendement"],
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
    activeMode === "loyer" || activeMode === "rentabilite"
      ? [
          ["residentiel", "Résidentiel"],
          ["maison", "Maison"],
          ["appart", "Appart"],
        ]
      : [
          ["residentiel", "Résidentiel"],
          ["maison", "Maison"],
          ["appart", "Appart"],
          ["terrain", "Terrain"],
        ];

  const viewModeToggle = `<div class="filter-section">
        ${seg("viewMode", [["valeur", "Valeur"], ["evolution", "Évolution"]], showEvolution ? "evolution" : "valeur")}
      </div>`;

  const yearSection = !showEvolution
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
    if ((activeMode === "loyer" || activeMode === "rentabilite") && activeFilter === "terrain") {
      activeFilter = "residentiel";
    }
    renderFilterPanel();
  }
  if (e.target.name === "viewMode") {
    showEvolution = e.target.value === "evolution";
    renderFilterPanel();
  }
  if (e.target.name === "filter") activeFilter = e.target.value;
  if (e.target.name === "year") activeYear = e.target.value;
  popup.remove();
  redrawCommunes();
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
    redrawCommunes();
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
    redrawCommunes();
    updateLegend();
  }
});

// ── Recherche de commune ──────────────────────
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

// Popup réutilisée
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
        if (!p.nomCommune) return;
        map.getCanvas().style.cursor = "pointer";
        let html;
        if (showEvolution && p.evol > -999) {
          const sign = p.evol >= 0 ? "+" : "";
          const evolBase = Number(p.evolBase);
          const evolEnd = Number(p.evolEnd);
          let detail = "";
          if (activeMode === "prix") {
            detail = `<small>${evolBase.toLocaleString("fr-FR")} ${ARROW_DARK} ${evolEnd.toLocaleString("fr-FR")} €/m²</small>`;
          } else if (activeMode === "loyer") {
            detail = `<small>${evolBase.toFixed(1)} ${ARROW_DARK} ${evolEnd.toFixed(1)} €/m²/mois</small>`;
          } else {
            detail = `<small>${evolBase.toFixed(1)}% ${ARROW_DARK} ${evolEnd.toFixed(1)}% brut/an</small>`;
          }
          html = `<b>${p.nomCommune}</b> (${p.codeDep})<br>${sign}${Number(p.evol).toFixed(1)}% (${baseYear} ${ARROW_DARK} ${endYear})<br>${detail}`;
        } else if (activeMode === "rentabilite" && p.rentabilite >= 0) {
          html = `<b>${p.nomCommune}</b> (${p.codeDep})<br>${Number(p.rentabilite).toFixed(1)}% brut/an<br>` +
            `<small>${Number(p.price).toLocaleString("fr-FR")} €/m² · ${Number(p.loyer).toFixed(1)} €/m²/mois</small>`;
        } else if (activeMode === "loyer" && p.loyer >= 0) {
          html = `<b>${p.nomCommune}</b> (${p.codeDep})<br>${Number(p.loyer).toFixed(1)} €/m²/mois<br><small>${p.nbLoyer} annonces</small>`;
        } else if (activeMode === "prix" && p.price >= 0) {
          html = `<b>${p.nomCommune}</b> (${p.codeDep})<br>${Number(p.price).toLocaleString("fr-FR")} €/m²<br><small>${p.nb} ventes</small>`;
        } else {
          html = `<b>${p.nomCommune}</b><br><small style="color:#999">Aucune donnée</small>`;
        }
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "communes-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });
});
