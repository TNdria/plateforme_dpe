
from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path('',index,name="index_orslycee"),
    path('dren/',get_dren),
    path('listeCisco/<int:code_dren>/',get_cisco),
    path('layerEtabN2/<int:code_dren>/<int:code_cisco>',get_layer_etabN2),
    path('layerEtabN3/<int:code_dren>/<int:code_cisco>',get_layer_etabN3),
    path('layerVillages/<int:code_dren>/<int:code_cisco>',get_layer_village),
    path('layerDren/<int:code_dren>',get_layer_dren),
    path('layerCisco/<int:code_dren>/<int:code_cisco>',get_layer_cisco),
    path('layerCommune/<int:code_dren>/<int:code_cisco>',get_layer_commune),
    path('layerFokontany/<int:code_dren>/<int:code_cisco>',get_layer_fokontany),
    path('layerBesoinsN3/<int:code_dren>/<int:code_cisco>',get_layers_besoins_n3),
    path('downloadOrsN3/<int:code_dren>/<int:code_cisco>',download_besoins_n3, name='donwalod_ors_n3'),
    
]
