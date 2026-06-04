from django.shortcuts import render 
from django.db import connection
from django.http import JsonResponse
from referentiel.views import get_dren
import json
import logging
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@login_required
def index(request):
    drens = get_dren()
    return render(request,template_name="sig.html", context={"dren":drens})

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
    Obtenir les etablissements dans une DREN et CISCO et transformer les données en json via la functio  to_dicts_json
    example de retour : 
    [
        {"CODE_ETAB": 516020001, "NOM_ETAB": "CEG AMBAHOABE", "CODE_CISCO": 516, "CODE_DREN": 52, "latitude": -16.78040983, "longitude": 49.51622616},
        ...
    ]
"""
def get_layer_etabN0(request,code_dren,code_cisco):
    q = """ SELECT * FROM v_fiche_ecole_n0 {0} {1} """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)

    res = to_dicts_json(q)
    return res

def get_layer_etabN1(request,code_dren,code_cisco):
    q = """ SELECT * FROM v_fiche_ecole_n1 {0} {1} """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)

    res = to_dicts_json(q)
    return res

def get_layer_etabN2(request,code_dren,code_cisco):
    q = """ SELECT * FROM v_fiche_ecole_n2 {0} {1} """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)

    res = to_dicts_json(q)
    return res

def get_layer_etabN3(request,code_dren,code_cisco):
    q = """ SELECT * FROM v_fiche_ecole_n3 {0} {1} """
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
    q = """ SELECT id, name,dren as code_dren,cisco as code_cisco,longitude,latitude FROM sig_village {0} {1} ORDER BY name """
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

def get_layer_etab_non_geolocalise(request,code_dren,code_cisco):
    q = """ SELECT v.* FROM v_etablissement_non_geolocalise v {0} {1} """
    if (code_dren > 0 and code_cisco == 0):
        q = q.format(f' WHERE v."CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE v."CODE_CISCO" = ', code_cisco)

    res = to_dicts_json(q)
    return res

@csrf_exempt
def geolocaliserEtablissement(request):
    if request.method == "POST":
        code_etab = request.POST.get('code_etab')
        longitude = float(request.POST.get('longitude'))
        latitude = float(request.POST.get('latitude'))
        q =  f""" INSERT INTO sig_etablissement (id, code, longitude, latitude,is_valid) 
                  VALUES ((SELECT MAX(id) FROM sig_etablissement) + 1, {code_etab}, {longitude}, {latitude}, 0)
            """
        #logger.debug(q)
        #return
        try:
            with connection.cursor() as cursor:
                cursor.execute(q)
                connection.commit()
            # Retourner une réponse JSON
            res = {'status': 'success', 'message': "Ajout de l'établissement effectué avec succès !"}
            return JsonResponse(res, safe=False)
        except Exception as err:
            res = {'status': 'failed', 'message':f"{err}.\n, veuillez réessayer ou contacter l'administrateur"}
            return JsonResponse(res, safe=False)
        
@csrf_exempt
def updatePositionEtablissement(request):
    if request.method == "POST":
        code_etab = request.POST.get('code_etab')
        longitude = request.POST.get('longitude')
        latitude = request.POST.get('latitude')
        q =  f""" UPDATE sig_etablissement SET longitude={longitude},latitude={latitude} WHERE code = {code_etab} """
        try:
            with connection.cursor() as cursor:
                cursor.execute(q)
                connection.commit()
            # Retourner une réponse JSON
            res = {'status': 'success', 'message': "Déplacement de l'établissement effectué avec succès !"}
            return JsonResponse(res, safe=False)
        except Exception as err:
            res = {'status': 'failed', 'message':f"{err}.\n, veuillez réessayer ou contacter l'administrateur"}
            return JsonResponse(res, safe=False)


@csrf_exempt
def geolocaliserVillage(request):
    if request.method == "POST":
        name = request.POST.get('name')
        cisco = request.POST.get('cisco')
        dren = request.POST.get('dren')
        population = request.POST.get('population')
        airtel = request.POST.get('airtel')
        orange = request.POST.get('orange')
        telma = request.POST.get('telma')
        elec = request.POST.get('elec')
        eau = request.POST.get('eau')
        longitude = float(request.POST.get('longitude'))
        latitude = float(request.POST.get('latitude'))
        if len(name)<4 or int(population) < 10 or float(longitude) == 0 :
            res = {'status': 'failed', 'message':f"Veuillez vérifier les informations (NOM,POPULATION,COORDONNEES, etc...).\n,Si le problème persiste, veuillez contacter l'administrateur."}
            return JsonResponse(res, safe=False)
        
        q =  f""" INSERT INTO sig_village (id,name,dren,cisco,population,is_airtel,is_orange,is_telma,is_elec,is_eau,latitude,longitude) 
                VALUES ((SELECT MAX(id) FROM sig_village) + 1,'{name.upper()}',{dren},{cisco},{population},{airtel},{orange},{telma},{elec},{eau}, {latitude}, {longitude})
            """
        #logger.debug(q)
        #return
        try:
            with connection.cursor() as cursor:
                cursor.execute(q)
                connection.commit()
            # Retourner une réponse JSON
            res = {'status': 'success', 'message': f"Ajout du village {name} effectué avec succès !"}
            return JsonResponse(res, safe=False)
        except Exception as err:
            res = {'status': 'failed', 'message':f"{err}.\n, veuillez réessayer ou contacter l'administrateur"}
            return JsonResponse(res, safe=False)
        

@csrf_exempt
def updatePositionVillage(request):
    if request.method == "POST":
        id = request.POST.get('id')
        longitude = request.POST.get('longitude')
        latitude = request.POST.get('latitude')
        q =  f""" UPDATE sig_village SET longitude={longitude},latitude={latitude} WHERE id = {id} """
        try:
            with connection.cursor() as cursor:
                cursor.execute(q)
                connection.commit()
            # Retourner une réponse JSON
            res = {'status': 'success', 'message': "Déplacement du Village effectué avec succès !"}
            return JsonResponse(res, safe=False)
        except Exception as err:
            res = {'status': 'failed', 'message':f"{err}.\n, veuillez réessayer ou contacter l'administrateur"}
            return JsonResponse(res, safe=False)