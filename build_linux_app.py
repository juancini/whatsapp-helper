"""
Script para generar el ejecutable nativo para Linux (Zorin OS / Ubuntu).
"""

import os
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

print("Iniciando compilación de Respuestas Rápidas para Linux...")

try:
    import PyInstaller
except ImportError:
    print("Instalando PyInstaller...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

cmd = [
    sys.executable,
    "-m",
    "PyInstaller",
    "app.py",
    "--name=RespuestasRapidas_Linux",
    "--onedir",
    f"--add-data={os.path.join(BASE_DIR, 'templates')}:templates",
    f"--add-data={os.path.join(BASE_DIR, 'static')}:static",
    "--clean",
    "-y"
]

print("Ejecutando PyInstaller...")
subprocess.check_call(cmd)

print("\n¡Compilación para Linux completada con éxito!")
print(f"Ubicación del paquete: {os.path.join(BASE_DIR, 'dist', 'RespuestasRapidas_Linux')}\n")
