"""
Script para generar un ejecutable (.exe) independiente para Windows.

Requisitos previos:
    pip install pyinstaller pywebview flask

Uso:
    python build_exe.py

El resultado se creará dentro de la carpeta 'dist/RespuestasRapidas.exe' (o carpeta dist/RespuestasRapidas).
"""

import os
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

print("Iniciando compilación del ejecutable con PyInstaller...")

try:
    import PyInstaller
except ImportError:
    print("Instalando PyInstaller...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    import PyInstaller

cmd = [
    sys.executable,
    "-m",
    "PyInstaller",
    "app.py",
    "--name=RespuestasRapidas",
    "--onedir",
    "--noconsole",
    f"--add-data={os.path.join(BASE_DIR, 'templates')};templates",
    f"--add-data={os.path.join(BASE_DIR, 'static')};static",
    "--clean",
    "-y"
]

print("Ejecutando:", " ".join(cmd))
subprocess.check_call(cmd)

print("\n¡Compilación completada con éxito!")
print(f"El ejecutable se encuentra en: {os.path.join(BASE_DIR, 'dist', 'RespuestasRapidas')}\n")
