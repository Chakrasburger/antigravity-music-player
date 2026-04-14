#!/bin/bash
# ===== Lanzador ChakrasPlayer Linux =====

# Movernos al directorio del script
cd "$(dirname "$0")"

# Verificar si el venv existe
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment ('venv') no encontrado."
    echo "Instalando automáticamente ejecutando setup_linux.sh..."
    bash setup_linux.sh
fi

echo "🎵 Iniciando ChakrasPlayer..."

# Intentar matar instancias huérfanas antes de iniciar (para liberar el puerto 5888)
fuser -k 5888/tcp 2>/dev/null || true

# Ejecutar con el entorno virtual
source venv/bin/activate
python3 app.py
