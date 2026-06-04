import os

from django.shortcuts import render, redirect
from django.http import HttpResponse, JsonResponse, FileResponse,HttpResponseRedirect,HttpResponsePermanentRedirect
from django.db import connection

from django.contrib import messages
from django.contrib.auth.decorators import login_required

from django.conf import settings

import requests
from requests.auth import HTTPBasicAuth

import pandas as pd
import numpy as np

from datetime import datetime, timezone
import pytz
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import time

import psycopg2
from psycopg2 import sql


#import xml.etree.ElementTree as ET
#from xml.etree.ElementTree import Element, SubElement, tostring, ElementTree
import uuid
from pyodk.client import Client
from toml import load

#Pour les outils google
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from zipfile import ZipFile
import re

#Pour les images et QR_CODE
from PIL import Image
from io import BytesIO, StringIO
import csv
import qrcode
import base64
import logging
import random
import json

#PDF et Mise en page
from reportlab.platypus import SimpleDocTemplate, Paragraph, Image, Spacer, PageBreak,Table, TableStyle
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib import colors

from django.conf import settings

logger = logging.getLogger(__name__)

# Configuration for PostgreSQL
pg_config = {
    "host": "localhost",
    "port": 5453, #5432
    "database": "dpeapp",
    "user": "dpeapp",
    "password": "s3cr3t!" # "ykot"
}

def index(request):
    #return HttpResponseRedirect("https://lookerstudio.google.com/u/0/reporting/bd665096-3992-4f24-acdc-e2563a05f716/page/rf5RF")
    absolute_url = request.build_absolute_uri('/eager/dashboard/')
    return render(request, template_name='eager_dashboard.html')
    return render(request, template_name='index_form.html', context={'absolute_url': absolute_url})   


def to_dicts_json(query):
    with connection.cursor() as cursor:
        cursor.execute(query)
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    
    res = [dict(zip(columns, row)) for row in rows]
    return JsonResponse(res, safe=False)


def generer_qrcode_base64(row):
    # Construire la chaîne à encoder
    contenu = "\n".join([f"{col}: {row[col]}" for col in row.index])
    # Générer le QR code
    qr = qrcode.QRCode(box_size=4, border=2)
    qr.add_data(contenu)
    qr.make(fit=True)
    
    img = qr.make_image(fill='black', back_color='white')
    
    # Convertir en base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    return f"data:image/png;base64,{img_str}"

#manao mise a jour ny mdp avy any gsheet
#pass
def update_mdp(request):
    if request.method == 'POST':
        try:
            folder_path = os.path.join(settings.STATIC_ROOT, 'DATA_EAGER')
            os.makedirs(folder_path, exist_ok=True)
            mdp_path = os.path.join(folder_path, f"EAGER_MDP.xlsx")

            scopes = [ 'https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file']
            #scopes = ['https://www.googleapis.com/auth/spreadsheets']
            credentials = ServiceAccountCredentials.from_json_keyfile_name(os.path.join(settings.STATIC_ROOT, 'gsheet-mtfandresena.json'), scopes)
            client = gspread.authorize(credentials)
            mdp_gs = client.open_by_key('1dGwQpM0SWyYiD-q3mhkVu0GSIM9EhCNriRNHEiH5Sfk').worksheet('MDP')
            data_mdp = mdp_gs.get_all_records() #expected_headers=["CODE_ETAB", "MDP"]
            df_mdp = pd.DataFrame(data_mdp)
            df_mdp["MDP"] = df_mdp["MDP"].astype(str).str.zfill(4)
            df_mdp["CODE_ETAB"] = df_mdp["CODE_ETAB"].astype(int)
            df_mdp.to_excel(mdp_path, index=False)
            data = {
                'message': 'Mise à jour succès !',
                'success': True
            }
            return JsonResponse(data)
        except Exception as e :
            data = {
                'message': f'Une erreur est survenue ! {str(e)}',
                'success': False
            }
            return JsonResponse(data)


#copoie , jeunefille,tuteur,cin
# mi retourner info rehetra elefa any amin'ny  vue
def process_data(request,name,lastname,tuteur,recepteur,tel,copie,jf,tt,cin):
    name = name or "AUCUNE OU NON RENSEIGNÉ"
    lastname= lastname or "-"
    tuteur= tuteur or "-"
    recepteur= recepteur or "AUCUNE OU NON RENSEIGNÉ"
    tel= tel or "-"
    copie = copie or "default.jpeg"
    jf = jf or "default.jpeg"
    tt = tt if tt != "-" else "default.jpg"
    cin = cin or "default.jpeg"
    context = {
        'name' : name,
        'lastname' : lastname,
        'tuteur' : tuteur,
        'recepteur' : recepteur,
        'tel' : tel,
        'copie':f"https://dpe-men.mg/pjeager/PHOTO_ACTE_DE_NAISSANCE/{copie}", 
        'jf':f"https://dpe-men.mg/pjeager/PHOTO_JEUNE_FILLE/{jf}",
        'tt':f"https://dpe-men.mg/pjeager/PHOTO_PIECE/{tt}", 
        'cin':f"https://dpe-men.mg/pjeager/PHOTO_CIN_RECEPTEUR_RECTO/{cin}"
    }
    return render(request, template_name='data.html', context=context)   
    

# login pour nettoyage des données
def check_data_login(request):
    cheking_url = request.build_absolute_uri('/eager/datachecking/')
    return render(request, template_name='checking_data_login.html', context={'cheking_url': cheking_url}) 

