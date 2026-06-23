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
    return render(request, template_name="sig.html", context={"dren": drens})


def to_dicts_json(query, params=None):
    with connection.cursor() as cursor:
        cursor.execute(query, params or [])
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()

    return JsonResponse(
        [dict(zip(columns, row)) for row in rows],
        safe=False
    )


def get_dren(request):
    with connection.cursor() as cursor:
        cursor.execute('SELECT * FROM v_dren ORDER BY "DREN"')
        rows = cursor.fetchall()

    drens = [
        {
            'CODE_DREN': row[0],
            'DREN': row[1]
        }
        for row in rows
    ]

    return JsonResponse(drens, safe=False)


def get_cisco(request, code_dren):
    q = """ SELECT * FROM v_cisco {0} {1} ORDER BY "CISCO" """
    if not code_dren or code_dren == 0:
        q = q.format(' WHERE "CODE_DREN" ', ' > 0')
    else:
        q = q.format('WHERE "CODE_DREN" = ', code_dren)
    return to_dicts_json(q)


def get_layer_etabN0(request, code_dren, code_cisco):
    q = """ SELECT * FROM v_fiche_ecole_n0 {0} {1} """
    if code_dren > 0 and code_cisco == 0:
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)
    return to_dicts_json(q)


def get_layer_etabN1(request, code_dren, code_cisco):
    q = """ SELECT * FROM v_fiche_ecole_n1 {0} {1} """
    if code_dren > 0 and code_cisco == 0:
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)
    return to_dicts_json(q)


def get_layer_etabN2(request, code_dren, code_cisco):
    q = """ SELECT * FROM v_fiche_ecole_n2 {0} {1} """
    if code_dren > 0 and code_cisco == 0:
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)
    return to_dicts_json(q)


def get_layer_etabN3(request, code_dren, code_cisco):
    q = """ SELECT * FROM v_fiche_ecole_n3 {0} {1} """
    if code_dren > 0 and code_cisco == 0:
        q = q.format(f' WHERE "CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE "CODE_CISCO" = ', code_cisco)
    return to_dicts_json(q)


def get_layer_village(request, code_dren, code_cisco):
    q = """ SELECT id, name, dren as code_dren, cisco as code_cisco, longitude, latitude FROM sig_village {0} {1} ORDER BY name """
    if code_dren > 0 and code_cisco == 0:
        q = q.format(' WHERE dren = ', code_dren)
    else:
        q = q.format(' WHERE cisco = ', code_cisco)
    return to_dicts_json(q)


def get_layer_dren(request, code_dren):
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
                    'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json
                )
            )
        ) AS shape
        FROM shape_dren r
        WHERE CAST(r."CODE_DREN" AS INTEGER) = {0}
    """.format(code_dren)
    return to_dicts_json(q)


def get_layer_cisco(request, code_dren, code_cisco):
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
                    'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json
                )
            )
        ) AS shape
        FROM shape_cisco r
        {0} {1}
    """
    if code_cisco == 0:
        q = q.format('WHERE CAST(r."CODE_DREN" AS INTEGER) = ', code_dren)
    else:
        q = q.format('WHERE CAST(r."CODE_CISCO" AS INTEGER) =', code_cisco)
    return to_dicts_json(q)


