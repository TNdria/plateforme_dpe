from django.shortcuts import redirect, render 
from referentiel.views import get_dren
from django.db import connection
from django.http import JsonResponse

from django.contrib.auth.decorators import login_required

#@login_required
def index(request):
    user = request.user
    drens = get_dren()
    return render(request,template_name="dashboard.html", context={"dren":drens})

#@login_required
def to_dicts_json(query):
    with connection.cursor() as cursor:
        cursor.execute(query)
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    
    res = [dict(zip(columns, row)) for row in rows]
    return JsonResponse(res, safe=False)


def get_dren():
    with connection.cursor() as cursor:
        cursor.execute('SELECT * FROM v_dren ORDER BY "DREN" ')
        rows = cursor.fetchall()
    
    drens = [{'CODE_DREN': row[0], 'DREN': row[1]} for row in rows]
    return drens 


def get_cisco(request, code_dren):
    q = """ SELECT * FROM v_cisco {0} {1} ORDER BY "CISCO" """
    if( not code_dren or code_dren == 0):
        q = q.format(' WHERE "CODE_DREN" ',' > 0')
    else:
        q = q.format('WHERE "CODE_DREN" = ', code_dren)

    return to_dicts_json(q) 


def get_stats_etab(request, code_dren,code_cisco,secteur):
    q = """
        SELECT 
            {0}
            SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS N0_2022,
            SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS N0_2023,
            SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS N0_2024,
            SUM(CASE WHEN a1."EXISTE_PRESCO"=1 AND a1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS N0_2025,
            SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS N1_2022,
            SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS N1_2023,
            SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS N1_2024,
            SUM(CASE WHEN a1."EXISTE_PRIMAIRE"=1 AND a1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS N1_2025,
            SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS N2_2022,
            SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS N2_2023,
            SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS N2_2024,
            SUM(CASE WHEN a1."EXISTE_COLLEGE"=1 AND a1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS N2_2025,
            SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS N3_2022,
            SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS N3_2023,
            SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS N3_2024,
            SUM(CASE WHEN a1."EXISTE_LYCEE"=1 AND a1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS N3_2025
        FROM fpe_a1 a1
        WHERE a1."SECTEUR"  {1} {2}
        {3}
        
    """

    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '

    if( not code_dren or code_dren == 0): #nationale, tsy mila aggregation dren sy cisco
        q = q.format('',sect,'','')
    elif (code_dren > 0 and code_cisco == 0): #DREN ihany fa toutes cisco ao anaty DREN choisit
        q = q.format('a1."CODE_DREN", ', sect, f' AND a1."CODE_DREN" = {code_dren} ','GROUP BY a1."CODE_DREN" ')
    else: #Misy DREN sady misy CISCO
         q = q.format('a1."CODE_CISCO", ',sect, f' AND a1."CODE_CISCO" = {code_cisco} ','GROUP BY a1."CODE_CISCO" ')

    return to_dicts_json(q) 


