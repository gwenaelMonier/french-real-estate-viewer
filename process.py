import duckdb, json, csv as csv_mod

CSV = 'data/full_dvf.csv'  # path to the 3.5 GB file

# ── Loading rent data MEF/DHUP ───────────────────────────────────────────────
rent_data = {}  # dict[city_code][year][field]
rent_meta = {}  # dict[city_code] -> {city_name, dept_code}

for typ in ('app', 'mai'):
    for year in (2022, 2023, 2024, 2025):
        path = f'data/loyer-pred-{typ}-mef-dhup-{year}.csv'
        with open(path, encoding='latin-1') as f:
            reader = csv_mod.DictReader(f, delimiter=';')
            for row in reader:
                code = row['INSEE_C'].strip().strip('"')
                val = float(row['loypredm2'].replace(',', '.'))
                if code not in rent_data:
                    rent_data[code] = {}
                if year not in rent_data[code]:
                    rent_data[code][year] = {}
                field = 'rent_apt' if typ == 'app' else 'rent_house'
                rent_data[code][year][field] = round(val, 2)
                nb_field = 'rent_count_apt' if typ == 'app' else 'rent_count_house'
                rent_data[code][year][nb_field] = int(row['nbobs_com'] or 0)
                if code not in rent_meta:
                    rent_meta[code] = {
                        'city_name': row['LIBGEO'].strip().strip('"'),
                        'dept_code': row['DEP'].strip().strip('"'),
                    }

# Compute rent_residential (weighted average) and backfill 2022 → 2020, 2021
for code, by_year in rent_data.items():
    for year in list(by_year.keys()):
        d = by_year[year]
        pairs = [(d[f], d.get(nf) or 1) for f, nf in
                 [('rent_apt', 'rent_count_apt'), ('rent_house', 'rent_count_house')]
                 if d.get(f) is not None]
        if pairs:
            total_w = sum(nb for _, nb in pairs)
            d['rent_residential'] = round(sum(v * nb for v, nb in pairs) / total_w, 2)
        else:
            d['rent_residential'] = None
        d['rent_count_residential'] = (d.get('rent_count_apt') or 0) + (d.get('rent_count_house') or 0)
    for yr_fill in (2020, 2021):
        if yr_fill not in by_year and 2022 in by_year:
            by_year[yr_fill] = by_year[2022].copy()

# Compute global rent values (simple average over 2022-2025)
# Simple average: each year contributes equally, whether it has direct observations or not
global_rent = {}
for code, by_year in rent_data.items():
    agg = {}
    for field, nb_field in [
        ('rent_apt',         'rent_count_apt'),
        ('rent_house',       'rent_count_house'),
        ('rent_residential', 'rent_count_residential'),
    ]:
        vals = [by_year[yr][field]
                for yr in (2022, 2023, 2024, 2025)
                if yr in by_year and by_year[yr].get(field) is not None]
        agg[field] = round(sum(vals) / len(vals), 2) if vals else None
    for nb_field in ('rent_count_apt', 'rent_count_house', 'rent_count_residential'):
        vals = [by_year[yr][nb_field] for yr in (2022, 2023, 2024, 2025)
                if yr in by_year and by_year[yr].get(nb_field) is not None]
        agg[nb_field] = round(sum(vals) / len(vals)) if vals else None
    global_rent[code] = agg

print(f"Rent data loaded: {len(rent_data)} cities")

con = duckdb.connect()
con.execute("SET memory_limit='2GB'")
con.execute("SET threads=4")

