import duckdb, json, csv as csv_mod

CSV = 'data/full_dvf.csv'  # chemin vers le fichier 3.5 Go

# ── Chargement des données loyer MEF/DHUP ────────────────────────────────────
loyer_data = {}  # dict[code_commune][annee][field]

for typ in ('app', 'mai'):
    for annee in (2022, 2023, 2024, 2025):
        path = f'data/loyer-pred-{typ}-mef-dhup-{annee}.csv'
        with open(path, encoding='latin-1') as f:
            reader = csv_mod.DictReader(f, delimiter=';')
            for row in reader:
                code = row['INSEE_C'].strip().strip('"')
                val = float(row['loypredm2'].replace(',', '.'))
                if code not in loyer_data:
                    loyer_data[code] = {}
                if annee not in loyer_data[code]:
                    loyer_data[code][annee] = {}
                field = 'loyer_appart' if typ == 'app' else 'loyer_maison'
                loyer_data[code][annee][field] = round(val, 2)
                nb_field = 'nb_loyer_appart' if typ == 'app' else 'nb_loyer_maison'
                loyer_data[code][annee][nb_field] = int(row['nbobs_com'] or 0)

# Calculer loyer_residentiel (moyenne pondérée) et dupliquer 2022 → 2020, 2021
for code, by_year in loyer_data.items():
    for annee in list(by_year.keys()):
        d = by_year[annee]
        pairs = [(d[f], d[nf]) for f, nf in
                 [('loyer_appart', 'nb_loyer_appart'), ('loyer_maison', 'nb_loyer_maison')]
                 if d.get(f) is not None and d.get(nf)]
        if pairs:
            total_w = sum(nb for _, nb in pairs)
            d['loyer_residentiel'] = round(sum(v * nb for v, nb in pairs) / total_w, 2) if total_w else None
        else:
            d['loyer_residentiel'] = None
        d['nb_loyer_residentiel'] = (d.get('nb_loyer_appart') or 0) + (d.get('nb_loyer_maison') or 0)
    for yr_fill in (2020, 2021):
        if yr_fill not in by_year and 2022 in by_year:
            by_year[yr_fill] = by_year[2022].copy()

# Calcul des valeurs globales loyer (moyenne pondérée sur 2022-2025)
loyer_global = {}
for code, by_year in loyer_data.items():
    agg = {}
    for field, nb_field in [
        ('loyer_appart',      'nb_loyer_appart'),
        ('loyer_maison',      'nb_loyer_maison'),
        ('loyer_residentiel', 'nb_loyer_residentiel'),
    ]:
        pairs = [(by_year[yr][field], by_year[yr].get(nb_field, 0))
                 for yr in (2022, 2023, 2024, 2025)
                 if yr in by_year and by_year[yr].get(field) is not None]
        if pairs:
            total_w = sum(nb for _, nb in pairs) or len(pairs)
            agg[field] = round(sum(v * nb for v, nb in pairs) / total_w, 2)
        else:
            agg[field] = None
    for nb_field in ('nb_loyer_appart', 'nb_loyer_maison', 'nb_loyer_residentiel'):
        vals = [by_year[yr][nb_field] for yr in (2022, 2023, 2024, 2025)
                if yr in by_year and by_year[yr].get(nb_field) is not None]
        agg[nb_field] = round(sum(vals) / len(vals)) if vals else None
    loyer_global[code] = agg

