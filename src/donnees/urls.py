
from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path('prescolaire',index_prescolaire,name="index_donnees_presco"), 
    path('primaire',index_primaire,name="index_donnees_primaire"), 
    path('college',index_college,name="index_donnees_college"), 
    path('lycee',index_lycee,name="index_donnees_lycee"), 
    path('listeCisco/<int:code_dren>',get_cisco),
    path('listeZap/<int:code_dren>/<int:code_cisco>/<int:code_commune>',get_zap),
    path('listeCommune/<int:code_dren>/<int:code_cisco>/<int:code_zap>',get_commune),
    path('listeEtablissements/<int:code_dren>/<int:code_cisco>/<int:code_commune>/<int:code_zap>/<int:niveau>/<int:secteur>',get_etablissements),
    path('dataPrescolaire/<int:code_dren>/<int:code_cisco>/<int:code_commune>/<int:code_zap>/<int:secteur>',get_etabN0),
    path('dataPrimaire/<int:code_dren>/<int:code_cisco>/<int:code_commune>/<int:code_zap>/<int:secteur>',get_etabN1),
    path('dataCollege/<int:code_dren>/<int:code_cisco>/<int:code_commune>/<int:code_zap>/<int:secteur>',get_etabN2),
    path('dataLycee/<int:code_dren>/<int:code_cisco>/<int:code_commune>/<int:code_zap>/<int:secteur>',get_etabN3),
]
