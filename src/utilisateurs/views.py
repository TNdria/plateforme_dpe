from django.shortcuts import render 
from django.db import connection
from django.http import JsonResponse
import json
import logging
#from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import user_passes_test

from django.contrib.auth.decorators import login_required
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
User = get_user_model()


def is_superuser(user):
    return user.is_superuser

@login_required
def create_user(request,login,mdp,f_name,l_name):
    cisco = request.POST.get('cisco')
    dren = request.POST.get('dren')
    user = User.objects.create_user(
        username= f"staff",
        password=f"st4ff",
        email=f"staff@dpe-men.mg",
        cisco = 0,
        dren = 0,
        first_name = f"STAFF",
        last_name = f"STAFF",
    )
    return render(request,template_name="create_user.html")

@login_required
def index(request):
    if request.method == 'POST':
        # Récupérer les données POST
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        username = request.POST.get('username')
        password = request.POST.get('password')
        password2 = request.POST.get('password2')
        cisco = request.POST.get('cisco') if request.POST.get('cisco') else 0
        dren = request.POST.get('dren') if request.POST.get('cisco') else 0
        infos = {"username":username,"password":password,"username":first_name,"username":last_name,}

        if (len(username)>3 and ' ' in username) :
            message = {"text":"login invalide ! veuillez ustilser un mot contenant au moins 3 lettres sans utiliser un espace","class":"alert alert-danger"}
            return render(request, 'utilisateurs.html', {'message': message,'infos':infos})
        
        if ( password != password2) :
            message = {"text":"Confirmation mot de passe incorrecte ! ","class":"alert alert-danger"}
            return render(request, 'utilisateurs.html', {'message': message,'infos':infos})

        # Créer l'utilisateur
        try:
            user = User.objects.create_user(
                first_name=first_name,
                last_name=last_name,
                username=username,
                password=password,
                cisco=cisco,
                dren=dren,
                is_staff=False,  # Marqué comme staff
                is_superuser=False,  # Pas superuser
                is_active=False  # Pas superuser
            )
            
            # Message de succès
            message = {"text":f"L'utilisateur {username} a été créé avec succès. Veuillez contacter l'administrateur pour la validation du compte","class":"alert alert-success"}
            # Rediriger vers une page de confirmation
            return render(request, 'utilisateurs.html', {'message': message})
        except Exception as e:
            # Gérer l'erreur
            message = {"text": f"Une erreur s'est produite : L'utilisateur { username } existe déjà","class":"alert alert-danger"}
            return render(request, 'utilisateurs.html', {'message': message})
    else:
        # Retourner la page index si c'est une requête GET
        return render(request,template_name="utilisateurs.html")
    
@login_required
@user_passes_test(is_superuser)
def generate_all_user(request):
    
    User = get_user_model()
    drens = get_dren()
    ciscos = get_all_cisco()
    """
    logger.debug(len(drens))
    logger.debug(len(ciscos))

    
    logger.debug(drens)
    
    for d in drens :
        # Créer l'utilisateur
        user = User.objects.create_user(
            username= f"dren{d["CODE_DREN"]}",
            password=f"@dren{d["CODE_DREN"]}",
            email=f"dren{d["CODE_DREN"]}@dpe-men.mg",
            cisco = 0,
            dren = d["CODE_DREN"],
            first_name = f"DREN {d["CODE_DREN"]}",
            last_name = f"{d["DREN"]}",
        )
        #logger.debug(user)
    for c in ciscos :
        user = User.objects.create_user(
            username= f"cisco{c["CODE_CISCO"]}",
            password=f"@cisco{c["CODE_CISCO"]}",
            email=f"cisco{c["CODE_CISCO"]}@dpe-men.mg",
            cisco = c["CODE_CISCO"],
            dren = c["CODE_DREN"],
            first_name = f"CISCO {c["CODE_CISCO"]}",
            last_name = f"{c["CISCO"]}",
        )
    """
    return render(request,template_name="generate.html",  context={"drens":drens,"ciscos":ciscos})
    
@login_required
def profil(request):
    if request.method == 'POST':
        # Récupérer les données POST
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        username = request.POST.get('username')
        password = request.POST.get('password')
        new_password = request.POST.get('new_password')
        new_password2 = request.POST.get('new_password2')

        infos = {"username":username,"password":password,"username":first_name,"username":last_name,}

        
        if (len(username)>3 and ' ' in username) :
            message = {"text":"login invalide ! veuillez ustilser un mot contenant au moins 3 lettres sans utiliser un espace","class":"alert alert-danger"}
            return render(request, 'profil.html', {'message': message,'infos':infos})
        
        if ( (new_password or new_password2) and (new_password != new_password2)) :
            message = {"text":"Confirmation mot de passe incorrecte ! ","class":"alert alert-danger"}
            return render(request, 'profil.html', {'message': message,'infos':infos})

        # Créer l'utilisateur
        try:
            user = User.objects.get(username=username)

            if not user.check_password(password):
                message = {"text":"Le mot de passe actuel est incorrecte!.","class":"alert alert-danger"}
                return render(request, 'profil.html', {'message': message,'infos':infos})
        
            user.first_name = first_name
            user.last_name = last_name
            if new_password and new_password2:
                user.set_password(new_password)
            
            user.save()
            # Message de succès
            message = {"text":f"Utilisateur {username}  mis à jour avec succès.","class":"alert alert-success"}
            # Rediriger vers une page de confirmation
            return render(request, 'profil.html', {'message': message,'infos':infos})
        except Exception as e:
            # Gérer l'erreur
            message = {"text": f"Une erreur s'est produite : L'utilisateur { username } n'existe pas","class":"alert alert-danger"}
            return render(request, 'profil.html', {'message': message})
    else:
        # Retourner la page index si c'est une requête GET
        return render(request,template_name="profil.html")
    

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

def get_all_cisco( ):
    with connection.cursor() as cursor:
        cursor.execute('SELECT * FROM v_cisco ORDER BY "CISCO" ')
        rows = cursor.fetchall()
    
    drens = [{'CODE_CISCO': row[0], 'CODE_DREN': row[1], 'CISCO': row[2]} for row in rows]
    return drens 




