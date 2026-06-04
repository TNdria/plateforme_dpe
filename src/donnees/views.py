from django.shortcuts import render 
from django.db import connection
from django.http import JsonResponse
from django.http import HttpResponse
import json
import logging
from django.contrib.auth.decorators import login_required
import csv
from referentiel.views import get_dren

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


#@login_required
def index_prescolaire(request):
    drens = get_dren()
    return render(request,template_name="donnees_presco.html", context={"dren":drens})

#@login_required
def index_primaire(request):
    drens = get_dren()
    return render(request,template_name="donnees_primaire.html", context={"dren":drens})

#@login_required
def index_college(request):
    drens = get_dren()
    return render(request,template_name="donnees_college.html", context={"dren":drens})

#@login_required
def index_lycee(request):
    drens = get_dren()
    return render(request,template_name="donnees_lycee.html", context={"dren":drens})

def to_dicts_json(query):
    with connection.cursor() as cursor:
        cursor.execute(query)
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    
    res = [dict(zip(columns, row)) for row in rows]
    return JsonResponse(res, safe=False)



def queryset_to_csv(query, filename='queryset.csv'):
    with connection.cursor() as cursor:
        cursor.execute(query)
        columns = [col[0].upper() for col in cursor.description]
        queryset = cursor.fetchall()

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    # Écrire les en-têtes
    writer.writerow(columns) 
    # Écrire les données
    for obj in queryset:
        writer.writerow(obj)
    return response



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


def get_zap(request, code_dren,code_cisco,code_commune):
    q = """ SELECT * FROM v_zap WHERE "CODE_DREN" {0} {1} AND "CODE_CISCO" {2} {3} AND "CODE_COMMUNE" {4} {5} ORDER BY "ZAP" """
    #condition DREN:
    if( not code_dren or code_dren == 0):
        op_dren = ">"
        val_dren = 0
    else:
        op_dren = "="
        val_dren = code_dren
    #condition CISCO:
    if( not code_cisco or code_cisco == 0):
        op_cisco = ">"
        val_cisco = 0
    else:
        op_cisco = "="
        val_cisco = code_cisco
    #condition COMMUNE:
    if( not code_commune or code_commune == 0):
        op_commune = ">"
        val_commune = 0
    else:
        op_commune = "="
        val_commune = code_commune

    q = q.format(op_dren,val_dren,op_cisco,val_cisco,op_commune,val_commune)
    return to_dicts_json(q) 


def get_commune(request,  code_dren,code_cisco,code_zap):
    q = """ SELECT * FROM v_commune WHERE "CODE_DREN" {0} {1} AND "CODE_CISCO" {2} {3} AND "CODE_ZAP" {4} {5}  ORDER BY "COMMUNE" """
    #condition DREN:
    if( not code_dren or code_dren == 0):
        op_dren = ">"
        val_dren = 0
    else:
        op_dren = "="
        val_dren = code_dren
    #condition CISCO:
    if( not code_cisco or code_cisco == 0):
        op_cisco = ">"
        val_cisco = 0
    else:
        op_cisco = "="
        val_cisco = code_cisco
    #condition ZAP:
    if( not code_zap or code_zap == 0):
        op_zap = ">"
        val_zap = 0
    else:
        op_zap = "="
        val_zap = code_zap

    q = q.format(op_dren,val_dren,op_cisco,val_cisco,op_zap,val_zap)
    return to_dicts_json(q)

"""
    Obtenir les etablissements dans une DREN et CISCO et transformer les données en json via la functio  to_dicts_json
    example de retour : 
    [
        {"CODE_ETAB": 516020001, "NOM_ETAB": "CEG AMBAHOABE", "CODE_CISCO": 516, "CODE_DREN": 52, "latitude": -16.78040983, "longitude": 49.51622616},
        ...
    ]
"""

