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
def index(request):
    drens = get_dren()
    return render(request,template_name="dataviz.html", context={"dren":drens})


"""
    Convertir resultat de la requette en parametre vers json
    example de retour : 
    [
        {"CODE_ETAB": 516020001, "NOM_ETAB": "CEG AMBAHOABE", "CODE_CISCO": 516, "CODE_DREN": 52, "latitude": -16.78040983, "longitude": 49.51622616},
        ...
    ]
"""

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


"""
    Obtenir tous les etablissements Nationale et transformer les données en json via la function  to_dicts_json
    example de retour : 
    [
        {"CODE_ETAB": 516020001, "NOM_ETAB": "CEG AMBAHOABE", "CODE_CISCO": 516, "CODE_DREN": 52, "latitude": -16.78040983, "longitude": 49.51622616},
        ...
    ]
"""
def layer_heatmap_eta_n0(request):
    q = """ SELECT * FROM v_heatmap  WHERE "SECTEUR" = 0 AND "EXISTE_PRESCO" = 1 """
    res = to_dicts_json(q)
    return res

def layer_heatmap_eta_n1(request):
    q = """ SELECT * FROM v_heatmap  WHERE "SECTEUR" = 0 AND "EXISTE_PRIMAIRE" = 1 """
    res = to_dicts_json(q)
    return res

def layer_heatmap_eta_n2(request):
    q = """ SELECT * FROM v_heatmap  WHERE "SECTEUR" = 0 AND "EXISTE_COLLEGE" = 1 """
    res = to_dicts_json(q)
    return res

def layer_heatmap_eta_n3(request):
    q = """ SELECT * FROM v_heatmap  WHERE "SECTEUR" = 0 AND "EXISTE_LYCEE" = 1 """
    res = to_dicts_json(q)
    return res


""" Obtenir couche DREN à partir de la table shape_dren de postgis """
def get_layer_dren(request):
    q = """
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'NAME', r."REGION_NAM",
                            'CODE', r."CODE_DREN"
                        ),
                        'geometry', ST_AsGeoJSON(r.geom)::json
                    )
                )
            ) AS shape
            FROM shape_dren r
            WHERE CAST(r."CODE_DREN" AS INTEGER) > {0}
        """.format(0)
    res = to_dicts_json(q)
    return res

""" Obtenir couche CISCO à partir de la table shape_cisco de postgis """

def get_layer_cisco(request):
    q = """
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'NAME', r.cisco,
                            'CODE', r."CODE_CISCO"
                        ),
                        'geometry', ST_AsGeoJSON(r.geom)::json
                    )
                )
            ) AS shape
            FROM shape_cisco r
        """
    res = to_dicts_json(q)
    return res

def get_layer_commune(request, code):
    q = """
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'properties', json_build_object(
                            'NAME', r.commune_na,
                            'CODE', r.code_commune
                        ),
                        'geometry', ST_AsGeoJSON(r.geom)::json
                    )
                )
            ) AS shape
            FROM shape_commune r
           {0} {1}
        """
    if (code < 70):
        q = q.format(' WHERE  CAST(r.code_dren AS INTEGER)  = ', code)
    else :
        q = q.format(' WHERE CAST(r.code_cisco AS INTEGER) = ', code)

    res = to_dicts_json(q)
    return res

def parse_niveau(request, niveau=None):
    if niveau is None:
        niveau = request.GET.get('niveau', '1')
    try:
        niveau = int(niveau)
    except (TypeError, ValueError):
        niveau = 1
    if niveau not in (1, 2, 3):
        niveau = 1
    return niveau


def get_data_dren(request, niveau=None):
    niveau = parse_niveau(request, niveau)
    q = f"SELECT * FROM v_ct_n{niveau}_dren"
    res = to_dicts_json(q)
    return res


def get_data_cisco(request, niveau=None):
    niveau = parse_niveau(request, niveau)
    q = f"SELECT * FROM v_ct_n{niveau}_cisco"
    res = to_dicts_json(q)
    return res


def get_data_commune(request, code, niveau=None):
    niveau = parse_niveau(request, niveau)
    q = f"SELECT * FROM v_ct_n{niveau}_commune"
    if code < 70:
        q += f' WHERE "CODE_DREN" = {code}'
    else:
        q += f' WHERE "CODE_CISCO" = {code}'

    res = to_dicts_json(q)
    return res


# obtenir les donnees des ecoles
def get_data_etab(request, code, niveau=None):
    niveau = parse_niveau(request, niveau)
    q = f"SELECT * FROM v_ct_n{niveau}_ecole"
    if code < 70:
        q += f' WHERE "CODE_DREN" = {code}'
    else:
        q += f' WHERE "CODE_CISCO" = {code}'

    res = to_dicts_json(q)
    return res