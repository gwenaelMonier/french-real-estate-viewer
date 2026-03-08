import duckdb, json

CSV = 'data/full_dvf.csv'  # chemin vers le fichier 3.5 Go

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
        g.lat, g.lon,
        COALESCE(yj.years_json, '{{}}') AS years_json
    FROM global_agg g
    LEFT JOIN year_json yj ON yj.code_commune = g.code_commune
    ORDER BY g.code_commune
""")

GLOBAL_COLS = ['code_commune', 'nom_commune', 'code_dep',
               'med_m2', 'med_m2_maison', 'med_m2_appart',
               'nb', 'nb_maison', 'nb_appart', 'lat', 'lon']

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
        commune = dict(zip(GLOBAL_COLS, row[:11]))
        years = json.loads(row[11])
        all_years.update(years.keys())
        commune['years'] = years
        json.dump(commune, f, ensure_ascii=False, separators=(',', ':'))
        first = False
        nb_communes += 1
    f.write('\n];\n')
    years_sorted = sorted(int(y) for y in all_years)
    f.write('const YEARS = ')
    json.dump(years_sorted, f)
    f.write(';\n')

print(f"communes.js généré : {nb_communes} communes, années : {years_sorted}")
