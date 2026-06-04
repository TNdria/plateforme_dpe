
from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path('',index,name="tdb_eager"), 
    #path('liste/<int:CODE_ETAB>/<str:password>/',display_data,name="display_liste_eager"), 
    path('data/<str:name>/<str:lastname>/<str:tuteur>/<str:recepteur>/<str:tel>/<str:copie>/<str:jf>/<str:tt>/<str:cin>/',process_data,name="process_data"), 
    path('datachecking/login/',check_data_login,name="check_data_login"), #login pour nettoyage des données 
    path('datachecking/',checkuser,name="checkuser"), #verifier user pour nettoyage des données   
    path('datachecking/getlisteceg/<str:cisco>/',getlisteceg,name="getlisteceg"), #verifier user pour nettoyage des données   
    path('datachecking/getlistepj/<int:code_etab>/',getlistepj,name="getlistepj"), #verifier user pour nettoyage des données  
    path('datachecking/updatepj/<str:idpj>/<str:champ>/<int:valeur>/',updatepj,name="updatepj"), 
    path('updateMDP/',update_mdp,name="update_mdp"), 
]
