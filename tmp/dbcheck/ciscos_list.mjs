import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
await c.connect();
const sql = (codeDren) => `
          WITH referentiel AS (
            SELECT "CODE_CISCO"::int AS code_cisco, "CODE_DREN"::int AS code_dren, btrim("CISCO") AS cisco
            FROM v_cisco WHERE "CODE_DREN" > 0 AND "CODE_CISCO" IS NOT NULL
            UNION ALL
            SELECT "CODE_CISCO"::int, "CODE_DREN"::int, btrim("CISCO")
            FROM fpe_a1
            WHERE "ANNEE_SCOLAIRE" = (SELECT MAX("ANNEE_SCOLAIRE") FROM fpe_a1)
              AND "CODE_DREN" > 0 AND "CODE_CISCO" IS NOT NULL
          )
          SELECT code_cisco AS "CODE_CISCO", MAX(NULLIF(cisco, '')) AS "CISCO", code_dren AS "CODE_DREN"
          FROM referentiel
          ${!codeDren || codeDren === 0 ? "WHERE code_dren > 0" : `WHERE code_dren = ${Number(codeDren)}`}
          GROUP BY code_cisco, code_dren
          ORDER BY 2`;
console.log('DREN 61:', (await c.query(sql(61))).rows);
const all = (await c.query(sql(0))).rows;
console.log('total:', all.length, '| 622 présent:', all.some(r => r.CODE_CISCO === 622));
console.log('doublons:', all.length - new Set(all.map(r => r.CODE_CISCO)).size);
await c.end();