def get_layer_commune(request, code_dren, code_cisco):
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
                    'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json
                )
            )
        ) AS shape
        FROM shape_commune r
        {0} {1}
    """
    if code_cisco == 0:
        q = q.format('WHERE CAST(r.code_dren AS INTEGER) = ', code_dren)
    else:
        q = q.format('WHERE CAST(r.code_cisco AS INTEGER) =', code_cisco)
    return to_dicts_json(q)


def get_layer_fokontany(request, code_dren, code_cisco):
    q = """
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', json_agg(
                json_build_object(
                    'type', 'Feature',
                    'properties', json_build_object(
                        'name', r."FOKONTANY_",
                        'code_dren', r.dren,
                        'code_cisco', r.cisco
                    ),
                    'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.001))::json
                )
            )
        ) AS shape
        FROM shape_fokontany r
        {0} {1}
    """
    if code_cisco == 0:
        q = q.format('WHERE CAST(r.dren AS INTEGER) = ', code_dren)
    else:
        q = q.format('WHERE CAST(r.cisco AS INTEGER) =', code_cisco)
    return to_dicts_json(q)


def get_layer_etab_non_geolocalise(request, code_dren, code_cisco):
    q = """ SELECT v.* FROM v_etablissement_non_geolocalise v {0} {1} """
    if code_dren > 0 and code_cisco == 0:
        q = q.format(f' WHERE v."CODE_DREN" = ', code_dren)
    else:
        q = q.format(f' WHERE v."CODE_CISCO" = ', code_cisco)
    return to_dicts_json(q)

# ============================================================
# SIG CONFIG — getConfig / checkFeature / updateConfig
# ============================================================

def get_tables_bancs(request):
    niveau = request.GET.get("niveau", "0")
    print("NIVEAU RECU =", niveau)
    code_dren = request.GET.get("code_dren")
    code_cisco = request.GET.get("code_cisco")
    code_etab = request.GET.get("code_etab")

    mapping = {
        "0": "v_tables_bancs_n0",
        "1": "v_tables_bancs_n1",
        "2": "v_tables_bancs_n2",
        "3": "v_tables_bancs_n3",
    }

    table = mapping.get(str(niveau))
    print("TABLE =", table)
    if not table:
        return JsonResponse({"error": "niveau invalide"}, status=400)

    # 🚨 validation stricte
    if not code_etab or code_etab in ["undefined", "null", ""]:
        return JsonResponse({"error": "code_etab manquant"}, status=400)

    q = f'SELECT * FROM {table}'
    conditions = []
    params = []

    conditions.append('"CODE_ETAB" = %s')
    params.append(code_etab)

    if code_cisco:
        conditions.append('"CODE_CISCO" = %s')
        params.append(code_cisco)

    if code_dren:
        conditions.append('"CODE_DREN" = %s')
        params.append(code_dren)

    q += " WHERE " + " AND ".join(conditions)

    return to_dicts_json(q, params)

def get_sig_config(request):
    """
    GET /sig/config/
    Retourne toutes les lignes de sig_config ordonnées par cle_fonction.
    Réponse : { "success": true, "data": [ { "cle_fonction": "...", "est_active": true, ... }, ... ] }
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT cle_fonction, est_active FROM sig_config ORDER BY cle_fonction")
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
        data = [dict(zip(columns, row)) for row in rows]
        return JsonResponse({"success": True, "data": data})
    except Exception as err:
        return JsonResponse({"success": False, "error": str(err)}, status=500)


@csrf_exempt
def check_sig_feature(request, cle_fonction):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT est_active FROM sig_config WHERE cle_fonction = %s",
                [cle_fonction]
            )
            row = cursor.fetchone()
        
        est_active = bool(row[0]) if row else False
        return JsonResponse({
            "success": True, 
            "est_active": est_active,
            "cle_fonction": cle_fonction
        })
    except Exception as err:
        print("Erreur check_sig_feature:", err)   # pour debug
        return JsonResponse({
            "success": False, 
            "est_active": True,   # fallback
            "error": str(err)
        }, status=200)   # status 200 pour éviter le HTML error page

