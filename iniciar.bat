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

start "" venv\Scripts\pythonw.exe app.py
