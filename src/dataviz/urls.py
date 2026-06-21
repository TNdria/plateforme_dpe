
from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path('',index,name="index_dataviz"),
    path('layerHeatmapEtabN0/',layer_heatmap_eta_n0),
    path('layerHeatmapEtabN1/',layer_heatmap_eta_n1),
    path('layerHeatmapEtabN2/',layer_heatmap_eta_n2),
    path('layerHeatmapEtabN3/',layer_heatmap_eta_n3),
    path('layerDren/',get_layer_dren),
    path('layerCisco/',get_layer_cisco),
    path('layerCommune/<int:code>',get_layer_commune),
    path('getDataDren/',get_data_dren),
    path('getDataDren/<int:niveau>/',get_data_dren),
    path('getDataCisco/',get_data_cisco),
    path('getDataCisco/<int:niveau>/',get_data_cisco),
    path('getDataCommune/<int:code>/',get_data_commune),
    path('getDataCommune/<int:code>/<int:niveau>/',get_data_commune),
    path('getDataEtab/<int:code>/',get_data_etab),
    path('getDataEtab/<int:code>/<int:niveau>/',get_data_etab),
]