def get_stats_elevesN0N1(request, code_dren,code_cisco, secteur):
    q = """
        SELECT 
            {0}
            SUM(CASE WHEN eff."EXISTE_PRESCO"=1 AND eff."ANNEE_SCOLAIRE" = 2022 THEN COALESCE(eff."PS_F"::integer, 0) + COALESCE(eff."PS_G"::integer, 0) + COALESCE(eff."MS_F"::integer, 0) + COALESCE(eff."MS_G"::integer, 0) + COALESCE(eff."GS_F"::integer, 0) + COALESCE(eff."GS_G"::integer, 0) ELSE 0 END) AS N0_2022,
            SUM(CASE WHEN eff."EXISTE_PRESCO"=1 AND eff."ANNEE_SCOLAIRE" = 2023 THEN COALESCE(eff."PS_F"::integer, 0) + COALESCE(eff."PS_G"::integer, 0) + COALESCE(eff."MS_F"::integer, 0) + COALESCE(eff."MS_G"::integer, 0) + COALESCE(eff."GS_F"::integer, 0) + COALESCE(eff."GS_G"::integer, 0) ELSE 0 END) AS N0_2023,
            SUM(CASE WHEN eff."EXISTE_PRESCO"=1 AND eff."ANNEE_SCOLAIRE" = 2024 THEN COALESCE(eff."PS_F"::integer, 0) + COALESCE(eff."PS_G"::integer, 0) + COALESCE(eff."MS_F"::integer, 0) + COALESCE(eff."MS_G"::integer, 0) + COALESCE(eff."GS_F"::integer, 0) + COALESCE(eff."GS_G"::integer, 0) ELSE 0 END) AS N0_2024,
            SUM(CASE WHEN eff."EXISTE_PRESCO"=1 AND eff."ANNEE_SCOLAIRE" = 2025 THEN COALESCE(eff."PS_F"::integer, 0) + COALESCE(eff."PS_G"::integer, 0) + COALESCE(eff."MS_F"::integer, 0) + COALESCE(eff."MS_G"::integer, 0) + COALESCE(eff."GS_F"::integer, 0) + COALESCE(eff."GS_G"::integer, 0) ELSE 0 END) AS N0_2025,
            SUM(CASE WHEN eff."EXISTE_PRIMAIRE"=1 AND eff."ANNEE_SCOLAIRE" = 2022 THEN (COALESCE(eff."T1_F"::integer, 0) + COALESCE(eff."T1_G"::integer, 0) + COALESCE(eff."T2_F"::integer, 0) + COALESCE(eff."T2_G"::integer, 0) + COALESCE(eff."T3_F"::integer, 0) + COALESCE(eff."T3_G"::integer, 0) + COALESCE(eff."T4_F"::integer, 0) + COALESCE(eff."T4_G"::integer, 0) + COALESCE(eff."T5_F"::integer, 0) + COALESCE(eff."T5_G"::integer, 0)) ELSE 0 END) AS N1_2022,
            SUM(CASE WHEN eff."EXISTE_PRIMAIRE"=1 AND eff."ANNEE_SCOLAIRE" = 2023 THEN (COALESCE(eff."T1_F"::integer, 0) + COALESCE(eff."T1_G"::integer, 0) + COALESCE(eff."T2_F"::integer, 0) + COALESCE(eff."T2_G"::integer, 0) + COALESCE(eff."T3_F"::integer, 0) + COALESCE(eff."T3_G"::integer, 0) + COALESCE(eff."T4_F"::integer, 0) + COALESCE(eff."T4_G"::integer, 0) + COALESCE(eff."T5_F"::integer, 0) + COALESCE(eff."T5_G"::integer, 0)) ELSE 0 END) AS N1_2023,
            SUM(CASE WHEN eff."EXISTE_PRIMAIRE"=1 AND eff."ANNEE_SCOLAIRE" = 2024 THEN (COALESCE(eff."T1_F"::integer, 0) + COALESCE(eff."T1_G"::integer, 0) + COALESCE(eff."T2_F"::integer, 0) + COALESCE(eff."T2_G"::integer, 0) + COALESCE(eff."T3_F"::integer, 0) + COALESCE(eff."T3_G"::integer, 0) + COALESCE(eff."T4_F"::integer, 0) + COALESCE(eff."T4_G"::integer, 0) + COALESCE(eff."T5_F"::integer, 0) + COALESCE(eff."T5_G"::integer, 0)) ELSE 0 END) AS N1_2024,
            SUM(CASE WHEN eff."EXISTE_PRIMAIRE"=1 AND eff."ANNEE_SCOLAIRE" = 2025 THEN (COALESCE(eff."T1_F"::integer, 0) + COALESCE(eff."T1_G"::integer, 0) + COALESCE(eff."T2_F"::integer, 0) + COALESCE(eff."T2_G"::integer, 0) + COALESCE(eff."T3_F"::integer, 0) + COALESCE(eff."T3_G"::integer, 0) + COALESCE(eff."T4_F"::integer, 0) + COALESCE(eff."T4_G"::integer, 0) + COALESCE(eff."T5_F"::integer, 0) + COALESCE(eff."T5_G"::integer, 0)) ELSE 0 END) AS N1_2025
        FROM fpe_e1 eff
        WHERE eff."SECTEUR" {1} {2}
        {3}
        
    """
    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '

    if( not code_dren or code_dren == 0): #nationale, tsy mila aggregation dren sy cisco
        q = q.format('',sect,'','')
    elif (code_dren > 0 and code_cisco == 0): #DREN ihany fa toutes cisco ao anaty DREN choisit
        q = q.format('eff."CODE_DREN", ',sect, f' AND eff."CODE_DREN" = {code_dren} ','GROUP BY eff."CODE_DREN" ')
    else: #Misy DREN sady misy CISCO
         q = q.format('eff."CODE_CISCO", ',sect,f' AND eff."CODE_CISCO" = {code_cisco} ','GROUP BY eff."CODE_CISCO" ')

    return to_dicts_json(q) 