@csrf_exempt
def update_sig_config(request):
    """
    POST /sig/config/update/
    Body JSON : { "adminUsername": "...", "cle_fonction": "...", "est_active": true/false }
    Réservé aux superadmins. Met à jour sig_config et insère un audit dans sig_config_audit.
    """
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Méthode non autorisée"}, status=405)

    try:
        body = json.loads(request.body)
        admin_username = body.get("adminUsername", "")
        cle_fonction = body.get("cle_fonction", "")
        est_active = body.get("est_active", False)

        # Vérification superadmin
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT is_superuser FROM login_customuser WHERE username = %s",
                [admin_username]
            )
            row = cursor.fetchone()

        if not row or not row[0]:
            return JsonResponse({"success": False, "error": "Accès refusé"}, status=403)

        # Ancienne valeur
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT est_active FROM sig_config WHERE cle_fonction = %s",
                [cle_fonction]
            )
            old = cursor.fetchone()
        ancienne_valeur = old[0] if old else None

        # Mise à jour
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE sig_config SET est_active = %s WHERE cle_fonction = %s",
                [est_active, cle_fonction]
            )

        # Audit
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO sig_config_audit (cle_fonction, ancienne_valeur, nouvelle_valeur, modifie_par)
                VALUES (%s, %s, %s, %s)
                """,
                [cle_fonction, ancienne_valeur, est_active, admin_username]
            )

        return JsonResponse({"success": True})

    except Exception as err:
        return JsonResponse({"success": False, "error": str(err)}, status=500)


# ============================================================
# Géolocalisation — Établissements
# ============================================================

@csrf_exempt
def geolocaliserEtablissement(request):
    if request.method == "POST":
        code_etab = request.POST.get('code_etab')
        longitude = float(request.POST.get('longitude'))
        latitude = float(request.POST.get('latitude'))
        q = f"""
            INSERT INTO sig_etablissement (id, code, longitude, latitude, is_valid)
            VALUES ((SELECT COALESCE(MAX(id), 0) FROM sig_etablissement) + 1,
                    {code_etab}, {longitude}, {latitude}, 0)
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute(q)
            res = {'status': 'success', 'message': "Ajout de l'établissement effectué avec succès !"}
            return JsonResponse(res, safe=False)
        except Exception as err:
            res = {'status': 'failed', 'message': f"{err}.\n Veuillez réessayer ou contacter l'administrateur"}
            return JsonResponse(res, safe=False)


@csrf_exempt
def updatePositionEtablissement(request):
    if request.method == "POST":
        code_etab = request.POST.get('code_etab')
        longitude = request.POST.get('longitude')
        latitude = request.POST.get('latitude')
        q = f""" UPDATE sig_etablissement SET longitude={longitude}, latitude={latitude} WHERE code = {code_etab} """
        try:
            with connection.cursor() as cursor:
                cursor.execute(q)
            res = {'status': 'success', 'message': "Déplacement de l'établissement effectué avec succès !"}
            return JsonResponse(res, safe=False)
        except Exception as err:
            res = {'status': 'failed', 'message': f"{err}.\n Veuillez réessayer ou contacter l'administrateur"}
            return JsonResponse(res, safe=False)


# ============================================================
# Géolocalisation — Villages
# ============================================================

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

        if len(name) < 4 or int(population) < 10 or float(longitude) == 0:
            res = {'status': 'failed', 'message': "Veuillez vérifier les informations (NOM, POPULATION, COORDONNEES, etc...)."}
            return JsonResponse(res, safe=False)

        q = f"""
            INSERT INTO sig_village
                (id, name, dren, cisco, population, is_airtel, is_orange, is_telma, is_elec, is_eau, latitude, longitude)
            VALUES
                ((SELECT COALESCE(MAX(id), 0) FROM sig_village) + 1,
                 '{name.upper()}', {dren}, {cisco}, {population},
                 {airtel}, {orange}, {telma}, {elec}, {eau},
                 {latitude}, {longitude})
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute(q)
            res = {'status': 'success', 'message': f"Ajout du village {name} effectué avec succès !"}
            return JsonResponse(res, safe=False)
        except Exception as err:
            res = {'status': 'failed', 'message': f"{err}.\n Veuillez réessayer ou contacter l'administrateur"}
            return JsonResponse(res, safe=False)


@csrf_exempt
def updatePositionVillage(request):
    if request.method == "POST":
        id = request.POST.get('id')
        longitude = request.POST.get('longitude')
        latitude = request.POST.get('latitude')
        q = f""" UPDATE sig_village SET longitude={longitude}, latitude={latitude} WHERE id = {id} """
        try:
            with connection.cursor() as cursor:
                cursor.execute(q)
            res = {'status': 'success', 'message': "Déplacement du Village effectué avec succès !"}
            return JsonResponse(res, safe=False)
        except Exception as err:
            res = {'status': 'failed', 'message': f"{err}.\n Veuillez réessayer ou contacter l'administrateur"}
            return JsonResponse(res, safe=False)
