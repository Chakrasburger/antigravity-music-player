#!/bin/bash
# ===== ChakrasPlayer Linux Setup =====
# Ejecuta este script desde una terminal con: bash setup_linux.sh

set -e

echo "🎵 ChakrasPlayer - Configuración para Linux"
echo "============================================"

# 1. Dependencias del sistema
echo ""
echo "📦 Instalando dependencias del sistema..."
sudo apt update
sudo apt install -y ffmpeg libcairo2-dev libgirepository1.0-dev \
    pkg-config python3-dev python3-venv python3-gi python3-gi-cairo \
    gir1.2-gtk-3.0 gir1.2-webkit2-4.1

# 2. Crear venv con acceso a system packages (necesario para PyGObject)
echo ""
echo "🐍 Configurando entorno virtual Python..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -d "venv" ]; then
    echo "   Eliminando venv anterior..."
    rm -rf venv
fi

python3 -m venv --system-site-packages venv
source venv/bin/activate

# 3. Instalar paquetes Python
echo ""
echo "📥 Instalando paquetes Python..."
pip install --upgrade pip
pip install pywebview mutagen Pillow yt-dlp syncedlyrics requests

# 4. Verificar
echo ""
echo "✅ Verificando instalación..."
python3 -c "
import webview
import mutagen
from PIL import Image
print(f'  pywebview: {webview.__version__}')
print(f'  mutagen: {mutagen.version_string}')
print('  Pillow: OK')
print('  ✅ Todas las dependencias instaladas correctamente')
"

echo ""
echo "🚀 ¡Listo! Ejecuta la app con: bash run.sh"
echo "   O directamente: venv/bin/python3 app.py"