def get_stats_elevesN2N3(request, code_dren,code_cisco,secteur):
    q = """
        SELECT {0}
            SUM(CASE WHEN eff."EXISTE_COLLEGE" = 1 AND eff."ANNEE_SCOLAIRE" = 2022 THEN (
                COALESCE ( eff."T6_F", 0 ) + COALESCE ( eff."T6_G", 0 ) + COALESCE ( eff."T7_F", 0 ) + COALESCE ( eff."T7_G", 0 ) + COALESCE ( eff."T8_F", 0 ) + COALESCE ( eff."T8_G", 0 ) + COALESCE ( eff."T9_F", 0 ) + COALESCE ( eff."T9_G", 0 ) ) ELSE 0 END ) AS N2_2022,
            SUM (CASE WHEN eff."EXISTE_COLLEGE" = 1 AND eff."ANNEE_SCOLAIRE" = 2023 THEN (
                COALESCE ( eff."T6_F", 0 ) + COALESCE ( eff."T6_G", 0 ) + COALESCE ( eff."T7_F", 0 ) + COALESCE ( eff."T7_G", 0 ) + COALESCE ( eff."T8_F", 0 ) + COALESCE ( eff."T8_G", 0 ) + COALESCE ( eff."T9_F", 0 ) + COALESCE ( eff."T9_G", 0 ) ) ELSE 0 END ) AS N2_2023,
            SUM (CASE WHEN eff."EXISTE_COLLEGE" = 1 AND eff."ANNEE_SCOLAIRE" = 2024 THEN (
                COALESCE ( eff."T6_F", 0 ) + COALESCE ( eff."T6_G", 0 ) + COALESCE ( eff."T7_F", 0 ) + COALESCE ( eff."T7_G", 0 ) + COALESCE ( eff."T8_F", 0 ) + COALESCE ( eff."T8_G", 0 ) + COALESCE ( eff."T9_F", 0 ) + COALESCE ( eff."T9_G", 0 ) ) ELSE 0 END ) AS N2_2024,
            SUM (CASE WHEN eff."EXISTE_COLLEGE" = 1 AND eff."ANNEE_SCOLAIRE" = 2025 THEN (
                COALESCE ( eff."T6_F", 0 ) + COALESCE ( eff."T6_G", 0 ) + COALESCE ( eff."T7_F", 0 ) + COALESCE ( eff."T7_G", 0 ) + COALESCE ( eff."T8_F", 0 ) + COALESCE ( eff."T8_G", 0 ) + COALESCE ( eff."T9_F", 0 ) + COALESCE ( eff."T9_G", 0 ) ) ELSE 0 END ) AS N2_2025,
            SUM (CASE WHEN eff."EXISTE_LYCEE" = 1 AND eff."ANNEE_SCOLAIRE" = 2022 THEN (
                COALESCE ( eff."_2NDE_F", 0 ) + COALESCE ( eff."_2NDE_G", 0 ) + COALESCE ( eff."_1A_F", 0 ) + COALESCE ( eff."_1A_G", 0 )+ COALESCE(eff."_1C_F", 0) + COALESCE(eff."_1C_G", 0)+ COALESCE(eff."_1D_F", 0) + COALESCE(eff."_1D_G", 0) + COALESCE(eff."_1L_F", 0) + COALESCE(eff."_1L_G", 0)+ COALESCE(eff."_1S_F", 0) + COALESCE(eff."_1S_G", 0) + COALESCE(eff."_1OSE_F", 0) + COALESCE(eff."_1OSE_G", 0)+ COALESCE ( eff."TA_F", 0 ) + COALESCE ( eff."TA_G", 0 ) + COALESCE ( eff."TC_F", 0 ) + COALESCE ( eff."TC_G", 0 )+ COALESCE ( eff."TD_F", 0 ) + COALESCE ( eff."TD_G", 0 )+ COALESCE ( eff."TS_F", 0 ) + COALESCE ( eff."TS_G", 0 )+ COALESCE ( eff."TOSE_F", 0 ) + COALESCE ( eff."TOSE_G", 0 )) ELSE 0 END ) AS N3_2022,
            SUM (CASE  WHEN eff."EXISTE_LYCEE" = 1 AND eff."ANNEE_SCOLAIRE" = 2023 THEN(
                COALESCE ( eff."_2NDE_F", 0 ) + COALESCE ( eff."_2NDE_G", 0 ) + COALESCE ( eff."_1A_F", 0 ) + COALESCE ( eff."_1A_G", 0 )+ COALESCE(eff."_1C_F", 0) + COALESCE(eff."_1C_G", 0)+ COALESCE(eff."_1D_F", 0) + COALESCE(eff."_1D_G", 0) + COALESCE(eff."_1L_F", 0) + COALESCE(eff."_1L_G", 0)+ COALESCE(eff."_1S_F", 0) + COALESCE(eff."_1S_G", 0) + COALESCE(eff."_1OSE_F", 0) + COALESCE(eff."_1OSE_G", 0)+ COALESCE ( eff."TA_F", 0 ) + COALESCE ( eff."TA_G", 0 ) + COALESCE ( eff."TC_F", 0 ) + COALESCE ( eff."TC_G", 0 )+ COALESCE ( eff."TD_F", 0 ) + COALESCE ( eff."TD_G", 0 )+ COALESCE ( eff."TS_F", 0 ) + COALESCE ( eff."TS_G", 0 )+ COALESCE ( eff."TOSE_F", 0 ) + COALESCE ( eff."TOSE_G", 0 ) ) ELSE 0 END ) AS N3_2023,
            SUM (CASE WHEN eff."EXISTE_LYCEE" = 1 AND eff."ANNEE_SCOLAIRE" = 2024 THEN (
                COALESCE ( eff."_2NDE_F", 0 ) + COALESCE ( eff."_2NDE_G", 0 ) + COALESCE ( eff."_1A_F", 0 ) + COALESCE ( eff."_1A_G", 0 )+ COALESCE(eff."_1C_F", 0) + COALESCE(eff."_1C_G", 0)+ COALESCE(eff."_1D_F", 0) + COALESCE(eff."_1D_G", 0) + COALESCE(eff."_1L_F", 0) + COALESCE(eff."_1L_G", 0)+ COALESCE(eff."_1S_F", 0) + COALESCE(eff."_1S_G", 0) + COALESCE(eff."_1OSE_F", 0) + COALESCE(eff."_1OSE_G", 0)+ COALESCE ( eff."TA_F", 0 ) + COALESCE ( eff."TA_G", 0 ) + COALESCE ( eff."TC_F", 0 ) + COALESCE ( eff."TC_G", 0 )+ COALESCE ( eff."TD_F", 0 ) + COALESCE ( eff."TD_G", 0 )+ COALESCE ( eff."TS_F", 0 ) + COALESCE ( eff."TS_G", 0 )+ COALESCE ( eff."TOSE_F", 0 ) + COALESCE ( eff."TOSE_G", 0 )) ELSE 0 END ) AS N3_2024,
            SUM (CASE WHEN eff."EXISTE_LYCEE" = 1 AND eff."ANNEE_SCOLAIRE" = 2025 THEN(
                COALESCE ( eff."_2NDE_F", 0 ) + COALESCE ( eff."_2NDE_G", 0 ) + COALESCE ( eff."_1A_F", 0 ) + COALESCE ( eff."_1A_G", 0 )+ COALESCE(eff."_1C_F", 0) + COALESCE(eff."_1C_G", 0)+ COALESCE(eff."_1D_F", 0) + COALESCE(eff."_1D_G", 0) + COALESCE(eff."_1L_F", 0) + COALESCE(eff."_1L_G", 0)+ COALESCE(eff."_1S_F", 0) + COALESCE(eff."_1S_G", 0) + COALESCE(eff."_1OSE_F", 0) + COALESCE(eff."_1OSE_G", 0)+ COALESCE ( eff."TA_F", 0 ) + COALESCE ( eff."TA_G", 0 ) + COALESCE ( eff."TC_F", 0 ) + COALESCE ( eff."TC_G", 0 )+ COALESCE ( eff."TD_F", 0 ) + COALESCE ( eff."TD_G", 0 )+ COALESCE ( eff."TS_F", 0 ) + COALESCE ( eff."TS_G", 0 )+ COALESCE ( eff."TOSE_F", 0 ) + COALESCE ( eff."TOSE_G", 0 )
                                                                ) ELSE 0 END ) AS N3_2025 
            FROM fpe_e4 eff WHERE eff."SECTEUR" {1} {2}
        {3}
        
    """
    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '

    if( not code_dren or code_dren == 0): #nationale, tsy mila aggregation dren sy cisco
        q = q.format('',sect,'','')
    elif (code_dren > 0 and code_cisco == 0): #DREN ihany fa toutes cisco ao anaty DREN choisit
        q = q.format('eff."CODE_DREN", ',sect, f' AND eff."CODE_DREN" = {code_dren} ','GROUP BY eff."CODE_DREN" ')
    else: #Misy DREN sady misy CISCO
         q = q.format('eff."CODE_CISCO", ', sect,f' AND eff."CODE_CISCO" = {code_cisco} ','GROUP BY eff."CODE_CISCO" ')

    return to_dicts_json(q) 


