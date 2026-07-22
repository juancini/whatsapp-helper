#!/usr/bin/env bash
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Preparando el entorno por primera vez..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

python3 app.py
