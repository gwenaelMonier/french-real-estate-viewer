import duckdb, json
from collections import defaultdict

CSV = 'data/full_dvf.csv'  # chemin vers le fichier 3.5 Go

STAT_COLS = ['avg_m2', 'avg_m2_maison', 'avg_m2_appart',
            'med_m2', 'med_m2_maison', 'med_m2_appart',
            'nb', 'nb_maison', 'nb_appart']

DEDUP_CTE = """
    WITH raw AS (
        SELECT
            id_mutation, code_commune, nom_commune, code_departement,
            type_local,
            valeur_fonciere,
            surface_reelle_bati,
            latitude, longitude
        FROM read_csv_auto('{csv}', sample_size=-1)
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
            MAX(type_local) AS type_local,
            MAX(valeur_fonciere) AS valeur_fonciere,
            SUM(surface_reelle_bati) AS surface_totale,
            AVG(latitude) AS latitude,
            AVG(longitude) AS longitude
        FROM raw
        GROUP BY id_mutation, code_commune, nom_commune, code_departement
        HAVING COUNT(DISTINCT type_local) = 1  -- exclure les mutations mixtes Maison+Appart
    ),
    dedup AS (
        SELECT *,
            valeur_fonciere / surface_totale AS prix_m2
        FROM per_mutation
        WHERE surface_totale BETWEEN 9 AND 1000
    )
""".replace('{csv}', CSV)

# Agrégats globaux (toutes années)
global_rows = duckdb.execute(f"""
    {DEDUP_CTE}
    SELECT
        code_commune,
        nom_commune,
        code_departement AS code_dep,
        ROUND(AVG(prix_m2)) AS avg_m2,
        ROUND(AVG(CASE WHEN type_local = 'Maison' THEN prix_m2 END)) AS avg_m2_maison,
        ROUND(AVG(CASE WHEN type_local = 'Appartement' THEN prix_m2 END)) AS avg_m2_appart,
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
    HAVING COUNT(*) >= 5
    ORDER BY code_commune
""").fetchall()

global_cols = ['code_commune', 'nom_commune', 'code_dep',
               'avg_m2', 'avg_m2_maison', 'avg_m2_appart',
               'med_m2', 'med_m2_maison', 'med_m2_appart',
               'nb', 'nb_maison', 'nb_appart', 'lat', 'lon']
communes = {r[0]: dict(zip(global_cols, r)) for r in global_rows}

# Agrégats par année
year_rows = duckdb.execute(f"""
    WITH raw AS (
        SELECT
            id_mutation, code_commune,
            type_local,
            valeur_fonciere,
            surface_reelle_bati,
            YEAR(CAST(date_mutation AS DATE)) AS annee
        FROM read_csv_auto('{CSV}', sample_size=-1)
        WHERE nature_mutation = 'Vente'
          AND type_local IN ('Maison', 'Appartement')
          AND surface_reelle_bati > 0
          AND valeur_fonciere > 0
    ),
    per_mutation AS (
        SELECT
            id_mutation, code_commune, annee,
            MAX(type_local) AS type_local,
            MAX(valeur_fonciere) AS valeur_fonciere,
            SUM(surface_reelle_bati) AS surface_totale
        FROM raw
        GROUP BY id_mutation, code_commune, annee
        HAVING COUNT(DISTINCT type_local) = 1
    ),
    dedup AS (
        SELECT *,
            valeur_fonciere / surface_totale AS prix_m2
        FROM per_mutation
        WHERE surface_totale BETWEEN 9 AND 1000
    )
    SELECT
        code_commune,
        annee,
        ROUND(AVG(prix_m2)) AS avg_m2,
        ROUND(AVG(CASE WHEN type_local = 'Maison' THEN prix_m2 END)) AS avg_m2_maison,
        ROUND(AVG(CASE WHEN type_local = 'Appartement' THEN prix_m2 END)) AS avg_m2_appart,
        ROUND(MEDIAN(prix_m2)) AS med_m2,
        ROUND(MEDIAN(CASE WHEN type_local = 'Maison' THEN prix_m2 END)) AS med_m2_maison,
        ROUND(MEDIAN(CASE WHEN type_local = 'Appartement' THEN prix_m2 END)) AS med_m2_appart,
        COUNT(*) AS nb,
        COUNT(CASE WHEN type_local = 'Maison' THEN 1 END) AS nb_maison,
        COUNT(CASE WHEN type_local = 'Appartement' THEN 1 END) AS nb_appart
    FROM dedup
    GROUP BY code_commune, annee
    HAVING COUNT(*) >= 3
    ORDER BY code_commune, annee
""").fetchall()

year_cols = ['code_commune', 'annee',
             'avg_m2', 'avg_m2_maison', 'avg_m2_appart',
             'med_m2', 'med_m2_maison', 'med_m2_appart',
             'nb', 'nb_maison', 'nb_appart']

all_years = set()
year_by_commune = defaultdict(dict)
for row in year_rows:
    d = dict(zip(year_cols, row))
    code = d['code_commune']
    annee = d['annee']
    all_years.add(annee)
    if code in communes:
        year_by_commune[code][str(annee)] = {k: d[k] for k in STAT_COLS}

# Injection des données par année dans chaque commune
for code, c in communes.items():
    c['years'] = year_by_commune.get(code, {})

data = list(communes.values())
years_sorted = sorted(all_years)

with open('communes.js', 'w', encoding='utf-8') as f:
    f.write('const YEARS = ')
    json.dump(years_sorted, f)
    f.write(';\n')
    f.write('const COMMUNES = ')
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';')

print(f"communes.js généré : {len(data)} communes, années : {years_sorted}")
