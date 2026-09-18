#!/bin/bash
# Descarga diaria del Historial de pedidos de Uber Eats Manager + carga a Supabase.
#
# Lo corre launchd (com.foodix.uber-order-history). Necesita la sesión gráfica de
# Daniel abierta: Chrome arranca con el perfil persistente tmp-uber-manager-profile,
# que es lo único que mantiene viva la sesión de Uber. No es headless a propósito.
#
# Deja UNA línea JSON por corrida en logs/uber-order-history.log, incluso cuando no
# hubo nada nuevo: sin ese latido no se distingue "nunca disparó" de "disparó y no
# había pedidos nuevos".

set -u

PROJECT_DIR="/Users/danielchamorrogonzalez/contifico-supabase-sync"
cd "$PROJECT_DIR" || { echo '{"ev":"uber.diario.fatal","motivo":"cd_fallido"}'; exit 1; }

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export TZ="America/Guayaquil"
# El script de descarga espera un rato al azar antes de abrir el portal.
export UBER_JITTER_MS="${UBER_JITTER_MS:-900000}"   # hasta 15 min

mkdir -p logs
LOG="logs/uber-order-history.log"
INICIO=$(date +%s)

latido() {  # latido <estado> <campos_json_extra>
  printf '{"ev":"uber.diario","ts":"%s","estado":"%s","dur_s":%s%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$(( $(date +%s) - INICIO ))" "${2:-}" >> "$LOG"
}

latido "inicio" ""

# Chrome deja el perfil bloqueado (SingletonLock) si una corrida anterior quedó abierta.
# Solo cerramos instancias que lanzó ESTA automatización: llevan --remote-debugging-pipe
# y apuntan al perfil de Uber. Un Chrome que abrió Daniel a mano no cumple eso y no se toca.
PERFIL="$PROJECT_DIR/tmp-uber-manager-profile"
HUERFANOS=$(pgrep -f -- "--user-data-dir=$PERFIL .*--remote-debugging-pipe" 2>/dev/null)
if [ -n "$HUERFANOS" ]; then
  latido "perfil_ocupado" ",\"pids\":\"$(echo $HUERFANOS | tr '\n' ' ')\",\"accion\":\"cierre_suave\""
  # SIGTERM, nunca -9: un kill duro corrompe el perfil y hay que volver a loguearse.
  echo "$HUERFANOS" | xargs kill 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f -- "--user-data-dir=$PERFIL .*--remote-debugging-pipe" >/dev/null 2>&1 || break
    sleep 1
  done
  if pgrep -f -- "--user-data-dir=$PERFIL .*--remote-debugging-pipe" >/dev/null 2>&1; then
    latido "perfil_bloqueado" ",\"detalle\":\"el Chrome del perfil no cerró; revisar a mano\""
    exit 1
  fi
fi

# Chrome no siempre borra su SingletonLock al morir (o lo borra tarde, justo cuando la
# instancia nueva ya arrancó, y la nueva se cierra sola). Si el lock apunta a un pid
# muerto, es basura: se quita. Si apunta a un pid vivo, NO se toca.
LOCK="$PERFIL/SingletonLock"
if [ -L "$LOCK" ]; then
  LOCK_TARGET=$(readlink "$LOCK")
  LOCK_PID="${LOCK_TARGET##*-}"
  if [ -n "$LOCK_PID" ] && ! kill -0 "$LOCK_PID" 2>/dev/null; then
    latido "lock_huerfano" ",\"pid_muerto\":\"$LOCK_PID\""
    rm -f "$PERFIL/SingletonLock" "$PERFIL/SingletonCookie" "$PERFIL/SingletonSocket"
  fi
fi
# Chrome tarda un instante en soltar el perfil después de cerrar.
sleep 3

# 1) Pedirle a Uber el informe del día. Sin esto no hay nada nuevo que bajar: los
#    informes expiran a los ~2 días y la cuenta no tiene ninguno recurrente.
#    La ventana es de 7 días y se pide todos los días a propósito: si una corrida
#    falla, la del día siguiente vuelve a cubrir esas fechas.
SALIDA_PEDIDO=$(caffeinate -i npm run --silent request-uber-orders 2>&1)
RC_PEDIDO=$?
echo "$SALIDA_PEDIDO" >> "$LOG"
if [ $RC_PEDIDO -ne 0 ]; then
  latido "pedido_fallido" ",\"rc\":$RC_PEDIDO"
  exit 1
fi

# 2) Uber tarda unos minutos en generarlo. Si todavía no está listo cuando bajemos,
#    se baja el anterior (el import es idempotente) y mañana entra el nuevo.
ESPERA="${UBER_ESPERA_INFORME_S:-360}"
latido "esperando_informe" ",\"espera_s\":$ESPERA"
sleep "$ESPERA"

SALIDA_DESCARGA=$(caffeinate -i npm run --silent download-uber-orders 2>&1)
RC_DESCARGA=$?
echo "$SALIDA_DESCARGA" >> "$LOG"

if [ $RC_DESCARGA -ne 0 ]; then
  MOTIVO=$(echo "$SALIDA_DESCARGA" | grep -o '"message":"[^"]*"' | tail -1)
  latido "descarga_fallida" ",\"rc\":$RC_DESCARGA,\"detalle\":\"$(echo "$MOTIVO" | tr -d '"' | tr -d '\\')\""
  exit 1
fi

SALIDA_IMPORT=$(npm run --silent import-uber-orders 2>&1)
RC_IMPORT=$?
echo "$SALIDA_IMPORT" >> "$LOG"

if [ $RC_IMPORT -ne 0 ]; then
  latido "import_fallido" ",\"rc\":$RC_IMPORT"
  exit 1
fi

# La métrica que importa: cuántas filas entraron de verdad y hasta qué pedido llegamos.
NUEVAS=$(echo "$SALIDA_IMPORT" | grep -o '"filasNuevas":[0-9]*' | tail -1 | cut -d: -f2)
EN_TABLA=$(echo "$SALIDA_IMPORT" | grep -o '"filasEnTabla":[0-9]*' | tail -1 | cut -d: -f2)
ULTIMO=$(echo "$SALIDA_IMPORT" | grep -o '"ultimoPedido":"[^"]*"' | tail -1 | cut -d'"' -f4)

if [ "${NUEVAS:-0}" = "0" ]; then ESTADO="sin_cambios"; else ESTADO="hecho"; fi
latido "$ESTADO" ",\"filasNuevas\":${NUEVAS:-0},\"filasEnTabla\":${EN_TABLA:-0},\"ultimoPedido\":\"${ULTIMO:-}\""
