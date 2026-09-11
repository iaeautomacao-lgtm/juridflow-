#!/bin/bash
#
# Mantem a API Node do JuridFlow viva.
#
# Sem Passenger ou Node.js Selector, ninguem supervisiona o processo: ele
# morre no reinicio do servidor, ao estourar limite de recurso, ou por um
# erro nao tratado - e nada o levanta de volta. Este script e o substituto
# pobre de um supervisor.
#
# Instalar no cron do cPanel, a cada 5 minutos:
#
#   */5 * * * * /bin/bash /home/grpia/repositories/juridflow-/scripts/manter-api.sh
#
# Rodar na mao para subir agora:
#
#   bash scripts/manter-api.sh
#
# Verifica pelo /health, nao pelo PID: processo pode estar vivo e travado, e
# o que importa e responder.

set -uo pipefail

PORTA="${PORTA:-3001}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$REPO/backend"
LOG="$HOME/logs/juridflow-api.log"
LOG_SUPERVISOR="$HOME/logs/juridflow-manter.log"

mkdir -p "$HOME/logs"

registrar() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_SUPERVISOR"
}

# --- ja esta respondendo? --------------------------------------------------
if curl -sf --max-time 5 "http://127.0.0.1:${PORTA}/health" -o /dev/null 2>/dev/null; then
  exit 0
fi

registrar "API nao respondeu em 127.0.0.1:${PORTA}/health - subindo"

# --- node no PATH ----------------------------------------------------------
# O cron roda com ambiente minimo: sem isto, `node` nao existe.
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  command -v nvm >/dev/null 2>&1 && nvm use --lts >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1; then
  registrar "ERRO: node nao encontrado nem via nvm. Nada a fazer."
  exit 1
fi

# --- pre-requisitos --------------------------------------------------------
if [ ! -f "$BACKEND/dist/server.js" ]; then
  registrar "ERRO: $BACKEND/dist/server.js nao existe. Rode o deploy."
  exit 1
fi

if [ ! -f "$BACKEND/.env" ]; then
  registrar "ERRO: $BACKEND/.env nao existe."
  exit 1
fi

# --- mata sobra travada ----------------------------------------------------
# Se um processo antigo ficou vivo mas sem responder, ele segura a porta e o
# novo nao sobe.
ANTIGO=$(pgrep -u "$USER" -f "node .*juridflow.*dist/server.js" 2>/dev/null | head -5)
if [ -n "$ANTIGO" ]; then
  registrar "matando processo que nao respondia: $(echo "$ANTIGO" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  kill $ANTIGO 2>/dev/null
  sleep 2
  # shellcheck disable=SC2086
  kill -9 $ANTIGO 2>/dev/null
fi

# --- log nao cresce para sempre --------------------------------------------
if [ -f "$LOG" ] && [ "$(wc -c < "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "$LOG.anterior"
  registrar "log rotacionado (passou de 5 MB)"
fi

# --- sobe ------------------------------------------------------------------
cd "$BACKEND" || exit 1
nohup node dist/server.js >> "$LOG" 2>&1 &
NOVO=$!

# Espera ate 15s pela primeira resposta: o Prisma leva um instante para
# conectar no banco.
for _ in $(seq 1 15); do
  sleep 1
  if curl -sf --max-time 3 "http://127.0.0.1:${PORTA}/health" -o /dev/null 2>/dev/null; then
    registrar "API no ar (pid $NOVO)"
    exit 0
  fi
done

registrar "ERRO: subiu o processo (pid $NOVO) mas /health nao respondeu em 15s."
registrar "Ultimas linhas de $LOG:"
tail -5 "$LOG" >> "$LOG_SUPERVISOR" 2>/dev/null
exit 1
