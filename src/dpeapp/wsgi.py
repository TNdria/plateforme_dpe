"""
WSGI config for dpeapp project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/wsgi/
"""

import os
import sys

from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dpeapp.settings')
application = get_wsgi_application()
sys.stdout = open('wsgi.log', 'w')
sys.stderr = open('wsgi.err', 'w')
