
from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path('',index,name="index_ors_primaire"),
    path('dren/',get_dren),
    path('listeCisco/<int:code_dren>/',get_cisco),
    path('layerEtabN0/<int:code_dren>/<int:code_cisco>',get_layer_etabN0),
    path('layerEtabN1/<int:code_dren>/<int:code_cisco>',get_layer_etabN1),
    path('layerEtabN2/<int:code_dren>/<int:code_cisco>',get_layer_etabN2),
    path('layerEtabN3/<int:code_dren>/<int:code_cisco>',get_layer_etabN3),
    path('layerVillages/<int:code_dren>/<int:code_cisco>',get_all_village),
    path('layerDren/<int:code_dren>',get_layer_dren),
    path('layerCisco/<int:code_dren>/<int:code_cisco>',get_layer_cisco),
    path('layerCommune/<int:code_dren>/<int:code_cisco>',get_layer_commune),
    path('layerFokontany/<int:code_dren>/<int:code_cisco>',get_layer_fokontany),
    path('layerBesoinsN1/<int:code_dren>/<int:code_cisco>',get_layers_besoins_n1),
    path('downloadOrsN1/<int:code_dren>/<int:code_cisco>',download_besoins_n1, name='donwalod_ors_n1'),
    path('downloadOrsN1Nationale/',download_besoins_nationale_n1, name='donwalod_ors_n1_nat'),
    path('layerNouvelleCreation/',get_nc),
    path('layerVillagesExclus/<int:code_dren>/<int:code_cisco>',get_layer_villages_exclus),
    
]