""" ovtenir layer pour les ecoles primaires publiques et privées à partir de la view """
def get_etablissements(request, code_dren,code_cisco,code_commune,code_zap,niveau,secteur):
    q = """ SELECT a1."CODE_ETAB",a1."DREN",CASE WHEN (a1."SECTEUR"=0) THEN 'PUBLIC' ELSE 'PRIVE' END AS secteur,a1."DREN",a1."CISCO",
            a1."COMMUNE",a1."ZAP",a1."FOKONTANY",a1."CATEGORIE_COMMUNE",a1."NOM_ETAB" FROM fpe_a1  a1
            WHERE "CODE_DREN" {0} {1} AND "CODE_CISCO" {2} {3} AND "CODE_COMMUNE" {4} {5} AND "CODE_ZAP" {6} {7} 
            AND {8} = 1 AND "SECTEUR" = {9} AND "ANNEE_SCOLAIRE" = 2025 """
    #condition DREN:
    if( not code_dren or code_dren == 0):
        op_dren = ">"
        val_dren = 0
    else:
        op_dren = "="
        val_dren = code_dren
    #condition CISCO:
    if( not code_cisco or code_cisco == 0):
        op_cisco = ">"
        val_cisco = 0
    else:
        op_cisco = "="
        val_cisco = code_cisco

    #condition COMMUNE:
    if( not code_commune or code_commune == 0):
        op_commune = ">"
        val_commune = 0
    else:
        op_commune = "="
        val_commune = code_commune

    #condition ZAP:
    if( not code_zap or code_zap == 0):
        op_zap = ">"
        val_zap = 0
    else:
        op_zap = "="
        val_zap = code_zap

    if(niveau == 0):
        exist_niveau = '"EXISTE_PRESCO"'
    elif(niveau == 1):
        exist_niveau = '"EXISTE_PRIMAIRE"'
    elif(niveau == 2):
        exist_niveau = '"EXISTE_COLLEGE"'
    else:
        exist_niveau = '"EXISTE_LYCEE"'

    q = q.format(op_dren,val_dren,op_cisco,val_cisco,op_commune,val_commune,op_zap,val_zap,exist_niveau,secteur)
    return to_dicts_json(q)


""" ovtenir layer pour les ecoles primaires publiques et privées à partir de la view """
def get_etabN0(request, code_dren,code_cisco,code_commune,code_zap,secteur):
    q = """ SELECT vf.*,v.eff_ps,v.eff_ms,v.eff_gs FROM v_fiche_ecole_n0 vf
            INNER JOIN v_effectif_n0 v ON v."CODE_ETAB" = vf."CODE_ETAB"
            WHERE vf."CODE_DREN" {0} {1} AND vf."CODE_CISCO" {2} {3} AND vf."CODE_COMMUNE" {4} {5} AND vf."CODE_ZAP" {6} {7} 
            AND vf."SECTEUR" {8} AND vf."ANNEE_SCOLAIRE" = 2025 AND v."ANNEE_SCOLAIRE" = 2025 """
    #condition DREN:
    if( not code_dren or code_dren == 0):
        op_dren = ">"
        val_dren = 0
    else:
        op_dren = "="
        val_dren = code_dren
    #condition CISCO:
    if( not code_cisco or code_cisco == 0):
        op_cisco = ">"
        val_cisco = 0
    else:
        op_cisco = "="
        val_cisco = code_cisco

    #condition COMMUNE:
    if( not code_commune or code_commune == 0):
        op_commune = ">"
        val_commune = 0
    else:
        op_commune = "="
        val_commune = code_commune

    #condition ZAP:
    if( not code_zap or code_zap == 0):
        op_zap = ">"
        val_zap = 0
    else:
        op_zap = "="
        val_zap = code_zap

    #SECTEUR
    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '

    q = q.format(op_dren,val_dren,op_cisco,val_cisco,op_commune,val_commune,op_zap,val_zap,sect)
    return to_dicts_json(q)


def get_etabN1(request, code_dren,code_cisco,code_commune,code_zap,secteur):
    q = """ SELECT vf.*,v.eff_t1,v.eff_t2,v.eff_t3,v.eff_t4,v.eff_t5 FROM v_fiche_ecole_n1 vf
            INNER JOIN v_effectif_n1 v ON v."CODE_ETAB" = vf."CODE_ETAB"
            WHERE vf."CODE_DREN" {0} {1} AND vf."CODE_CISCO" {2} {3} AND vf."CODE_COMMUNE" {4} {5} AND vf."CODE_ZAP" {6} {7} 
            AND vf."SECTEUR" {8} AND vf."ANNEE_SCOLAIRE" = 2025 AND v."ANNEE_SCOLAIRE" = 2025 """
    #condition DREN:
    if( not code_dren or code_dren == 0):
        op_dren = ">"
        val_dren = 0
    else:
        op_dren = "="
        val_dren = code_dren
    #condition CISCO:
    if( not code_cisco or code_cisco == 0):
        op_cisco = ">"
        val_cisco = 0
    else:
        op_cisco = "="
        val_cisco = code_cisco

    #condition COMMUNE:
    if( not code_commune or code_commune == 0):
        op_commune = ">"
        val_commune = 0
    else:
        op_commune = "="
        val_commune = code_commune

    #condition ZAP:
    if( not code_zap or code_zap == 0):
        op_zap = ">"
        val_zap = 0
    else:
        op_zap = "="
        val_zap = code_zap

    #SECTEUR
    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '
        
    q = q.format(op_dren,val_dren,op_cisco,val_cisco,op_commune,val_commune,op_zap,val_zap,sect)
    return to_dicts_json(q)

