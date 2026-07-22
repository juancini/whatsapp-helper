@echo off
title Creando paquete para Windows...
cd /d "%~dp0"

echo 1. Preparando entorno y compilador...
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt
pip install pyinstaller

echo.
echo 2. Compilando aplicacion a ejecutable independiente...
python build_exe.py

echo.
echo ========================================================
echo ¡LISTO! La app empaquetada esta en: dist\RespuestasRapidas
echo.
echo Instrucciones para enviar a tu novia:
echo 1. Hace clic derecho en la carpeta "dist\RespuestasRapidas"
echo 2. Elegi "Enviar a -> Carpeta comprimida (.zip)"
echo 3. ¡Mandale ese .zip por WhatsApp/Drive/Mail!
echo.
echo Ella solo tiene que descomprimir y hacer doble clic en 
echo "RespuestasRapidas.exe". ¡No necesita instalar NADA!
echo ========================================================
echo.
pause
