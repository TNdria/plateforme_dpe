import os
from django.conf import settings
from django.shortcuts import render 
from django.http import JsonResponse
from django.http import HttpResponse
import json
import logging
from django.contrib.auth.decorators import login_required
import csv
from referentiel.views import *
from .tdb_dren_utils.tdb_dren_n2 import *

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


#@login_required
def index_tdb_zap(request):
    drens = get_dren()
    return render(request,template_name="index_tdb_zap.html", context={"dren":drens})

# ----------------------- LES FUNCTIONS TRAITEMENTS DES TdB DREN-----------------------------------
# A- Tableau de bord pour DREN
# 1- DREN Niveau 2
# a - Nombre des stds (CISCO et ZAPs)
#@login_required
def get_nbr_std_dren(request,code_dren):
    cd = code_dren or 11
    ciscos = json.loads(get_cisco(request=request, code_dren=cd).content)
    zaps = json.loads(get_zap_par_dren(request=request, code_dren=cd).content)
    merged_data = {"cisco":ciscos,"zap":zaps}
    return JsonResponse(merged_data)

# b - tableau page 1, ligne 1, colone 1
#@login_required
def tdb_111(request,code_dren):
    cd = code_dren or 11
    return get_tb_111(code_dren=cd)


# ------------------------ TDB ZAP et ECOLES ------------------------
def get_ciscos(request,code_dren):
    cd = code_dren or 11
    ciscos = json.loads(get_cisco(request=request, code_dren=cd).content) #from referentiel
    return JsonResponse({"ciscos":ciscos})

def get_zaps(request,code_cisco):
    cc = code_cisco or 101
    zaps = json.loads(get_zap_par_cisco(request=request, code_cisco=cc).content) #from referentiel
    return JsonResponse({"zaps":zaps})


# ------------- liste des PDF ---------------
# ------------------------ TDB ZAP et ECOLES ------------------------
def liste_pdfs(request):
    dren = request.GET.get('dren', '').strip()
    cisco = request.GET.get('cisco', '').strip()
    zap = request.GET.get('zap', '').strip()
    from django.apps import apps
    from urllib.parse import quote
    app_config = apps.get_app_config('tdb')
    tdb_dir = os.path.join(app_config.path, 'static', 'TDB', dren, cisco, zap)
    #logger.info(tdb_dir)
    found_files = []
    if os.path.isdir(tdb_dir):
        for root, dirs, files in os.walk(tdb_dir):
            for file in files:
                if file.lower().endswith(".pdf"):
                    abs_path = os.path.join(root, file)
                    idx = abs_path.lower().find('static')
                    if idx != -1:
                        rel_url = '/' + abs_path[idx:].replace('\\', '/')
                        rel_url = quote(rel_url, safe="/:._-")
                        found_files.append({"name": file, "url": rel_url})
    return JsonResponse({'pdfs': found_files})