// db-stats: Complete dashboard stats - mirrors Django views.py exactly
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cast varchar to integer safely (handles NULL and empty strings)
const ci = (c: string) => `COALESCE(CAST(NULLIF(${c}::text,'') AS INTEGER),0)`;

function serializeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'bigint') return Number(data);
  if (Array.isArray(data)) return data.map(serializeData);
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const key in data) result[key] = serializeData(data[key]);
    return result;
  }
  return data;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const client = new Client({
    hostname: "102.16.234.114", port: 5453, database: "dpeapp",
    user: "dpeapp", password: "s3cret!",
  });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const codeDren = parseInt(url.searchParams.get("code_dren") || "0");
    const codeCisco = parseInt(url.searchParams.get("code_cisco") || "0");
    const secteur = parseInt(url.searchParams.get("secteur") || "2");
    const sect = secteur > 1 ? ">= 0" : `= ${secteur}`;

    await client.connect();
    let query = "";

    // Build prefix/where/group for different filter levels
    function buildFilter(alias: string) {
      let sp = "", wc = "", gb = "";
      if (codeDren > 0 && codeCisco === 0) {
        sp = `${alias}."CODE_DREN",`; wc = `AND ${alias}."CODE_DREN" = ${codeDren}`; gb = `GROUP BY ${alias}."CODE_DREN"`;
      } else if (codeCisco > 0) {
        sp = `${alias}."CODE_CISCO",`; wc = `AND ${alias}."CODE_CISCO" = ${codeCisco}`; gb = `GROUP BY ${alias}."CODE_CISCO"`;
      }
      return { sp, wc, gb };
    }

    if (action === "getStatsEtablissements") {
      const { sp, wc, gb } = buildFilter('a1');
      query = `SELECT ${sp}
        SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS "N0_2022",
        SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS "N0_2023",
        SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS "N0_2024",
        SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS "N0_2025",
        SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS "N1_2022",
        SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS "N1_2023",
        SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS "N1_2024",
        SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS "N1_2025",
        SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS "N2_2022",
        SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS "N2_2023",
        SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS "N2_2024",
        SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS "N2_2025",
        SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS "N3_2022",
        SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS "N3_2023",
        SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS "N3_2024",
        SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS "N3_2025"
      FROM fpe_a1 a1 WHERE a1."SECTEUR" ${sect} ${wc} ${gb}`;

    } else if (action === "getStatsElevesN0N1") {
      // Exact copy of Django get_stats_elevesN0N1 - table fpe_e1, all years, N0 (presco) + N1 (primaire)
      const { sp, wc, gb } = buildFilter('eff');
      const psF = ci('eff."PS_F"'), psG = ci('eff."PS_G"');
      const msF = ci('eff."MS_F"'), msG = ci('eff."MS_G"');
      const gsF = ci('eff."GS_F"'), gsG = ci('eff."GS_G"');
      const presco = `${psF}+${psG}+${msF}+${msG}+${gsF}+${gsG}`;
      
      const t1F = ci('eff."T1_F"'), t1G = ci('eff."T1_G"');
      const t2F = ci('eff."T2_F"'), t2G = ci('eff."T2_G"');
      const t3F = ci('eff."T3_F"'), t3G = ci('eff."T3_G"');
      const t4F = ci('eff."T4_F"'), t4G = ci('eff."T4_G"');
      const t5F = ci('eff."T5_F"'), t5G = ci('eff."T5_G"');
      const primaire = `${t1F}+${t1G}+${t2F}+${t2G}+${t3F}+${t3G}+${t4F}+${t4G}+${t5F}+${t5G}`;

      query = `SELECT ${sp}
        SUM(CASE WHEN eff."EXISTE_PRESCO"=1 AND eff."ANNEE_SCOLAIRE"=2022 THEN ${presco} ELSE 0 END) AS "N0_2022",
        SUM(CASE WHEN eff."EXISTE_PRESCO"=1 AND eff."ANNEE_SCOLAIRE"=2023 THEN ${presco} ELSE 0 END) AS "N0_2023",
        SUM(CASE WHEN eff."EXISTE_PRESCO"=1 AND eff."ANNEE_SCOLAIRE"=2024 THEN ${presco} ELSE 0 END) AS "N0_2024",
        SUM(CASE WHEN eff."EXISTE_PRESCO"=1 AND eff."ANNEE_SCOLAIRE"=2025 THEN ${presco} ELSE 0 END) AS "N0_2025",
        SUM(CASE WHEN eff."EXISTE_PRIMAIRE"=1 AND eff."ANNEE_SCOLAIRE"=2022 THEN (${primaire}) ELSE 0 END) AS "N1_2022",
        SUM(CASE WHEN eff."EXISTE_PRIMAIRE"=1 AND eff."ANNEE_SCOLAIRE"=2023 THEN (${primaire}) ELSE 0 END) AS "N1_2023",
        SUM(CASE WHEN eff."EXISTE_PRIMAIRE"=1 AND eff."ANNEE_SCOLAIRE"=2024 THEN (${primaire}) ELSE 0 END) AS "N1_2024",
        SUM(CASE WHEN eff."EXISTE_PRIMAIRE"=1 AND eff."ANNEE_SCOLAIRE"=2025 THEN (${primaire}) ELSE 0 END) AS "N1_2025"
      FROM fpe_e1 eff WHERE eff."SECTEUR" ${sect} ${wc} ${gb}`;

    } else if (action === "getStatsElevesN2N3") {
      // Exact copy of Django get_stats_elevesN2N3 - table fpe_e4, N2 (college) + N3 (lycee)
      const { sp, wc, gb } = buildFilter('eff');
      const college = `${ci('eff."T6_F"')}+${ci('eff."T6_G"')}+${ci('eff."T7_F"')}+${ci('eff."T7_G"')}+${ci('eff."T8_F"')}+${ci('eff."T8_G"')}+${ci('eff."T9_F"')}+${ci('eff."T9_G"')}`;
      
      const lycee = `${ci('eff."_2NDE_F"')}+${ci('eff."_2NDE_G"')}+${ci('eff."_1A_F"')}+${ci('eff."_1A_G"')}+${ci('eff."_1C_F"')}+${ci('eff."_1C_G"')}+${ci('eff."_1D_F"')}+${ci('eff."_1D_G"')}+${ci('eff."_1L_F"')}+${ci('eff."_1L_G"')}+${ci('eff."_1S_F"')}+${ci('eff."_1S_G"')}+${ci('eff."_1OSE_F"')}+${ci('eff."_1OSE_G"')}+${ci('eff."TA_F"')}+${ci('eff."TA_G"')}+${ci('eff."TC_F"')}+${ci('eff."TC_G"')}+${ci('eff."TD_F"')}+${ci('eff."TD_G"')}+${ci('eff."TS_F"')}+${ci('eff."TS_G"')}+${ci('eff."TOSE_F"')}+${ci('eff."TOSE_G"')}`;

      query = `SELECT ${sp}
        SUM(CASE WHEN eff."EXISTE_COLLEGE"=1 AND eff."ANNEE_SCOLAIRE"=2022 THEN (${college}) ELSE 0 END) AS "N2_2022",
        SUM(CASE WHEN eff."EXISTE_COLLEGE"=1 AND eff."ANNEE_SCOLAIRE"=2023 THEN (${college}) ELSE 0 END) AS "N2_2023",
        SUM(CASE WHEN eff."EXISTE_COLLEGE"=1 AND eff."ANNEE_SCOLAIRE"=2024 THEN (${college}) ELSE 0 END) AS "N2_2024",
        SUM(CASE WHEN eff."EXISTE_COLLEGE"=1 AND eff."ANNEE_SCOLAIRE"=2025 THEN (${college}) ELSE 0 END) AS "N2_2025",
        SUM(CASE WHEN eff."EXISTE_LYCEE"=1 AND eff."ANNEE_SCOLAIRE"=2022 THEN (${lycee}) ELSE 0 END) AS "N3_2022",
        SUM(CASE WHEN eff."EXISTE_LYCEE"=1 AND eff."ANNEE_SCOLAIRE"=2023 THEN (${lycee}) ELSE 0 END) AS "N3_2023",
        SUM(CASE WHEN eff."EXISTE_LYCEE"=1 AND eff."ANNEE_SCOLAIRE"=2024 THEN (${lycee}) ELSE 0 END) AS "N3_2024",
        SUM(CASE WHEN eff."EXISTE_LYCEE"=1 AND eff."ANNEE_SCOLAIRE"=2025 THEN (${lycee}) ELSE 0 END) AS "N3_2025"
      FROM fpe_e4 eff WHERE eff."SECTEUR" ${sect} ${wc} ${gb}`;

    } else if (action === "getStatsEnseignants") {
      // Exact copy of Django get_stats_enseignants_en_classe - table fpe_p1
      const { sp, wc, gb } = buildFilter('p1');
      query = `SELECT ${sp}
        SUM(CASE WHEN p1."EXISTE_PRESCO"=1 AND p1."NIVEAU_TENU_PRESCO"='1' AND p1."ANNEE_SCOLAIRE"=2022 THEN 1 ELSE 0 END) AS "N0_2022",
        SUM(CASE WHEN p1."EXISTE_PRESCO"=1 AND p1."NIVEAU_TENU_PRESCO"='1' AND p1."ANNEE_SCOLAIRE"=2023 THEN 1 ELSE 0 END) AS "N0_2023",
        SUM(CASE WHEN p1."EXISTE_PRESCO"=1 AND p1."NIVEAU_TENU_PRESCO"='1' AND p1."ANNEE_SCOLAIRE"=2024 THEN 1 ELSE 0 END) AS "N0_2024",
        SUM(CASE WHEN p1."EXISTE_PRESCO"=1 AND p1."NIVEAU_TENU_PRESCO"='1' AND p1."ANNEE_SCOLAIRE"=2025 THEN 1 ELSE 0 END) AS "N0_2025",
        SUM(CASE WHEN p1."EXISTE_PRIMAIRE"=1 AND p1."NIVEAU_TENU_PRIMAIRE"='1' AND p1."ANNEE_SCOLAIRE"=2022 THEN 1 ELSE 0 END) AS "N1_2022",
        SUM(CASE WHEN p1."EXISTE_PRIMAIRE"=1 AND p1."NIVEAU_TENU_PRIMAIRE"='1' AND p1."ANNEE_SCOLAIRE"=2023 THEN 1 ELSE 0 END) AS "N1_2023",
        SUM(CASE WHEN p1."EXISTE_PRIMAIRE"=1 AND p1."NIVEAU_TENU_PRIMAIRE"='1' AND p1."ANNEE_SCOLAIRE"=2024 THEN 1 ELSE 0 END) AS "N1_2024",
        SUM(CASE WHEN p1."EXISTE_PRIMAIRE"=1 AND p1."NIVEAU_TENU_PRIMAIRE"='1' AND p1."ANNEE_SCOLAIRE"=2025 THEN 1 ELSE 0 END) AS "N1_2025",
        SUM(CASE WHEN p1."EXISTE_COLLEGE"=1 AND p1."EN_SALLE"=1 AND p1."ANNEE_SCOLAIRE"=2022 THEN 1 ELSE 0 END) AS "N2_2022",
        SUM(CASE WHEN p1."EXISTE_COLLEGE"=1 AND p1."EN_SALLE"=1 AND p1."ANNEE_SCOLAIRE"=2023 THEN 1 ELSE 0 END) AS "N2_2023",
        SUM(CASE WHEN p1."EXISTE_COLLEGE"=1 AND p1."EN_SALLE"=1 AND p1."ANNEE_SCOLAIRE"=2024 THEN 1 ELSE 0 END) AS "N2_2024",
        SUM(CASE WHEN p1."EXISTE_COLLEGE"=1 AND p1."EN_SALLE"=1 AND p1."ANNEE_SCOLAIRE"=2025 THEN 1 ELSE 0 END) AS "N2_2025",
        SUM(CASE WHEN p1."EXISTE_LYCEE"=1 AND p1."EN_SALLE"=1 AND p1."ANNEE_SCOLAIRE"=2022 THEN 1 ELSE 0 END) AS "N3_2022",
        SUM(CASE WHEN p1."EXISTE_LYCEE"=1 AND p1."EN_SALLE"=1 AND p1."ANNEE_SCOLAIRE"=2023 THEN 1 ELSE 0 END) AS "N3_2023",
        SUM(CASE WHEN p1."EXISTE_LYCEE"=1 AND p1."EN_SALLE"=1 AND p1."ANNEE_SCOLAIRE"=2024 THEN 1 ELSE 0 END) AS "N3_2024",
        SUM(CASE WHEN p1."EXISTE_LYCEE"=1 AND p1."EN_SALLE"=1 AND p1."ANNEE_SCOLAIRE"=2025 THEN 1 ELSE 0 END) AS "N3_2025"
      FROM fpe_p1 p1 WHERE p1."SECTEUR" ${sect} ${wc} ${gb}`;

    } else if (action === "getStatsPlacesAssises") {
      // Exact copy of Django get_stats_place_assises - table fpe_k1
      const { sp, wc, gb } = buildFilter('k1');
      const prescoChaises = ci('"PRESCO_PETITES_CHAISES_BON_ETAT"');
      
      const primBancs = `${ci('"PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT"')}+${ci('"PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT"')}*2+${ci('"PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT"')}*3+${ci('"PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT"')}*4+${ci('"PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT"')}*5`;
      
      const collBancs = `${ci('"COLLEGE_TABLES_BANCS_1PL_BON_ETAT"')}+${ci('"COLLEGE_TABLES_BANCS_2PL_BON_ETAT"')}*2+${ci('"COLLEGE_TABLES_BANCS_3PL_BON_ETAT"')}*3+${ci('"COLLEGE_TABLES_BANCS_4PL_BON_ETAT"')}*4+${ci('"COLLEGE_TABLES_BANCS_5PL_PLUS_BON_ETAT"')}*5`;
      
      const lycBancs = `${ci('"LYCEE_TABLES_BANCS_1PL_BON_ETAT"')}+${ci('"LYCEE_TABLES_BANCS_2PL_BON_ETAT"')}*2+${ci('"LYCEE_TABLES_BANCS_3PL_BON_ETAT"')}*3+${ci('"LYCEE_TABLES_BANCS_4PL_BON_ETAT"')}*4+${ci('"LYCEE_TABLES_BANCS_5PL_PLUS_BON_ETAT"')}*5`;

      query = `SELECT ${sp}
        SUM(CASE WHEN k1."EXISTE_PRESCO"=1 AND k1."ANNEE_SCOLAIRE"=2022 THEN (${prescoChaises}) ELSE 0 END) AS "N0_2022",
        SUM(CASE WHEN k1."EXISTE_PRESCO"=1 AND k1."ANNEE_SCOLAIRE"=2023 THEN (${prescoChaises}) ELSE 0 END) AS "N0_2023",
        SUM(CASE WHEN k1."EXISTE_PRESCO"=1 AND k1."ANNEE_SCOLAIRE"=2024 THEN (${prescoChaises}) ELSE 0 END) AS "N0_2024",
        SUM(CASE WHEN k1."EXISTE_PRESCO"=1 AND k1."ANNEE_SCOLAIRE"=2025 THEN (${prescoChaises}) ELSE 0 END) AS "N0_2025",
        SUM(CASE WHEN k1."EXISTE_PRIMAIRE"=1 AND k1."ANNEE_SCOLAIRE"=2022 THEN (${primBancs}) ELSE 0 END) AS "N1_2022",
        SUM(CASE WHEN k1."EXISTE_PRIMAIRE"=1 AND k1."ANNEE_SCOLAIRE"=2023 THEN (${primBancs}) ELSE 0 END) AS "N1_2023",
        SUM(CASE WHEN k1."EXISTE_PRIMAIRE"=1 AND k1."ANNEE_SCOLAIRE"=2024 THEN (${primBancs}) ELSE 0 END) AS "N1_2024",
        SUM(CASE WHEN k1."EXISTE_PRIMAIRE"=1 AND k1."ANNEE_SCOLAIRE"=2025 THEN (${primBancs}) ELSE 0 END) AS "N1_2025",
        SUM(CASE WHEN k1."EXISTE_COLLEGE"=1 AND k1."ANNEE_SCOLAIRE"=2022 THEN (${collBancs}) ELSE 0 END) AS "N2_2022",
        SUM(CASE WHEN k1."EXISTE_COLLEGE"=1 AND k1."ANNEE_SCOLAIRE"=2023 THEN (${collBancs}) ELSE 0 END) AS "N2_2023",
        SUM(CASE WHEN k1."EXISTE_COLLEGE"=1 AND k1."ANNEE_SCOLAIRE"=2024 THEN (${collBancs}) ELSE 0 END) AS "N2_2024",
        SUM(CASE WHEN k1."EXISTE_COLLEGE"=1 AND k1."ANNEE_SCOLAIRE"=2025 THEN (${collBancs}) ELSE 0 END) AS "N2_2025",
        SUM(CASE WHEN k1."EXISTE_LYCEE"=1 AND k1."ANNEE_SCOLAIRE"=2022 THEN (${lycBancs}) ELSE 0 END) AS "N3_2022",
        SUM(CASE WHEN k1."EXISTE_LYCEE"=1 AND k1."ANNEE_SCOLAIRE"=2023 THEN (${lycBancs}) ELSE 0 END) AS "N3_2023",
        SUM(CASE WHEN k1."EXISTE_LYCEE"=1 AND k1."ANNEE_SCOLAIRE"=2024 THEN (${lycBancs}) ELSE 0 END) AS "N3_2024",
        SUM(CASE WHEN k1."EXISTE_LYCEE"=1 AND k1."ANNEE_SCOLAIRE"=2025 THEN (${lycBancs}) ELSE 0 END) AS "N3_2025"
      FROM fpe_k1 k1 WHERE k1."SECTEUR" ${sect} ${wc} ${gb}`;

    } else {
      await client.end();
      return new Response(JSON.stringify({ error: "Unknown action", action }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const result = await client.queryObject(query);
    await client.end();

    return new Response(JSON.stringify(serializeData(result.rows)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("db-stats error:", e);
    try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message, fn: "db-stats" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