# Statistiques des enseignats dans la table P1 selon les colones : EN_SALLE ou NIVEAU_TENU_N
def get_stats_enseignants_en_classe(request, code_dren,code_cisco,secteur):
    q = """

        SELECT 
            {0}
            SUM(CASE WHEN p1."EXISTE_PRESCO"=1 AND p1."NIVEAU_TENU_PRESCO"= '1' AND p1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS N0_2022,
            SUM(CASE WHEN p1."EXISTE_PRESCO"=1 AND p1."NIVEAU_TENU_PRESCO" = '1'  AND p1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS N0_2023,
            SUM(CASE WHEN p1."EXISTE_PRESCO"=1 AND p1."NIVEAU_TENU_PRESCO" = '1'  AND p1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS N0_2024,
            SUM(CASE WHEN p1."EXISTE_PRESCO"=1 AND p1."NIVEAU_TENU_PRESCO" = '1' AND p1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS N0_2025,
            SUM(CASE WHEN p1."EXISTE_PRIMAIRE"=1 AND p1."NIVEAU_TENU_PRIMAIRE" = '1'  AND p1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS N1_2022,
            SUM(CASE WHEN p1."EXISTE_PRIMAIRE"=1 AND p1."NIVEAU_TENU_PRIMAIRE" = '1'  AND p1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS N1_2023,
            SUM(CASE WHEN p1."EXISTE_PRIMAIRE"=1 AND p1."NIVEAU_TENU_PRIMAIRE" = '1'  AND p1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS N1_2024,
            SUM(CASE WHEN p1."EXISTE_PRIMAIRE"=1 AND p1."NIVEAU_TENU_PRIMAIRE" = '1'  AND p1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS N1_2025,
            SUM(CASE WHEN p1."EXISTE_COLLEGE"=1 AND p1."EN_SALLE" = 1  AND p1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS N2_2022,
            SUM(CASE WHEN p1."EXISTE_COLLEGE"=1 AND p1."EN_SALLE" = 1  AND p1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS N2_2023,
            SUM(CASE WHEN p1."EXISTE_COLLEGE"=1 AND p1."EN_SALLE" = 1  AND p1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS N2_2024,
            SUM(CASE WHEN p1."EXISTE_COLLEGE"=1 AND p1."EN_SALLE" = 1  AND p1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS N2_2025,
            SUM(CASE WHEN p1."EXISTE_LYCEE"=1 AND p1."EN_SALLE" = 1  AND p1."ANNEE_SCOLAIRE" = 2022 THEN 1 ELSE 0 END) AS N3_2022,
            SUM(CASE WHEN p1."EXISTE_LYCEE"=1 AND p1."EN_SALLE" = 1  AND p1."ANNEE_SCOLAIRE" = 2023 THEN 1 ELSE 0 END) AS N3_2023,
            SUM(CASE WHEN p1."EXISTE_LYCEE"=1 AND p1."EN_SALLE" = 1  AND p1."ANNEE_SCOLAIRE" = 2024 THEN 1 ELSE 0 END) AS N3_2024,
            SUM(CASE WHEN p1."EXISTE_LYCEE"=1 AND p1."EN_SALLE" = 1  AND p1."ANNEE_SCOLAIRE" = 2025 THEN 1 ELSE 0 END) AS N3_2025
        FROM fpe_p1 p1
        WHERE p1."SECTEUR"  {1} {2} 
        {3}
                
    """
    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '

    if( not code_dren or code_dren == 0): #nationale, tsy mila aggregation dren sy cisco
        q = q.format('',sect ,'','')
    elif (code_dren > 0 and code_cisco == 0): #DREN ihany fa toutes cisco ao anaty DREN choisit
        q = q.format('p1."CODE_DREN", ', sect, f' AND p1."CODE_DREN" = {code_dren} ','GROUP BY p1."CODE_DREN" ')
    else: #Misy DREN sady misy CISCO
         q = q.format('p1."CODE_CISCO", ', sect, f' AND p1."CODE_CISCO" = {code_cisco} ','GROUP BY p1."CODE_CISCO" ')

    return to_dicts_json(q) 


