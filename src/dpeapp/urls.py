"""
edited by Toky Fandresena 

"""
from django.contrib import admin
from django.contrib.staticfiles.storage import staticfiles_storage
from django.views.generic.base import RedirectView
from django.urls import include, path, re_path
from .views import index 
from dashboard.views import index as index_dashboard
from django.views.static import serve
from django.conf import settings

urlpatterns = [
    path('favicon.ico', RedirectView.as_view(url=staticfiles_storage.url('favicon/favicon.ico'))),
    path('dpe-admin/', admin.site.urls),
    path('login/',include('login.urls')),
    path('dashboard/',include('dashboard.urls')),
    path('',index,name="home"),
    path('referentiel/',include('referentiel.urls')),
    path('sig/',include('sig.urls')),
    path('orsprimaire/',include('orsprimaire.urls')),
    path('orscollege/',include('orscollege.urls')),
    path('orslycee/',include('orslycee.urls')),
    path('utilisateurs/',include('utilisateurs.urls')),
    path('dataviz/', include('dataviz.urls')),
    path('donnees/', include('donnees.urls')),
    path('eager/', include('eager.urls')),
    path('tdb/', include('tdb.urls')),
    path('diagnostic/', include('diagnostic.urls'))

]

urlpatterns += [
    re_path(r'^static/(?P<path>.*)$', serve,{'document_root': settings.STATIC_ROOT}),
]