""" obtenir layer pour les colleges publiques  à partir de la view """
def get_etabN2(request, code_dren,code_cisco,code_commune,code_zap,secteur):
    q = """ SELECT vf.*,v.eff_t6,v.eff_t7,v.eff_t8,v.eff_t9 FROM v_fiche_ecole_n2 vf
            INNER JOIN v_effectif_n2 v ON v."CODE_ETAB" = vf."CODE_ETAB"
            WHERE vf."CODE_DREN" {0} {1} AND vf."CODE_CISCO" {2} {3} AND vf."CODE_COMMUNE" {4} {5} AND vf."CODE_ZAP" {6} {7} 
            AND vf."SECTEUR" {8} AND vf."ANNEE_SCOLAIRE" = 2025 AND v."ANNEE_SCOLAIRE" = 2025 """

    #condition DREN:
    if( not code_dren or code_dren == 0):
        op_dren = ">"
        val_dren = 0
    else:
        op_dren = "="
        val_dren = code_dren
    #condition CISCO:
    if( not code_cisco or code_cisco == 0):
        op_cisco = ">"
        val_cisco = 0
    else:
        op_cisco = "="
        val_cisco = code_cisco

    #condition COMMUNE:
    if( not code_commune or code_commune == 0):
        op_commune = ">"
        val_commune = 0
    else:
        op_commune = "="
        val_commune = code_commune

    #condition ZAP:
    if( not code_zap or code_zap == 0):
        op_zap = ">"
        val_zap = 0
    else:
        op_zap = "="
        val_zap = code_zap

    #SECTEUR
    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '
        
    q = q.format(op_dren,val_dren,op_cisco,val_cisco,op_commune,val_commune,op_zap,val_zap,sect)
    return to_dicts_json(q)


""" obtenir layer pour les colleges publiques  à partir de la view """
def get_etabN3(request, code_dren,code_cisco,code_commune,code_zap,secteur):
    q = """ SELECT vf.*,v._2nde,v._1re,v.tle FROM v_fiche_ecole_n3 vf
            INNER JOIN v_effectif_n3 v ON v."CODE_ETAB" = vf."CODE_ETAB"
            WHERE vf."CODE_DREN" {0} {1} AND vf."CODE_CISCO" {2} {3} AND vf."CODE_COMMUNE" {4} {5} AND vf."CODE_ZAP" {6} {7} 
            AND vf."SECTEUR" {8} AND vf."ANNEE_SCOLAIRE" = 2025 AND v."ANNEE_SCOLAIRE" = 2025 """
    #condition DREN:
    if( not code_dren or code_dren == 0):
        op_dren = ">"
        val_dren = 0
    else:
        op_dren = "="
        val_dren = code_dren
    #condition CISCO:
    if( not code_cisco or code_cisco == 0):
        op_cisco = ">"
        val_cisco = 0
    else:
        op_cisco = "="
        val_cisco = code_cisco

    #condition COMMUNE:
    if( not code_commune or code_commune == 0):
        op_commune = ">"
        val_commune = 0
    else:
        op_commune = "="
        val_commune = code_commune

    #condition ZAP:
    if( not code_zap or code_zap == 0):
        op_zap = ">"
        val_zap = 0
    else:
        op_zap = "="
        val_zap = code_zap

    #SECTEUR
    if (secteur > 1):
        sect = '>= 0'
    else :
        sect = f'={secteur} '
        
    q = q.format(op_dren,val_dren,op_cisco,val_cisco,op_commune,val_commune,op_zap,val_zap,sect)
    return to_dicts_json(q)