def get_stats_place_assises(request, code_dren,code_cisco, secteur):
    q = """

        SELECT 
            {0}
            SUM(CASE WHEN k1."EXISTE_PRESCO"=1 AND k1."ANNEE_SCOLAIRE" = 2022 THEN (COALESCE(CAST("PRESCO_PETITES_CHAISES_BON_ETAT" AS INTEGER),0)) ELSE 0 END) AS N0_2022,
            SUM(CASE WHEN k1."EXISTE_PRESCO"=1 AND k1."ANNEE_SCOLAIRE" = 2023 THEN (COALESCE(CAST("PRESCO_PETITES_CHAISES_BON_ETAT" AS INTEGER),0)) ELSE 0 END) AS N0_2023,
            SUM(CASE WHEN k1."EXISTE_PRESCO"=1 AND k1."ANNEE_SCOLAIRE" = 2024 THEN (COALESCE(CAST("PRESCO_PETITES_CHAISES_BON_ETAT" AS INTEGER),0)) ELSE 0 END) AS N0_2024,
            SUM(CASE WHEN k1."EXISTE_PRESCO"=1 AND k1."ANNEE_SCOLAIRE" = 2025 THEN (COALESCE(CAST("PRESCO_PETITES_CHAISES_BON_ETAT" AS INTEGER),0)) ELSE 0 END) AS N0_2025,
            SUM(CASE WHEN k1."EXISTE_PRIMAIRE"=1 AND k1."ANNEE_SCOLAIRE" = 2022 THEN (COALESCE(CAST("PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N1_2022,
            SUM(CASE WHEN k1."EXISTE_PRIMAIRE"=1 AND k1."ANNEE_SCOLAIRE" = 2023 THEN (COALESCE(CAST("PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N1_2023,
            SUM(CASE WHEN k1."EXISTE_PRIMAIRE"=1 AND k1."ANNEE_SCOLAIRE" = 2024 THEN (COALESCE(CAST("PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N1_2024,
            SUM(CASE WHEN k1."EXISTE_PRIMAIRE"=1 AND k1."ANNEE_SCOLAIRE" = 2025 THEN (COALESCE(CAST("PRIMAIRE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("PRIMAIRE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N1_2025,
            SUM(CASE WHEN k1."EXISTE_COLLEGE"=1 AND k1."ANNEE_SCOLAIRE" = 2022 THEN (COALESCE(CAST("COLLEGE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("COLLEGE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("COLLEGE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("COLLEGE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("COLLEGE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N2_2022,
            SUM(CASE WHEN k1."EXISTE_COLLEGE"=1 AND k1."ANNEE_SCOLAIRE" = 2023 THEN (COALESCE(CAST("COLLEGE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("COLLEGE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("COLLEGE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("COLLEGE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("COLLEGE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N2_2023,
            SUM(CASE WHEN k1."EXISTE_COLLEGE"=1 AND k1."ANNEE_SCOLAIRE" = 2024 THEN (COALESCE(CAST("COLLEGE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("COLLEGE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("COLLEGE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("COLLEGE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("COLLEGE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N2_2024,
            SUM(CASE WHEN k1."EXISTE_COLLEGE"=1 AND k1."ANNEE_SCOLAIRE" = 2025 THEN (COALESCE(CAST("COLLEGE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("COLLEGE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("COLLEGE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("COLLEGE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("COLLEGE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N2_2025,
            SUM(CASE WHEN k1."EXISTE_LYCEE"=1 AND k1."ANNEE_SCOLAIRE" = 2022 THEN (COALESCE(CAST("LYCEE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("LYCEE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("LYCEE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("LYCEE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("LYCEE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N3_2022,
            SUM(CASE WHEN k1."EXISTE_LYCEE"=1 AND k1."ANNEE_SCOLAIRE" = 2023 THEN (COALESCE(CAST("LYCEE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("LYCEE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("LYCEE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("LYCEE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("LYCEE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N3_2023,
            SUM(CASE WHEN k1."EXISTE_LYCEE"=1 AND k1."ANNEE_SCOLAIRE" = 2024 THEN (COALESCE(CAST("LYCEE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("LYCEE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("LYCEE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("LYCEE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("LYCEE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N3_2024,
            SUM(CASE WHEN k1."EXISTE_LYCEE"=1 AND k1."ANNEE_SCOLAIRE" = 2025 THEN (COALESCE(CAST("LYCEE_TABLES_BANCS_1PL_BON_ETAT" AS INTEGER),0) + COALESCE(CAST("LYCEE_TABLES_BANCS_2PL_BON_ETAT" AS INTEGER),0)*2 + COALESCE(CAST("LYCEE_TABLES_BANCS_3PL_BON_ETAT" AS INTEGER),0)*3 + COALESCE(CAST("LYCEE_TABLES_BANCS_4PL_BON_ETAT" AS INTEGER),0)*4 + COALESCE(CAST("LYCEE_TABLES_BANCS_5PL_PLUS_BON_ETAT" AS INTEGER),0)*5 ) ELSE 0 END) AS N3_2025
            FROM fpe_k1 k1
        WHERE k1."SECTEUR" {1} {2}
        {3}
                
    """
    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '

    if( not code_dren or code_dren == 0): #nationale, tsy mila aggregation dren sy cisco
        q = q.format('',sect,'','')
    elif (code_dren > 0 and code_cisco == 0): #DREN ihany fa toutes cisco ao anaty DREN choisit
        q = q.format('k1."CODE_DREN", ', sect,f' AND k1."CODE_DREN" = {code_dren} ','GROUP BY k1."CODE_DREN" ')
    else: #Misy DREN sady misy CISCO
         q = q.format('k1."CODE_CISCO", ', sect,f' AND k1."CODE_CISCO" = {code_cisco} ','GROUP BY k1."CODE_CISCO" ')

    return to_dicts_json(q) 