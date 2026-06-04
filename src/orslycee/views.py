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


@login_required
def index(request):
    drens = get_dren()
    return render(request,template_name="orslycee.html", context={"dren":drens})


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


"""
    Obtenir les etablissements dans une DREN et CISCO et transformer les données en json via la functio  to_dicts_json
    example de retour : 
    [
        {"CODE_ETAB": 516020001, "NOM_ETAB": "CEG AMBAHOABE", "CODE_CISCO": 516, "CODE_DREN": 52, "latitude": -16.78040983, "longitude": 49.51622616},
        ...
    ]
"""

def get_layer_etabN2(request,code_dren,code_cisco):
    q = """ SELECT * FROM v_layer_n2 {0} {1} """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)

    res = to_dicts_json(q)
    return res

def get_layer_etabN3(request,code_dren,code_cisco):
    q = """ SELECT * FROM v_layer_n3 {0} {1} """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)

    res = to_dicts_json(q)
    return res

"""
    Obtenir les Villages dans une DREN et CISCO et transformer les données en json via la functio  to_dicts_json
    example de retour : 
    [
        {"name": "AMBAHAVALA", "population": 0}, 
        {"name": "AMBAHIKARABO", "population": 0}, 
        ...
    ]
"""
def get_layer_village(request,code_dren,code_cisco):
    q = """ SELECT name,dren as code_dren, cisco as code_cisco, population, longitude,latitude FROM sig_village {0} {1}  ORDER BY name """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(' WHERE dren = ', code_dren)
    else:
        q = q.format(' WHERE cisco = ', code_cisco)
    res = to_dicts_json(q)
    return res

def get_layer_dren(request,code_dren):
    q = """
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'name', r."REGION_NAM",
                            'code', r."CODE_DREN"
                        ),
                        'geometry', ST_AsGeoJSON(r.geom)::json
                    )
                )
            ) AS shape
            FROM shape_dren r
            WHERE CAST(r."CODE_DREN" AS INTEGER) = {0}
        """.format(code_dren)
    res = to_dicts_json(q)
    return res

def get_layer_cisco(request,code_dren,code_cisco):
    q = """
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'name', r.cisco,
                            'code', r."CODE_CISCO"
                        ),
                        'geometry', ST_AsGeoJSON(r.geom)::json
                    )
                )
            ) AS shape
            FROM shape_cisco r
            {0} {1}
        """
    if(code_cisco == 0):
        q = q.format('WHERE CAST(r."CODE_DREN" AS INTEGER) = ',code_dren)
    else:
        q=q.format('WHERE CAST(r."CODE_CISCO" AS INTEGER) =',code_cisco)
    res = to_dicts_json(q)
    return res

def get_layer_commune(request,code_dren,code_cisco):
    q = """
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'name', r.commune_na,
                            'code', r.code_commune
                        ),
                        'geometry', ST_AsGeoJSON(r.geom)::json
                    )
                )
            ) AS shape
            FROM shape_commune r
            {0} {1}
        """
    if(code_cisco ==0):
        q = q.format('WHERE CAST(r.code_dren AS INTEGER) = ',code_dren)
    else:
        q=q.format('WHERE CAST(r.code_cisco AS INTEGER) =',code_cisco)
    res = to_dicts_json(q)
    return res


def get_layer_fokontany(request,code_dren,code_cisco):
    q = """
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'name', r."FOKONTANY_",
                            'code_dren', r.dren,
                            'code_cisco',r.cisco
                        ),
                        'geometry', ST_AsGeoJSON(r.geom)::json
                    )
                )
            ) AS shape
            FROM shape_fokontany r
            {0} {1}
        """
    if(code_cisco ==0):
        q = q.format('WHERE CAST(r.dren AS INTEGER) = ',code_dren)
    else:
        q=q.format('WHERE CAST(r.cisco AS INTEGER) =',code_cisco)
    res = to_dicts_json(q)
    return res

#recuperer layer des etablissement n3S0
def get_layers_besoins_n3(request,code_dren,code_cisco):
    q = """ SELECT * FROM v_layer_besoins_n3 {0} {1} """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(' WHERE "CODE_CISCO" = ', code_cisco)

    res = to_dicts_json(q)
    return res

#recuperer layer des etablissement n3S0
def download_besoins_n3(request,code_dren,code_cisco):
    q = """ SELECT  
                vb."NOM_ETAB",
                vb."CODE_ETAB",
                vb."ANNEE_SCOLAIRE",
                vb."CODE_DREN",
                vb."CODE_CISCO",
                CAST(vb.effectifs AS INTEGER),
                CAST(vb.sdc_be AS INTEGER),
                CAST(vb.sdc_me AS INTEGER),
                CAST(vb.sdc_be + vb.sdc_me AS INTEGER) AS TOTAL_SALLE,
                CASE WHEN (vb.eligible_reconstruction > 0)  THEN 'OUI' ELSE 'NON' END AS ELIGIBLE_RECONSTRUCTION,
                CASE WHEN (vb.eligible_rehabilitation > 0)  THEN 'OUI' ELSE 'NON' END AS ELIGIBLE_REHABILITATION,
                CAST(vb.sdc_requis AS INTEGER),
                CASE WHEN ((vb.sdc_requis - (vb.sdc_be + vb.sdc_me)) > 0)  THEN CAST(vb.sdc_requis AS INTEGER) ELSE 0 END AS ELIGIBLE_EXTENSION,
                CAST(vb.places AS INTEGER) PLACES_DISPONIBLES,
                CASE WHEN (vb.effectifs < vb.places) THEN 0 ELSE ROUND((vb.effectifs - vb.places) / 2, 0) END AS BESOIN_TABLE_2_PLACES
             FROM v_layer_besoins_n3 vb {0} {1} """
    cd = ""
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(' WHERE "CODE_DREN" = ', code_dren)
        cd = "dren_" + str(code_dren)
    else:
        q = q.format(' WHERE "CODE_CISCO" = ', code_cisco)
        cd = "cisco_" + str(code_cisco)

    res = queryset_to_csv(q, f"donnees_ors_lycee_{cd}")
    return res

#obtenir la couche nouvelle creation depuis le la view materialize v_layer_ncn3
def get_nc(request):
    q = """ SELECT * FROM v_layer_ncn3 """
    res = to_dicts_json(q)
    return res

def get_layer_villages(request,code_dren,code_cisco):
    q = """ WITH cte AS (
        SELECT v.name AS nom,
            v.cisco AS code_cisco,
            v.dren AS code_dren,
            v.population,
            v.latitude,
            v.longitude,
            v.geom
        FROM villages_exclus_ncn3 v
        {0} {1}
        )
 SELECT json_build_object('type', 'FeatureCollection', 'features', json_agg(json_build_object('type', 'Feature', 'properties', json_build_object('name', nom, 'code_dren', code_dren, 'code_cisco', code_cisco, 'population', population, 'latitude', latitude, 'longitude', longitude), 'geometry', (st_asgeojson(geom))::json))) AS shape
   FROM cte  """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(' WHERE v.dren = ', code_dren)
    else:
        q = q.format(' WHERE v.cisco = ', code_cisco)
    res = to_dicts_json(q)
    return res