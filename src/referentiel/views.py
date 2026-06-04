from django.db import connection
from django.http import JsonResponse

"""
    Convertir resultat de la requette en parametre vers json
    example de retour : 
    [
        {"CODE_ETAB": 516020001, "NOM_ETAB": "CEG AMBAHOABE", "CODE_CISCO": 516, "CODE_DREN": 52, "latitude": -16.78040983, "longitude": 49.51622616},
        ...
    ]
"""
def to_dicts_json(query):
    with connection.cursor() as cursor:
        cursor.execute(query)
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    
    res = [dict(zip(columns, row)) for row in rows]
    return JsonResponse(res, safe=False)


def get_dren():
    with connection.cursor() as cursor:
        cursor.execute('SELECT * FROM v_dren ORDER BY "DREN" ')
        rows = cursor.fetchall()
    
    drens = [{'CODE_DREN': row[0], 'DREN': row[1]} for row in rows]
    return drens 


def get_cisco(request, code_dren):
    q = """ SELECT * FROM v_cisco {0} {1} ORDER BY "CISCO" """
    if( not code_dren or code_dren == 0):
        q = q.format(' WHERE "CODE_DREN" ',' > 0')
    else:
        q = q.format('WHERE "CODE_DREN" = ', code_dren)
    return to_dicts_json(q) 

def get_zap_par_dren(request, code_dren):
    q = """ SELECT * FROM v_zap {0} {1} ORDER BY "CISCO" """
    if( not code_dren or code_dren == 0):
        q = q.format(' WHERE "CODE_DREN" ',' > 0')
    else:
        q = q.format('WHERE "CODE_DREN" = ', code_dren)
    return to_dicts_json(q) 

def get_zap_par_cisco(request, code_cisco):
    q = """ SELECT * FROM v_zap {0} {1} ORDER BY "CISCO" """
    if( not code_cisco or code_cisco == 0):
        q = q.format(' WHERE "CODE_CISCO" ',' > 0')
    else:
        q = q.format('WHERE "CODE_CISCO" = ', code_cisco)
    return to_dicts_json(q) 