cursor = con.execute(f"""
    WITH raw AS (
        SELECT
            id_mutation, code_commune, nom_commune, code_departement,
            type_local,
            valeur_fonciere,
            surface_reelle_bati,
            latitude, longitude,
            YEAR(CAST(date_mutation AS DATE)) AS annee
        FROM read_csv_auto('{CSV}', sample_size=-1)
        WHERE nature_mutation = 'Vente'
          AND type_local IN ('Maison', 'Appartement')
          AND surface_reelle_bati > 0
          AND valeur_fonciere > 0
    ),
    -- Aggregate per transaction+city: one transaction can cover multiple lots
    -- (e.g. 2 apartments sold together = same valeur_fonciere, different surfaces)
    -- Sum the surfaces and keep the type if homogeneous
    per_mutation AS (
        SELECT
            id_mutation, code_commune, nom_commune, code_departement,
            annee,
            MAX(type_local) AS type_local,
            MAX(valeur_fonciere) AS valeur_fonciere,
            SUM(surface_reelle_bati) AS surface_totale,
            AVG(latitude) AS latitude,
            AVG(longitude) AS longitude
        FROM raw
        GROUP BY id_mutation, code_commune, nom_commune, code_departement, annee
        HAVING COUNT(DISTINCT type_local) = 1  -- exclude mixed House+Apartment transactions
    ),
    dedup AS (
        SELECT *,
            valeur_fonciere / surface_totale AS prix_m2
        FROM per_mutation
        WHERE surface_totale BETWEEN 9 AND 1000
    ),
    raw_terrain AS (
        SELECT
            id_mutation, code_commune,
            YEAR(CAST(date_mutation AS DATE)) AS annee,
            valeur_fonciere,
            surface_terrain
        FROM read_csv_auto('{CSV}', sample_size=-1)
        WHERE nature_mutation = 'Vente'
          AND type_local IS NULL
          AND nature_culture = 'terrains a bâtir'
          AND surface_terrain > 0
          AND valeur_fonciere > 0
    ),
    per_terrain AS (
        SELECT
            id_mutation, code_commune, annee,
            MAX(valeur_fonciere) AS valeur_fonciere,
            SUM(surface_terrain) AS surface_totale
        FROM raw_terrain
        GROUP BY id_mutation, code_commune, annee
    ),
    dedup_terrain AS (
        SELECT *,
            valeur_fonciere / surface_totale AS prix_m2
        FROM per_terrain
        WHERE surface_totale BETWEEN 9 AND 10000
          AND valeur_fonciere / surface_totale > 10  -- exclude symbolic transfers (public, family)
    ),
    terrain_global AS (
        SELECT
            code_commune,
            ROUND(MEDIAN(prix_m2)) AS median_sqm_land,
            COUNT(*) AS count_land
        FROM dedup_terrain
        GROUP BY code_commune
        HAVING COUNT(*) >= 5
    ),
    terrain_year AS (
        SELECT
            code_commune, annee,
            ROUND(MEDIAN(prix_m2)) AS median_sqm_land,
            COUNT(*) AS count_land
        FROM dedup_terrain
        GROUP BY code_commune, annee
        HAVING COUNT(*) >= 3
    ),
    terrain_year_json AS (
        SELECT
            code_commune,
            json_group_object(
                CAST(annee AS VARCHAR),
                json_object(
                    'median_sqm_land', median_sqm_land,
                    'count_land', count_land
                )
            ) AS terrain_years_json
        FROM terrain_year
        GROUP BY code_commune
    ),
    global_agg AS (
        SELECT
            code_commune, nom_commune, code_departement AS code_dep,
            ROUND(MEDIAN(prix_m2)) AS median_sqm,
            ROUND(MEDIAN(CASE WHEN type_local = 'Maison' THEN prix_m2 END)) AS median_sqm_house,
            ROUND(MEDIAN(CASE WHEN type_local = 'Appartement' THEN prix_m2 END)) AS median_sqm_apt,
            COUNT(*) AS count,
            COUNT(CASE WHEN type_local = 'Maison' THEN 1 END) AS count_house,
            COUNT(CASE WHEN type_local = 'Appartement' THEN 1 END) AS count_apt,
            ROUND(AVG(latitude), 5) AS lat,
            ROUND(AVG(longitude), 5) AS lon
        FROM dedup
        GROUP BY code_commune, nom_commune, code_departement
        HAVING COUNT(*) >= 10
    ),
    year_agg AS (
        SELECT
            code_commune, annee,
            ROUND(MEDIAN(prix_m2)) AS median_sqm,
            ROUND(MEDIAN(CASE WHEN type_local = 'Maison' THEN prix_m2 END)) AS median_sqm_house,
            ROUND(MEDIAN(CASE WHEN type_local = 'Appartement' THEN prix_m2 END)) AS median_sqm_apt,
            COUNT(*) AS count,
            COUNT(CASE WHEN type_local = 'Maison' THEN 1 END) AS count_house,
            COUNT(CASE WHEN type_local = 'Appartement' THEN 1 END) AS count_apt
        FROM dedup
        GROUP BY code_commune, annee
        HAVING COUNT(*) >= 5
    ),
    year_json AS (
        SELECT
            code_commune,
            json_group_object(
                CAST(annee AS VARCHAR),
                json_object(
                    'median_sqm', median_sqm,
                    'median_sqm_house', median_sqm_house,
                    'median_sqm_apt', median_sqm_apt,
                    'count', count,
                    'count_house', count_house,
                    'count_apt', count_apt
                )
            ) AS years_json
        FROM year_agg
        GROUP BY code_commune
    )
    SELECT
        g.code_commune AS city_code,
        g.nom_commune  AS city_name,
        g.code_dep     AS dept_code,
        g.median_sqm, g.median_sqm_house, g.median_sqm_apt,
        g.count, g.count_house, g.count_apt,
        tg.median_sqm_land, tg.count_land,
        g.lat, g.lon,
        COALESCE(yj.years_json, '{{}}') AS years_json,
        COALESCE(tyj.terrain_years_json, '{{}}') AS terrain_years_json
    FROM global_agg g
    LEFT JOIN year_json yj ON yj.code_commune = g.code_commune
    LEFT JOIN terrain_global tg ON tg.code_commune = g.code_commune
    LEFT JOIN terrain_year_json tyj ON tyj.code_commune = g.code_commune
    ORDER BY g.code_commune
""")

