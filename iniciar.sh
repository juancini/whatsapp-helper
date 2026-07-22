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

echo ""
echo "Abriendo Respuestas Rápidas en http://127.0.0.1:5050 ..."
echo "Presioná Ctrl+C para salir."
echo ""

if command -v xdg-open > /dev/null; then
    (sleep 1 && xdg-open http://127.0.0.1:5050) &
elif command -v open > /dev/null; then
    (sleep 1 && open http://127.0.0.1:5050) &
fi

python3 app.py
