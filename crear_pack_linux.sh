#!/usr/bin/env bash
cd "$(dirname "$0")"

echo "1. Preparando entorno de compilación en Linux..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

pip install -r requirements.txt
pip install pyinstaller

echo ""
echo "2. Compilando la aplicación nativa para Zorin OS / Linux..."
python3 build_linux_app.py

echo ""
echo "========================================================"
echo "¡LISTO! La aplicación empaquetada para Linux está en:"
echo "   dist/RespuestasRapidas_Linux/RespuestasRapidas_Linux"
echo ""
echo "Para ejecutarla en tu Zorin OS:"
echo "   ./dist/RespuestasRapidas_Linux/RespuestasRapidas_Linux"
echo "========================================================"
