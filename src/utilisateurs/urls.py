from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index_create_user'),
    path('create/', views.create_user),
    path('profil/', views.profil, name="user_profil"),
    path('generate/', views.generate_all_user),
]