def checkuser(request):
    if request.method == 'POST':
        try:
            folder_path = os.path.join(settings.STATIC_ROOT, 'DATA_EAGER')
            os.makedirs(folder_path, exist_ok=True)
            
            list_path = os.path.join(folder_path, f"login_nettoyage.xlsx")
            df_users = pd.read_excel(list_path, dtype=str, usecols=["LOGIN","MDP","NOM","CISCO"]) #, nrows=10
            df_users.fillna("-", inplace=True)
            
            login = request.POST.get('login')
            password = request.POST.get('password')
            post_data = {"LOGIN": f"{login}", "MDP": f"{password}"}
            # Vérifier si le login + mdp existent
            mask = (df_users["LOGIN"] == post_data["LOGIN"]) & (df_users["MDP"] == post_data["MDP"])
            user_match = df_users[mask]

            if not user_match.empty:
                path = os.path.join(folder_path, f"EAGER_MERGED.xlsx")
                """
                usecols = ["NOM","PRENOM","DATE_NAISSANCE","PHOTO_ACTE_DE_NAISSANCE","NIVEAU","STATUT_ELEVE",
                            "PHOTO_JEUNE_FILLE","NOM_PERE","NOM_MERE","TUTEUR","NOM_TUTEUR","PHOTO_PIECE","RECEPTEUR",
                            "CIN_RECEPTEUR","DATE_CIN_RECEPTEUR","LIEU_CIN_RECEPTEUR","PHOTO_CIN_RECEPTEUR_RECTO","PHOTO_CIN_RECEPTEUR_VERSO",
                            "CONTACT_RECEPTEUR","CODE_ETABLISSEMENT","ETABLISSEMENT","DREN","CISCO","ZAP","INSTANCEID"]
                df_data = pd.read_excel(path, dtype=str, usecols=usecols) #, nrows=10
                #mask = (df_data["CISCO"] in user_match.iloc[0]["CISCO"].split(","))
                df_data = df_data[df_data["CISCO"].isin(user_match.iloc[0]["CISCO"].split(","))]
                df_data.fillna("-", inplace=True)
                """

                df_data = pd.DataFrame(get_df_by_cisco_name(ciscos=user_match.iloc[0]["CISCO"].split(",")))
                data = df_data.to_dict(orient="records")
                context = {
                    'login': user_match.iloc[0]["LOGIN"],
                    'nom': user_match.iloc[0]["NOM"],
                    'ciscos': user_match.iloc[0]["CISCO"].split(","),
                    'data_json':  data, #df_data.applymap(bytes_to_str).to_dict(orient="records"),  # pour garder les accents,df_data.applymap(bytes_to_str).to_dict(orient="records")
                    'total': df_data.shape[0],
                    "columns": df_data.columns.tolist(),
                }
                return render(request, template_name='datachecking.html', context=context) 
            else:
                cheking_url = request.build_absolute_uri('/eager/datachecking/')
                context = {'cheking_url': cheking_url, 'error_message': f'❌ Login ou mot de passe incorrect !'}
                return render(request, template_name='checking_data_login.html', context=context)
        except Exception as e :
            cheking_url = request.build_absolute_uri('/eager/datachecking/')
            context = {'cheking_url': cheking_url, 'error_message': f'Une erreur est survenue ! {str(e)}'}
            return render(request, template_name='checking_data_login.html', context=context) 
    else:
        return HttpResponseRedirect('/eager/datachecking/login/')

def data_checking(request): 
    data_url = request.build_absolute_uri('/eager/datachecking/data/')
    return render(request, template_name='checking_data_login.html', context={'data_url': data_url}) 

# convertit les bytes en str (utf-8 ou repr hexadécimal)
def bytes_to_str(x):
    if isinstance(x, bytes):
        try:
            return x.decode("utf-8")  # si c'est du texte encodé
        except Exception:
            return x.hex()  # sinon, représenter en hexadécimal
    return x


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

def getlisteceg(request,cisco="AMBOHIMAHASOA"):
    q = f"SELECT  distinct e.code_etablissement as code, e.etablissement as etab FROM eager_pj e WHERE e.cisco = '{cisco}' "
    return to_dicts_json(q) 

def getlistepj(request,code_etab=0):
    q = f"SELECT * FROM eager_pj WHERE code_etablissement = {code_etab}"
    return to_dicts_json(q)

def get_df_by_cisco_name(ciscos=( 'AMBOHIMAHASOA','VOHIBATO')):
    cisco_list = ",".join([f"'{c}'" for c in ciscos])
    q = f"SELECT * FROM eager_pj WHERE cisco IN ({cisco_list})"
    return to_dicts_json(q) 

def updatepj(request,idpj="",champ="",valeur=0):
    try:      
        q = f"UPDATE eager_pj SET {champ} = %s WHERE instanceid = %s"
        v = True if valeur == 1 else False
        with connection.cursor() as cursor:
            cursor.execute(q, [v, idpj])
            connection.commit() 
        
        data = {'result': 'ok', 'message': 'Mise à jour effectuée !'}
        return JsonResponse(data)
    except Exception as e :
        data = {
            'result': 'ok',
            'message': f'Une erreur est survenue ! {str(e)}',
        }
        return JsonResponse(data)

@login_required
def tdb_eager(request):
    #return HttpResponseRedirect("https://lookerstudio.google.com/u/0/reporting/bd665096-3992-4f24-acdc-e2563a05f716/page/rf5RF")
    return render(request, template_name='dashboard.html')