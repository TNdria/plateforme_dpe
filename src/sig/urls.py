from django.urls import path
from .views import *

urlpatterns = [
    path('', index, name="index_sig"),

    # Référentiel
    path('dren/', get_dren, name="sig_dren"),
    path('listeCisco/<int:code_dren>/', get_cisco, name="sig_cisco"),

    # Layers établissements
    path('layerEtabN0/<int:code_dren>/<int:code_cisco>/', get_layer_etabN0),
    path('layerEtabN1/<int:code_dren>/<int:code_cisco>/', get_layer_etabN1),
    path('layerEtabN2/<int:code_dren>/<int:code_cisco>/', get_layer_etabN2),
    path('layerEtabN3/<int:code_dren>/<int:code_cisco>/', get_layer_etabN3),

    # Layers géographiques
    path('layerVillages/<int:code_dren>/<int:code_cisco>/', get_layer_village),
    path('layerDren/<int:code_dren>/', get_layer_dren),
    path('layerCisco/<int:code_dren>/<int:code_cisco>/', get_layer_cisco),
    path('layerCommune/<int:code_dren>/<int:code_cisco>/', get_layer_commune),
    path('layerFokontany/<int:code_dren>/<int:code_cisco>/', get_layer_fokontany),

    # Non géolocalisés
    path('listeEtablissementNonGeolocalise/<int:code_dren>/<int:code_cisco>/', get_layer_etab_non_geolocalise),

    # Actions
    path('geolocaliserEtablissement/', geolocaliserEtablissement),
    path('geolocaliserVillage/', geolocaliserVillage),
    path('updatePositionEtablissement/', updatePositionEtablissement),
    path('updatePositionVillage/', updatePositionVillage),

    # ====================== CONFIG SIG ======================
    path('tables-bancs/', get_tables_bancs, name="sig_tables_bancs"),
    path('config/', get_sig_config),
    path('config/check/<str:cle_fonction>/', check_sig_feature),
    path('config/update/', update_sig_config),
]