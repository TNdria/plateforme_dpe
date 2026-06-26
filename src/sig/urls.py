from django.urls import path
from .views import *

app_name = 'sig'  # ← Important pour les reverse URLs

urlpatterns = [
    path('', index, name="index_sig"),

    # ======================
    # RÉFÉRENTIEL
    # ======================
    path('dren/', get_dren, name="sig_dren"),
    path('liste-cisco/<int:code_dren>/', get_cisco, name="sig_cisco"),

    # ======================
    # LAYERS ÉTABLISSEMENTS
    # ======================
    path('layer-etab-n0/<int:code_dren>/<int:code_cisco>/', get_layer_etabN0, name="sig_layer_etab_n0"),
    path('layer-etab-n1/<int:code_dren>/<int:code_cisco>/', get_layer_etabN1, name="sig_layer_etab_n1"),
    path('layer-etab-n2/<int:code_dren>/<int:code_cisco>/', get_layer_etabN2, name="sig_layer_etab_n2"),
    path('layer-etab-n3/<int:code_dren>/<int:code_cisco>/', get_layer_etabN3, name="sig_layer_etab_n3"),

    # ======================
    # LAYERS GÉOGRAPHIQUES
    # ======================
    path('layer-villages/<int:code_dren>/<int:code_cisco>/', get_layer_village, name="sig_layer_village"),
    path('layer-dren/<int:code_dren>/', get_layer_dren, name="sig_layer_dren"),
    path('layer-cisco/<int:code_dren>/<int:code_cisco>/', get_layer_cisco, name="sig_layer_cisco"),
    path('layer-commune/<int:code_dren>/<int:code_cisco>/', get_layer_commune, name="sig_layer_commune"),
    path('layer-fokontany/<int:code_dren>/<int:code_cisco>/', get_layer_fokontany, name="sig_layer_fokontany"),

    # ======================
    # NON GÉOLOCALISÉS
    # ======================
    path(
        'etablissements-non-geolocalises/<int:code_dren>/<int:code_cisco>/',
        get_layer_etab_non_geolocalise,
        name="sig_etab_non_geolocalise"
    ),

    # ======================
    # ACTIONS DE GÉOLOCALISATION
    # ======================
    path('geolocaliser-etablissement/', geolocaliserEtablissement, name="sig_geolocaliser_etab"),
    path('geolocaliser-village/', geolocaliserVillage, name="sig_geolocaliser_village"),

    # ======================
    # DÉPLACEMENTS (Workflow)
    # ======================
    path('deplacements/update-position-etablissement/', 
         updatePositionEtablissement, 
         name="sig_update_position_etab"),
    
    path('deplacements/update-position-village/', 
         updatePositionVillage, 
         name="sig_update_position_village"),

    path('deplacements/non-valides/', 
         get_deplacements_nonvalides, 
         name="sig_deplacements_non_valides"),
    
    path('deplacements/valider/', 
         valider_deplacement, 
         name="sig_valider_deplacement"),
    
    path('deplacements/rejeter/', 
         rejeter_deplacement, 
         name="sig_rejeter_deplacement"),
    
    path('deplacements/supprimer/', 
         supprimer_deplacement, 
         name="sig_supprimer_deplacement"),

    # ======================
    # CONFIGURATION SIG
    # ======================
    path('tables-bancs/', get_tables_bancs, name="sig_tables_bancs"),
    path('config/', get_sig_config, name="sig_config"),
    path('config/check/<str:cle_fonction>/', check_sig_feature, name="sig_check_feature"),
    path('config/update/', update_sig_config, name="sig_update_config"),
]




























































































