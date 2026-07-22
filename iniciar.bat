@echo off
title Respuestas Rapidas
cd /d "%~dp0"

if not exist venv (
    echo Preparando la aplicacion por primera vez, un momento...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo.
echo Abriendo Respuestas Rapidas en tu navegador...
echo No cierres esta ventana negra mientras la estes usando.
echo.

start "" http://127.0.0.1:5050
python app.py

pause
