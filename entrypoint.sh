#!/bin/bash
# entrypoint.sh

# Collect static files (optional, mas boa prática)
# python manage.py collectstatic --noinput

# Aplicar migrações ao banco de dados
echo "Applying database migrations..."
python manage.py migrate --noinput

# Iniciar o servidor Django
echo "Starting Django server..."
exec python manage.py runserver 0.0.0.0:8000
