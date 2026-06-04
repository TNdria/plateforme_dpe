from django.shortcuts import render

def liste(request):
    data = {"message": "Bienvenue dans la liste des diagnostics"}
    return render(request, "diagnostic.html", data)
