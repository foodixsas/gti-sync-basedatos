#!/bin/bash
# Wrapper para ejecutar el polling Otter bajo launchd.
# - Carga PATH (launchd no hereda el shell del usuario).
# - Mantiene el Mac despierto mientras corra el polling (caffeinate).
# - Logs rotativos por día en logs/polling-YYYY-MM-DD.log.
# - Pasa exit code al runner para que launchd decida si reinicia.

set -u  # NO usamos -e: queremos pasar exit code real

PROJECT_DIR="/Users/danielchamorrogonzalez/contifico-supabase-sync"
cd "$PROJECT_DIR" || { echo "[wrapper] cd a $PROJECT_DIR falló"; exit 1; }

# PATH: launchd arranca con PATH minimalista. Hay que reconstruir.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Asegurar carpeta de logs
mkdir -p logs

LOG_FILE="logs/polling-$(date +%Y-%m-%d).log"
echo "" >> "$LOG_FILE"
echo "════════════════════════════════════════════════════════════" >> "$LOG_FILE"
echo "[wrapper] $(date '+%Y-%m-%d %H:%M:%S') start (host=$(hostname) pid=$$)" >> "$LOG_FILE"
echo "════════════════════════════════════════════════════════════" >> "$LOG_FILE"

# caffeinate -i = bloquea idle sleep mientras el comando viva.
# Sin -d (display sleep OK), sin -s (system sleep al cerrar tapa OK pero polling se detiene).
# El bash hereda el contexto: cuando muere npm, muere caffeinate, muere el wrapper.
exec caffeinate -i npm run polling-otter-live >> "$LOG_FILE" 2>&1