GLOBAL_COLS = ['city_code', 'city_name', 'dept_code',
               'median_sqm', 'median_sqm_house', 'median_sqm_apt',
               'count', 'count_house', 'count_apt',
               'median_sqm_land', 'count_land', 'lat', 'lon']

all_years = set()
communes_list = []
output_codes = set()

while True:
    row = cursor.fetchone()
    if row is None:
        break
    city = dict(zip(GLOBAL_COLS, row[:13]))
    years_data = json.loads(row[13])
    terrain_years_data = json.loads(row[14])
    for yr, stats in terrain_years_data.items():
        if yr in years_data:
            years_data[yr].update(stats)
        else:
            years_data[yr] = stats

    code = city['city_code']
    lg = global_rent.get(code, {})
    city['rent_residential']    = lg.get('rent_residential')
    city['rent_house']          = lg.get('rent_house')
    city['rent_apt']            = lg.get('rent_apt')
    city['rent_count_residential'] = lg.get('rent_count_residential')
    city['rent_count_house']    = lg.get('rent_count_house')
    city['rent_count_apt']      = lg.get('rent_count_apt')

    ly = rent_data.get(code, {})
    for yr_int, fields in ly.items():
        yr_str = str(yr_int)
        if yr_str in years_data:
            years_data[yr_str].update(fields)
        else:
            years_data[yr_str] = fields.copy()

    all_years.update(years_data.keys())
    city['years'] = years_data
    communes_list.append(city)
    output_codes.add(code)

# Cities with rent data only (not enough DVF transactions)
nb_loyer_only = 0
for code, by_year in rent_data.items():
    if code in output_codes:
        continue
    meta = rent_meta.get(code, {})
    if not meta:
        continue
    lg = global_rent.get(code, {})
    years_data = {}
    for yr_int, fields in by_year.items():
        years_data[str(yr_int)] = fields.copy()
    city = {
        'city_code': code,
        'city_name': meta['city_name'],
        'dept_code': meta['dept_code'],
        'median_sqm': None, 'median_sqm_house': None, 'median_sqm_apt': None,
        'count': None, 'count_house': None, 'count_apt': None,
        'median_sqm_land': None, 'count_land': None,
        'lat': None, 'lon': None,
        'rent_residential':       lg.get('rent_residential'),
        'rent_house':             lg.get('rent_house'),
        'rent_apt':               lg.get('rent_apt'),
        'rent_count_residential': lg.get('rent_count_residential'),
        'rent_count_house':       lg.get('rent_count_house'),
        'rent_count_apt':         lg.get('rent_count_apt'),
        'years': years_data,
    }
    communes_list.append(city)
    all_years.update(years_data.keys())
    nb_loyer_only += 1

years_sorted = sorted(int(y) for y in all_years)
nb_communes = len(communes_list)

# ── Pre-compute scales ───────────────────────────────────────────────────────

FILTER_FIELDS = {
    'residential': {'price': 'median_sqm',       'rent': 'rent_residential'},
    'house':       {'price': 'median_sqm_house',  'rent': 'rent_house'},
    'apt':         {'price': 'median_sqm_apt',    'rent': 'rent_apt'},
    'land':        {'price': 'median_sqm_land',   'rent': None},
}

import math

def compute_percentiles(values):
    sorted_vals = sorted(v for v in values if v is not None)
    if not sorted_vals:
        return {'p4': 0, 'p96': 0}
    return {
        'p4': sorted_vals[math.floor(len(sorted_vals) * 0.04)],
        'p96': sorted_vals[math.floor(len(sorted_vals) * 0.96)],
    }

