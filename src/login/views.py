from django.contrib.auth import authenticate, login, logout
from django.shortcuts import redirect, render

def login_view(request):
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            if( user.is_active):
                login(request, user)
                if user.username == "eager":
                    return redirect('/eager/')
                else:
                    return redirect('/dashboard/')
            else:   
                return render(request, 'login.html', {'error': f"Le compte de {user.username} n'est pas encore activé , veuillez contacter l'administrateur"})

        else :
            return render(request, 'login.html', {'error': "Identifiants invalides ou compte pas encore activé, veuillez réessayer ou contacter l'administrateur"})

    
    return render(request, 'login.html')

def logout_view(request):
    logout(request)
    return redirect('/login/')


