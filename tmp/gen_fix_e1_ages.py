"""Génère le SQL de sauvegarde + réparation des colonnes d'âge 2026 de fpe_e1
depuis la table de référence fpe_e1_2026 (mêmes établissements, 1:1).

Colonnes ciblées : uniquement les vraies colonnes d'âge
(`_<n>ans`, `_moins_<n>ans`, `_<n>ans_plus`), en excluant les colonnes de
transfert (`T*_TRANSFERT`) que le filtre « ANS » attraperait à tort.
"""
import subprocess
import os

AGE_RE = r"_(moins_)?[0-9]+ans(_plus)?$"

COLS_SQL = f"""
select l.column_name || '|' || n.column_name
from information_schema.columns l
join information_schema.columns n
  on lower(n.column_name) = lower(l.column_name) and n.table_name = 'fpe_e1_2026'
where l.table_name = 'fpe_e1' and lower(l.column_name) ~ '{AGE_RE}'
  and lower(n.column_name) ~ '{AGE_RE}'
order by 1;
"""

env = dict(os.environ, PGPASSWORD="s3cret!")
out = subprocess.run(
    ["psql", "postgresql://dpeapp@102.16.234.114:5453/dpeapp", "-tA", "-c", COLS_SQL],
    capture_output=True, text=True, env=env, check=True,
)
pairs = [line.split("|") for line in out.stdout.splitlines() if "|" in line]
assert pairs, "aucune colonne d'âge trouvée"
print(f"{len(pairs)} colonnes d'âge communes")

backup_cols = ",\n    ".join(f'"{legacy}"' for legacy, _ in pairs)
set_list = ",\n    ".join(f'"{legacy}" = n."{new}"' for legacy, new in pairs)

sql = f"""
-- 1) Sauvegarde des valeurs d'âge 2026 actuellement en base (avant réparation)
DROP TABLE IF EXISTS public.fpe_e1_age_backup_2026;
CREATE TABLE public.fpe_e1_age_backup_2026 AS
SELECT "CODE_ETAB", "ANNEE_SCOLAIRE",
    {backup_cols}
FROM public.fpe_e1
WHERE "ANNEE_SCOLAIRE" = 2026;

-- 2) Réparation depuis la table de référence 2026
BEGIN;
UPDATE public.fpe_e1 AS l
SET {set_list}
FROM public.fpe_e1_2026 AS n
WHERE n.annee = 2026
  AND l."ANNEE_SCOLAIRE" = 2026
  AND l."CODE_ETAB" = n.code_etab;
COMMIT;
"""

with open("tmp/fix_e1_ages_2026.sql", "w", encoding="utf-8") as fh:
    fh.write(sql)
print("écrit tmp/fix_e1_ages_2026.sql", len(sql), "octets")