def get_field(obj, field):
    v = obj.get(field)
    return v if isinstance(v, (int, float)) else None

year_keys = ['all'] + [str(y) for y in years_sorted]

# Price scales
scales = {}
for yr in year_keys:
    for fk, ff in FILTER_FIELDS.items():
        vals = []
        for c in communes_list:
            s = c if yr == 'all' else (c.get('years') or {}).get(yr, {})
            vals.append(get_field(s, ff['price']))
        scales[f'{yr}_{fk}'] = compute_percentiles(vals)

# Rent scales (no land)
rent_scales = {}
for yr in year_keys:
    for fk, ff in FILTER_FIELDS.items():
        if ff['rent'] is None:
            continue
        vals = []
        for c in communes_list:
            s = c if yr == 'all' else (c.get('years') or {}).get(yr, {})
            vals.append(get_field(s, ff['rent']))
        rent_scales[f'{yr}_{fk}'] = compute_percentiles(vals)

# Yield scales (no land)
yield_scales = {}
for yr in year_keys:
    for fk, ff in FILTER_FIELDS.items():
        if ff['rent'] is None:
            continue
        vals = []
        for c in communes_list:
            s = c if yr == 'all' else (c.get('years') or {}).get(yr, {})
            price = get_field(s, ff['price'])
            rent = get_field(s, ff['rent'])
            vals.append((rent * 12 / price) * 100 if price and rent else None)
        yield_scales[f'{yr}_{fk}'] = compute_percentiles(vals)

# Change scales
change_scales = {}
yr_strs = [str(y) for y in years_sorted]
modes = [
    ('price', [(fk, [ff['price']]) for fk, ff in FILTER_FIELDS.items()]),
    ('rent',  [(fk, [ff['rent']]) for fk, ff in FILTER_FIELDS.items() if ff['rent']]),
    ('yield', [(fk, [ff['price'], ff['rent']]) for fk, ff in FILTER_FIELDS.items() if ff['rent']]),
]
for base_yr in yr_strs:
    for end_yr in yr_strs:
        if end_yr <= base_yr:
            continue
        for mode_name, filters in modes:
            for fk, fields in filters:
                vals = []
                for c in communes_list:
                    yrs = c.get('years') or {}
                    base_data = yrs.get(base_yr, {})
                    end_data = yrs.get(end_yr, {})
                    if mode_name == 'yield':
                        bp = get_field(base_data, fields[0])
                        br = get_field(base_data, fields[1])
                        ep = get_field(end_data, fields[0])
                        er = get_field(end_data, fields[1])
                        b = (br * 12 / bp) * 100 if bp and br else None
                        e = (er * 12 / ep) * 100 if ep and er else None
                    else:
                        b = get_field(base_data, fields[0])
                        e = get_field(end_data, fields[0])
                    vals.append(((e - b) / b) * 100 if b and e else None)
                change_scales[f'{base_yr}_{end_yr}_{mode_name}_{fk}'] = compute_percentiles(vals)

print(f"Scales computed: {len(scales)} price, {len(rent_scales)} rent, {len(yield_scales)} yield, {len(change_scales)} change")

# ── Write cities.json ────────────────────────────────────────────────────────

output = {
    'communes': communes_list,
    'years': years_sorted,
    'scales': scales,
    'rentScales': rent_scales,
    'yieldScales': yield_scales,
    'changeScales': change_scales,
}

with open('public/cities.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

print(f"cities.json generated: {nb_communes} cities ({nb_loyer_only} rent-only), years: {years_sorted}")

# ── Generate PMTiles ────────────────────────────────────────────────────────

import subprocess, tempfile, urllib.request, os

def generate_pmtiles():
    url = "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes-version-simplifiee.geojson"
    out = "public/communes.pmtiles"
    with tempfile.NamedTemporaryFile(suffix=".geojson", delete=False) as tmp:
        print("Downloading communes GeoJSON...")
        urllib.request.urlretrieve(url, tmp.name)
        print("Generating PMTiles...")
        subprocess.run([
            "tippecanoe",
            "-o", out,
            "-Z", "4", "-z", "12",
            "-l", "communes",
            "--no-feature-limit",
            "--no-tile-size-limit",
            "--coalesce-densest-as-needed",
            "--extend-zooms-if-still-dropping",
            "--force",
            tmp.name,
        ], check=True)
        os.unlink(tmp.name)
    print(f"Done: {os.path.getsize(out) / 1024 / 1024:.1f} MB")

if __name__ == "__main__":
    generate_pmtiles()
