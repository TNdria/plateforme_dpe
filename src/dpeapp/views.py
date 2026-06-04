from django.shortcuts import redirect
from dashboard.views import index
def index(request):
    #drens = get_dren()
    #return render(request,template_name="dashboard.html", context={"dren":drens})
    return redirect('dashboard/')  # URL name from urls.py