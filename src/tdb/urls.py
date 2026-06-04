
from django.contrib import admin
from django.urls import path
from .views import *

urlpatterns = [
    path('',index_tdb_zap,name="index_tdb"), 
    path('dren/nombreSTD/<int:code_dren>/',get_nbr_std_dren,name="get_nbr_std_dren"),
    path('dren/tdb_111/<int:code_dren>/',tdb_111,name="tdb_111"),
    path('zap/',index_tdb_zap,name="index_tdb_zap"),
    path('listeCisco/<int:code_dren>',get_ciscos),
    path('listeZap/<int:code_cisco>',get_zaps),
    path("liste_pdfs/", liste_pdfs)
]
