
#!/usr/bin/env bash
set -o errexit

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install gunicorn==26.2.0

python manage.py collectstatic --no-input
python manage.py migrate
