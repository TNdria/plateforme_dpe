from django.shortcuts import render
from django.db import connection
from django.http import JsonResponse
from django.db import transaction
from referentiel.views import get_dren
import json
import logging
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@login_required
def index(request):
    drens = get_dren()
    return render(request, template_name="sig.html", context={"dren": drens})


def to_dicts_json(query, params=None):
    """Exécute une requête et retourne un JsonResponse"""
    try:
        with connection.cursor() as cursor:
            cursor.execute(query, params or [])
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
        return JsonResponse(
            [dict(zip(columns, row)) for row in rows],
            safe=False
        )
    except Exception as e:
        logger.error(f"Erreur to_dicts_json: {e}")
        return JsonResponse({"error": str(e)}, status=500)


# ======================
# RÉFÉRENTIEL
# ======================

def get_dren(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT * FROM v_dren ORDER BY "DREN"')
            rows = cursor.fetchall()

        drens = [
            {'CODE_DREN': row[0], 'DREN': row[1]}
            for row in rows
        ]
        return JsonResponse(drens, safe=False)
    except Exception as e:
        logger.error(f"Erreur get_dren: {e}")
        return JsonResponse({"error": str(e)}, status=500)


def get_cisco(request, code_dren):
    if code_dren and code_dren > 0:
        q = """SELECT * FROM v_cisco WHERE "CODE_DREN" = %s ORDER BY "CISCO" """
        params = [code_dren]
    else:
        q = """SELECT * FROM v_cisco ORDER BY "CISCO" """
        params = []
    return to_dicts_json(q, params)


# ======================
# LAYERS ÉTABLISSEMENTS
# ======================

def get_layer_etabN0(request, code_dren, code_cisco):
    if code_dren > 0 and code_cisco == 0:
        q = """SELECT * FROM v_fiche_ecole_n0 WHERE "CODE_DREN" = %s"""
        params = [code_dren]
    else:
        q = """SELECT * FROM v_fiche_ecole_n0 WHERE "CODE_CISCO" = %s"""
        params = [code_cisco]
    return to_dicts_json(q, params)


def get_layer_etabN1(request, code_dren, code_cisco):
    if code_dren > 0 and code_cisco == 0:
        q = """SELECT * FROM v_fiche_ecole_n1 WHERE "CODE_DREN" = %s"""
        params = [code_dren]
    else:
        q = """SELECT * FROM v_fiche_ecole_n1 WHERE "CODE_CISCO" = %s"""
        params = [code_cisco]
    return to_dicts_json(q, params)


def get_layer_etabN2(request, code_dren, code_cisco):
    if code_dren > 0 and code_cisco == 0:
        q = """SELECT * FROM v_fiche_ecole_n2 WHERE "CODE_DREN" = %s"""
        params = [code_dren]
    else:
        q = """SELECT * FROM v_fiche_ecole_n2 WHERE "CODE_CISCO" = %s"""
        params = [code_cisco]
    return to_dicts_json(q, params)


def get_layer_etabN3(request, code_dren, code_cisco):
    if code_dren > 0 and code_cisco == 0:
        q = """SELECT * FROM v_fiche_ecole_n3 WHERE "CODE_DREN" = %s"""
        params = [code_dren]
    else:
        q = """SELECT * FROM v_fiche_ecole_n3 WHERE "CODE_CISCO" = %s"""
        params = [code_cisco]
    return to_dicts_json(q, params)


# ======================
# LAYERS GÉOGRAPHIQUES
# ======================

def get_layer_village(request, code_dren, code_cisco):
    if code_dren > 0 and code_cisco == 0:
        q = """SELECT id, name, dren as code_dren, cisco as code_cisco, 
                      longitude, latitude 
               FROM sig_village 
               WHERE dren = %s ORDER BY name"""
        params = [code_dren]
    else:
        q = """SELECT id, name, dren as code_dren, cisco as code_cisco, 
                      longitude, latitude 
               FROM sig_village 
               WHERE cisco = %s ORDER BY name"""
        params = [code_cisco]
    return to_dicts_json(q, params)


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
        WHERE CAST(r."CODE_DREN" AS INTEGER) = %s
    """
    return to_dicts_json(q, [code_dren])


def get_layer_cisco(request, code_dren, code_cisco):
    if code_cisco == 0:
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
            WHERE CAST(r."CODE_DREN" AS INTEGER) = %s
        """
        params = [code_dren]
    else:
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
            WHERE CAST(r."CODE_CISCO" AS INTEGER) = %s
        """
        params = [code_cisco]
    return to_dicts_json(q, params)


def get_layer_commune(request, code_dren, code_cisco):
    if code_cisco == 0:
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
            WHERE CAST(r.code_dren AS INTEGER) = %s
        """
        params = [code_dren]
    else:
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
            WHERE CAST(r.code_cisco AS INTEGER) = %s
        """
        params = [code_cisco]
    return to_dicts_json(q, params)


def get_layer_fokontany(request, code_dren, code_cisco):
    if code_cisco == 0:
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
            WHERE CAST(r.dren AS INTEGER) = %s
        """
        params = [code_dren]
    else:
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
            WHERE CAST(r.cisco AS INTEGER) = %s
        """
        params = [code_cisco]
    return to_dicts_json(q, params)


def get_layer_etab_non_geolocalise(request, code_dren, code_cisco):
    if code_dren > 0 and code_cisco == 0:
        q = """SELECT v.* FROM v_etablissement_non_geolocalise v WHERE v."CODE_DREN" = %s"""
        params = [code_dren]
    else:
        q = """SELECT v.* FROM v_etablissement_non_geolocalise v WHERE v."CODE_CISCO" = %s"""
        params = [code_cisco]
    return to_dicts_json(q, params)


# ======================
# TABLES BANCS
# ======================

def get_tables_bancs(request):
    niveau = request.GET.get("niveau", "0")
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
    if not table:
        return JsonResponse({"error": "niveau invalide"}, status=400)

    if not code_etab or code_etab in ["undefined", "null", ""]:
        return JsonResponse({"error": "code_etab manquant"}, status=400)

    conditions = ['"CODE_ETAB" = %s']
    params = [code_etab]

    if code_cisco:
        conditions.append('"CODE_CISCO" = %s')
        params.append(code_cisco)
    if code_dren:
        conditions.append('"CODE_DREN" = %s')
        params.append(code_dren)

    q = f'SELECT * FROM {table} WHERE ' + " AND ".join(conditions)
    return to_dicts_json(q, params)


# ======================
# SIG CONFIG
# ======================
def get_sig_config(request):
    """Retourne la configuration structurée attendue par le frontend"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT cle_fonction, est_active 
                FROM sig_config 
                ORDER BY cle_fonction
            """)
            rows = cursor.fetchall()

        config = {
            "modules": {
                "pointage": True,
                "deplacement": False,
                "validationDeplacement": False,   # camelCase pour le frontend
            },
            "permissions": {
                "valider": False,
                "rejeter": False,
                "supprimer": False,
                "verifier": True,
            }
        }

        for cle, active in rows:
            value = bool(active)
            
            # Mapping flexible pour couvrir tous les cas
            if cle == "pointage" or cle == "module_pointage":
                config["modules"]["pointage"] = value
            elif cle == "deplacement" or cle == "module_deplacement":
                config["modules"]["deplacement"] = value
            elif cle in ("validation_deplacement", "validationDeplacement", "module_validation_deplacement"):
                config["modules"]["validationDeplacement"] = value
            elif cle.startswith("module_"):
                # fallback pour d'autres modules éventuels
                key = cle.replace("module_", "")
                config["modules"][key] = value
            else:
                # Autres clés (permissions ou anciennes)
                clean_key = cle.replace("_", "").lower()
                if clean_key in ["valider", "rejeter", "supprimer", "verifier"]:
                    config["permissions"][clean_key] = value

        return JsonResponse(config)

    except Exception as err:
        logger.error(f"Erreur get_sig_config: {err}")
        return JsonResponse({
            "modules": {"pointage": True, "deplacement": False, "validationDeplacement": False},
            "permissions": {"valider": False, "rejeter": False, "supprimer": False, "verifier": True}
        })

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
        logger.error(f"Erreur check_sig_feature: {err}")
        return JsonResponse({
            "success": False,
            "est_active": True,  # fallback sécurisé
            "error": str(err)
        }, status=200)


@csrf_exempt
@require_POST
def update_sig_config(request):
    try:
        body = json.loads(request.body.decode("utf-8"))
        
        admin_username = body.get("adminUsername")
        cle_fonction = body.get("cle_fonction")
        est_active = body.get("est_active", False)

        if not admin_username or not cle_fonction:
            return JsonResponse({"success": False, "error": "Paramètres manquants"}, status=400)

        with transaction.atomic():
            # Vérification utilisateur admin
            with connection.cursor() as cursor:
                cursor.execute(
                    """SELECT id, is_superuser FROM login_customuser WHERE username = %s""",
                    [admin_username]
                )
                user_row = cursor.fetchone()

            if not user_row or not user_row[1]:
                return JsonResponse({"success": False, "error": "Accès refusé"}, status=403)

            user_id = user_row[0]

            # Ancienne valeur
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT est_active FROM sig_config WHERE cle_fonction = %s",
                    [cle_fonction]
                )
                old = cursor.fetchone()
                if not old:
                    return JsonResponse({"success": False, "error": "Configuration introuvable"}, status=404)
                ancienne_valeur = old[0]

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
                    INSERT INTO sig_config_audit 
                    (cle_fonction, ancienne_valeur, nouvelle_valeur, modifie_par, type_action)
                    VALUES (%s, %s, %s, %s, 'update')
                    """,
                    [cle_fonction, ancienne_valeur, est_active, user_id]
                )

        return JsonResponse({
            "success": True,
            "cle_fonction": cle_fonction,
            "ancienne_valeur": ancienne_valeur,
            "nouvelle_valeur": est_active
        })

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "JSON invalide"}, status=400)
    except Exception as e:
        logger.exception("Erreur update_sig_config")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


