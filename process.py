import duckdb, json

CSV = '../../data/full_dvf.csv'  # chemin vers le fichier 3.5 Go

rows = duckdb.execute("""
    WITH dedup AS (
        SELECT DISTINCT ON (id_mutation, code_commune)
            id_mutation, code_commune, nom_commune, code_departement,
            valeur_fonciere / surface_reelle_bati AS prix_m2,
            latitude, longitude
        FROM read_csv_auto(?, sample_size=-1)
        WHERE nature_mutation = 'Vente'
          AND type_local IN ('Maison', 'Appartement')
          AND surface_reelle_bati BETWEEN 9 AND 1000
          AND valeur_fonciere > 0
    )
    SELECT
        code_commune,
        nom_commune,
        code_departement AS code_dep,
        ROUND(AVG(prix_m2)) AS avg_m2,
        COUNT(*) AS nb,
        ROUND(AVG(latitude), 5) AS lat,
        ROUND(AVG(longitude), 5) AS lon
    FROM dedup
    GROUP BY code_commune, nom_commune, code_departement
    HAVING COUNT(*) >= 5
    ORDER BY code_commune
""", [CSV]).fetchall()

cols = ['code_commune', 'nom_commune', 'code_dep', 'avg_m2', 'nb', 'lat', 'lon']
data = [dict(zip(cols, r)) for r in rows]

with open('communes.js', 'w', encoding='utf-8') as f:
    f.write('const COMMUNES = ')
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';')

print(f"communes.js généré : {len(data)} communes")
