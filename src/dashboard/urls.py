
from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path('',index,name="index_dashboard"),
    path('dren/',get_dren),
    path('cisco/<int:code_dren>/',get_cisco),
    path('statsEtablissements/<int:code_dren>/<int:code_cisco>/<int:secteur>',get_stats_etab),
    path('statsElevesN0N1/<int:code_dren>/<int:code_cisco>/<int:secteur>',get_stats_elevesN0N1),
    path('statsElevesN2N3/<int:code_dren>/<int:code_cisco>/<int:secteur>',get_stats_elevesN2N3),
    path('statsEnseignantsEnClasse/<int:code_dren>/<int:code_cisco>/<int:secteur>',get_stats_enseignants_en_classe),
    path('statsPlaceAssises/<int:code_dren>/<int:code_cisco>/<int:secteur>',get_stats_place_assises),

    
]