# ======================
# GÉOLOCALISATION
# ======================

@csrf_exempt
@require_POST
def geolocaliserEtablissement(request):
    try:
        code_etab = request.POST.get('code_etab')
        longitude = float(request.POST.get('longitude'))
        latitude = float(request.POST.get('latitude'))

        if not code_etab or not (-180 <= longitude <= 180) or not (-90 <= latitude <= 90):
            return JsonResponse({"status": "failed", "message": "Coordonnées invalides"}, status=400)

        q = """
            INSERT INTO sig_etablissement (id, code, longitude, latitude, is_valid)
            VALUES ((SELECT COALESCE(MAX(id), 0) FROM sig_etablissement) + 1, %s, %s, %s, 0)
        """
        with connection.cursor() as cursor:
            cursor.execute(q, [code_etab, longitude, latitude])

        return JsonResponse({'status': 'success', 'message': "Établissement géolocalisé avec succès !"})
    except Exception as err:
        logger.error(f"Erreur geolocaliserEtablissement: {err}")
        return JsonResponse({'status': 'failed', 'message': str(err)}, status=400)


@csrf_exempt
@require_POST
@transaction.atomic
def updatePositionEtablissement(request):
    try:
        data = json.loads(request.body)
        code_etab = data["code_etab"]
        nouveau_lat = data["nouveau_lat"]
        nouveau_lng = data["nouveau_lng"]
        demande_par = data.get("demande_par", "system")

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT latitude, longitude FROM sig_etablissement WHERE code_etab = %s
            """, [code_etab])
            row = cursor.fetchone()
            if not row:
                return JsonResponse({"error": "Établissement introuvable"}, status=404)

            ancien_lat, ancien_lng = row

            cursor.execute("""
                INSERT INTO sig_deplacement_etablissement 
                (code_etab, ancien_lat, ancien_lng, nouveau_lat, nouveau_lng, demande_par, is_valid)
                VALUES (%s, %s, %s, %s, %s, %s, 0)
            """, [code_etab, ancien_lat, ancien_lng, nouveau_lat, nouveau_lng, demande_par])

        return JsonResponse({"message": "Demande de déplacement enregistrée", "type": "ETAB"})
    except Exception as e:
        logger.error(f"Erreur updatePositionEtablissement: {e}")
        return JsonResponse({"error": str(e)}, status=400)


# ======================
# VILLAGES
# ======================

@csrf_exempt
@require_POST
def geolocaliserVillage(request):
    try:
        name = request.POST.get('name', '').strip().upper()
        cisco = request.POST.get('cisco')
        dren = request.POST.get('dren')
        population = int(request.POST.get('population', 0))
        longitude = float(request.POST.get('longitude'))
        latitude = float(request.POST.get('latitude'))

        if len(name) < 4 or population < 10 or not (-180 <= longitude <= 180) or not (-90 <= latitude <= 90):
            return JsonResponse({
                'status': 'failed', 
                'message': "Veuillez vérifier les informations (NOM, POPULATION, COORDONNÉES...)"
            }, status=400)

        q = """
            INSERT INTO sig_village 
            (id, name, dren, cisco, population, is_airtel, is_orange, is_telma, 
             is_elec, is_eau, latitude, longitude)
            VALUES (
                (SELECT COALESCE(MAX(id), 0) FROM sig_village) + 1,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """
        params = [
            name, dren, cisco, population,
            request.POST.get('airtel', 'false').lower() == 'true',
            request.POST.get('orange', 'false').lower() == 'true',
            request.POST.get('telma', 'false').lower() == 'true',
            request.POST.get('elec', 'false').lower() == 'true',
            request.POST.get('eau', 'false').lower() == 'true',
            latitude, longitude
        ]

        with connection.cursor() as cursor:
            cursor.execute(q, params)

        return JsonResponse({'status': 'success', 'message': f"Village {name} géolocalisé avec succès !"})
    except Exception as err:
        logger.error(f"Erreur geolocaliserVillage: {err}")
        return JsonResponse({'status': 'failed', 'message': str(err)}, status=400)


@csrf_exempt
@require_POST
@transaction.atomic
def updatePositionVillage(request):
    try:
        data = json.loads(request.body)
        id_village = data["id_village"]
        nouveau_lat = data["nouveau_lat"]
        nouveau_lng = data["nouveau_lng"]
        demande_par = data.get("demande_par", "system")

        with connection.cursor() as cursor:
            cursor.execute("SELECT latitude, longitude FROM sig_village WHERE id = %s", [id_village])
            row = cursor.fetchone()
            if not row:
                return JsonResponse({"error": "Village introuvable"}, status=404)

            ancien_lat, ancien_lng = row

            cursor.execute("""
                INSERT INTO sig_deplacement_village 
                (id_village, ancien_lat, ancien_lng, nouveau_lat, nouveau_lng, demande_par, is_valid)
                VALUES (%s, %s, %s, %s, %s, %s, 0)
            """, [id_village, ancien_lat, ancien_lng, nouveau_lat, nouveau_lng, demande_par])

        return JsonResponse({"message": "Demande de déplacement enregistrée", "type": "VILLAGE"})
    except Exception as e:
        logger.error(f"Erreur updatePositionVillage: {e}")
        return JsonResponse({"error": str(e)}, status=400)


# ======================
# WORKFLOW DÉPLACEMENTS
# ======================

def get_deplacements_nonvalides(request):
    try:
        # =========================
        # 1. PARAMÈTRES
        # =========================
        dren = request.GET.get("dren")
        cisco = request.GET.get("cisco")

        # =========================
        # 2. VALIDATION DREN OBLIGATOIRE
        # =========================
        if not dren:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Sélection requise : veuillez choisir un DREN pour afficher les déplacements non validés.",
                    "code": "DREN_REQUIRED",
                    "data": []
                },
                status=400
            )

        # =========================
        # 3. SQL BASE
        # =========================
        sql = """
            SELECT 
                type_objet,
                id,
                code_objet,
                code_dren,
                code_cisco,
                ancien_lat,
                ancien_lng,
                nouveau_lat,
                nouveau_lng,
                date_demande,
                demande_par,
                nb_doublons
            FROM v_deplacement_nonvalide
            WHERE code_dren = %s
        """

        params = [dren]

        # =========================
        # 4. FILTRE CISCO OPTIONNEL
        # =========================
        if cisco:
            sql += " AND code_cisco = %s"
            params.append(cisco)

        sql += " ORDER BY date_demande DESC"

        # =========================
        # 5. EXECUTION
        # =========================
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall()

        # =========================
        # 6. FORMAT RESPONSE
        # =========================
        data = [
            {
                "type_objet": r[0],
                "id": r[1],
                "code": r[2],
                "code_dren": r[3],
                "code_cisco": r[4],
                "ancien_lat": r[5],
                "ancien_lng": r[6],
                "nouveau_lat": r[7],
                "nouveau_lng": r[8],
                "date_demande": r[9],
                "demande_par": r[10],
                "nb_doublons": r[11],
                "is_duplicate": r[11] > 1
            }
            for r in rows
        ]

        return JsonResponse(
            {
                "success": True,
                "message": "Liste des déplacements non validés chargée avec succès.",
                "count": len(data),
                "data": data
            }
        )

    except Exception as e:
        logger.error(f"Erreur get_deplacements_nonvalides: {e}")

        return JsonResponse(
            {
                "success": False,
                "message": "Une erreur est survenue lors du chargement des déplacements.",
                "code": "SERVER_ERROR",
                "data": []
            },
            status=500
        )  

@csrf_exempt
@require_POST
@transaction.atomic
def valider_deplacement(request):
    try:
        data = json.loads(request.body)
        type_objet = data["type_objet"]
        id_dep = data["id"]

        with connection.cursor() as cursor:
            if type_objet == "ETAB":
                cursor.execute("""
                    SELECT code_etab, nouveau_lat, nouveau_lng 
                    FROM sig_deplacement_etablissement 
                    WHERE id = %s AND is_valid = 0
                """, [id_dep])
                row = cursor.fetchone()
                if not row:
                    return JsonResponse({"error": "Demande invalide"}, status=404)

                code, lat, lng = row
                cursor.execute("""
                    UPDATE sig_etablissement SET latitude = %s, longitude = %s 
                    WHERE code_etab = %s
                """, [lat, lng, code])
                cursor.execute("UPDATE sig_deplacement_etablissement SET is_valid = 1 WHERE id = %s", [id_dep])

            elif type_objet == "VILLAGE":
                cursor.execute("""
                    SELECT id_village, nouveau_lat, nouveau_lng 
                    FROM sig_deplacement_village 
                    WHERE id = %s AND is_valid = 0
                """, [id_dep])
                row = cursor.fetchone()
                if not row:
                    return JsonResponse({"error": "Demande invalide"}, status=404)

                vid, lat, lng = row
                cursor.execute("""
                    UPDATE sig_village SET latitude = %s, longitude = %s 
                    WHERE id = %s
                """, [lat, lng, vid])
                cursor.execute("UPDATE sig_deplacement_village SET is_valid = 1 WHERE id = %s", [id_dep])

        return JsonResponse({"message": "Déplacement validé avec succès"})
    except Exception as e:
        logger.error(f"Erreur valider_deplacement: {e}")
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_POST
@transaction.atomic
def rejeter_deplacement(request):
    try:
        data = json.loads(request.body)
        type_objet = data["type_objet"]
        id_deplacement = data["id"]

        with connection.cursor() as cursor:
            if type_objet == "ETAB":
                cursor.execute(
                    "UPDATE sig_deplacement_etablissement SET is_valid = -1 WHERE id = %s AND is_valid = 0",
                    [id_deplacement]
                )
            elif type_objet == "VILLAGE":
                cursor.execute(
                    "UPDATE sig_deplacement_village SET is_valid = -1 WHERE id = %s AND is_valid = 0",
                    [id_deplacement]
                )
            else:
                return JsonResponse({"error": "Type inconnu"}, status=400)

        return JsonResponse({"message": "Déplacement rejeté"})
    except Exception as e:
        logger.error(f"Erreur rejeter_deplacement: {e}")
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_POST
@transaction.atomic
def supprimer_deplacement(request):
    try:
        data = json.loads(request.body)
        type_objet = data["type_objet"]
        id_dep = data["id"]

        with connection.cursor() as cursor:
            if type_objet == "ETAB":
                cursor.execute("DELETE FROM sig_deplacement_etablissement WHERE id = %s", [id_dep])
            else:
                cursor.execute("DELETE FROM sig_deplacement_village WHERE id = %s", [id_dep])

        return JsonResponse({"message": "Déplacement supprimé"})
    except Exception as e:
        logger.error(f"Erreur supprimer_deplacement: {e}")
        return JsonResponse({"error": str(e)}, status=400)