print(f"Loyer data chargé : {len(loyer_data)} communes")

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
    -- Agréger par mutation+commune : une mutation peut couvrir plusieurs lots
    -- (ex. 2 appats vendus ensemble = même valeur_fonciere, surfaces différentes)
    -- On somme les surfaces et on garde le type si homogène
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
        HAVING COUNT(DISTINCT type_local) = 1  -- exclure les mutations mixtes Maison+Appart
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
          AND valeur_fonciere / surface_totale > 10  -- exclure cessions symboliques (publiques, familiales)
    ),
    terrain_global AS (
        SELECT
            code_commune,
            ROUND(MEDIAN(prix_m2)) AS med_m2_terrain,
            COUNT(*) AS nb_terrain
        FROM dedup_terrain
        GROUP BY code_commune
        HAVING COUNT(*) >= 5
    ),
    terrain_year AS (
        SELECT
            code_commune, annee,
            ROUND(MEDIAN(prix_m2)) AS med_m2_terrain,
            COUNT(*) AS nb_terrain
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
                    'med_m2_terrain', med_m2_terrain,
                    'nb_terrain', nb_terrain
                )
            ) AS terrain_years_json
        FROM terrain_year
        GROUP BY code_commune
    ),
    global_agg AS (
        SELECT
            code_commune, nom_commune, code_departement AS code_dep,
            ROUND(MEDIAN(prix_m2)) AS med_m2,
            ROUND(MEDIAN(CASE WHEN type_local = 'Maison' THEN prix_m2 END)) AS med_m2_maison,
            ROUND(MEDIAN(CASE WHEN type_local = 'Appartement' THEN prix_m2 END)) AS med_m2_appart,
            COUNT(*) AS nb,
            COUNT(CASE WHEN type_local = 'Maison' THEN 1 END) AS nb_maison,
            COUNT(CASE WHEN type_local = 'Appartement' THEN 1 END) AS nb_appart,
            ROUND(AVG(latitude), 5) AS lat,
            ROUND(AVG(longitude), 5) AS lon
        FROM dedup
        GROUP BY code_commune, nom_commune, code_departement
        HAVING COUNT(*) >= 10
    ),
    year_agg AS (
        SELECT
            code_commune, annee,
            ROUND(MEDIAN(prix_m2)) AS med_m2,
            ROUND(MEDIAN(CASE WHEN type_local = 'Maison' THEN prix_m2 END)) AS med_m2_maison,
            ROUND(MEDIAN(CASE WHEN type_local = 'Appartement' THEN prix_m2 END)) AS med_m2_appart,
            COUNT(*) AS nb,
            COUNT(CASE WHEN type_local = 'Maison' THEN 1 END) AS nb_maison,
            COUNT(CASE WHEN type_local = 'Appartement' THEN 1 END) AS nb_appart
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
                    'med_m2', med_m2,
                    'med_m2_maison', med_m2_maison,
                    'med_m2_appart', med_m2_appart,
                    'nb', nb,
                    'nb_maison', nb_maison,
                    'nb_appart', nb_appart
                )
            ) AS years_json
        FROM year_agg
        GROUP BY code_commune
    )
    SELECT
        g.code_commune,
        g.nom_commune,
        g.code_dep,
        g.med_m2, g.med_m2_maison, g.med_m2_appart,
        g.nb, g.nb_maison, g.nb_appart,
        tg.med_m2_terrain, tg.nb_terrain,
        g.lat, g.lon,
        COALESCE(yj.years_json, '{{}}') AS years_json,
        COALESCE(tyj.terrain_years_json, '{{}}') AS terrain_years_json
    FROM global_agg g
    LEFT JOIN year_json yj ON yj.code_commune = g.code_commune
    LEFT JOIN terrain_global tg ON tg.code_commune = g.code_commune
    LEFT JOIN terrain_year_json tyj ON tyj.code_commune = g.code_commune
    ORDER BY g.code_commune
""")

GLOBAL_COLS = ['code_commune', 'nom_commune', 'code_dep',
               'med_m2', 'med_m2_maison', 'med_m2_appart',
               'nb', 'nb_maison', 'nb_appart',
               'med_m2_terrain', 'nb_terrain', 'lat', 'lon']

all_years = set()
nb_communes = 0

with open('communes.js', 'w', encoding='utf-8') as f:
    f.write('const COMMUNES = [\n')
    first = True
    while True:
        row = cursor.fetchone()
        if row is None:
            break
        if not first:
            f.write(',\n')
        commune = dict(zip(GLOBAL_COLS, row[:13]))
        years_data = json.loads(row[13])
        terrain_years_data = json.loads(row[14])
        # Merge terrain year stats into the years dict
        for yr, stats in terrain_years_data.items():
            if yr in years_data:
                years_data[yr].update(stats)
            else:
                years_data[yr] = stats

        # Injection des données loyer
        code = commune['code_commune']
        lg = loyer_global.get(code, {})
        commune['loyer_residentiel']    = lg.get('loyer_residentiel')
        commune['loyer_maison']         = lg.get('loyer_maison')
        commune['loyer_appart']         = lg.get('loyer_appart')
        commune['nb_loyer_residentiel'] = lg.get('nb_loyer_residentiel')
        commune['nb_loyer_maison']      = lg.get('nb_loyer_maison')
        commune['nb_loyer_appart']      = lg.get('nb_loyer_appart')

        ly = loyer_data.get(code, {})
        for yr_int, fields in ly.items():
            yr_str = str(yr_int)
            if yr_str in years_data:
                years_data[yr_str].update(fields)
            else:
                years_data[yr_str] = fields.copy()

        all_years.update(years_data.keys())
        commune['years'] = years_data
        json.dump(commune, f, ensure_ascii=False, separators=(',', ':'))
        first = False
        nb_communes += 1
    f.write('\n];\n')
    years_sorted = sorted(int(y) for y in all_years)
    f.write('const YEARS = ')
    json.dump(years_sorted, f)
    f.write(';\n')

print(f"communes.js généré : {nb_communes} communes, années : {years_sorted}")
