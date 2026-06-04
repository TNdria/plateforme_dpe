
from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path('',index,name="index_sig"),
    path('dren/',get_dren),
    path('listeCisco/<int:code_dren>/',get_cisco),
    path('layerEtabN0/<int:code_dren>/<int:code_cisco>',get_layer_etabN0),
    path('layerEtabN1/<int:code_dren>/<int:code_cisco>',get_layer_etabN1),
    path('layerEtabN2/<int:code_dren>/<int:code_cisco>',get_layer_etabN2),
    path('layerEtabN3/<int:code_dren>/<int:code_cisco>',get_layer_etabN3),
    path('layerVillages/<int:code_dren>/<int:code_cisco>',get_layer_village),
    path('layerDren/<int:code_dren>',get_layer_dren),
    path('layerCisco/<int:code_dren>/<int:code_cisco>',get_layer_cisco),
    path('layerCommune/<int:code_dren>/<int:code_cisco>',get_layer_commune),
    path('layerFokontany/<int:code_dren>/<int:code_cisco>',get_layer_fokontany),
    path('listeEtablissementNonGeolocalise/<int:code_dren>/<int:code_cisco>',get_layer_etab_non_geolocalise),
    path('geolocaliserEtablissement/',geolocaliserEtablissement , name="geolocaliser_etablissement"),
    path('geolocaliserVillage/',geolocaliserVillage , name="geolocaliser_village"),
    path('updatePositionEtablissement/', updatePositionEtablissement),
    path('updatePositionVillage/', updatePositionVillage),
    
]
