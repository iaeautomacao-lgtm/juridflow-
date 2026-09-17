#!/bin/bash
#
# Captura agendada do JuridFlow - DJEN e DataJud, sem ninguem clicar.
#
# Instalar no cron do cPanel, de hora em hora:
#
#   0 * * * * /bin/bash /home/grpia/repositories/juridflow-/scripts/capturar.sh
#
# Rodar na mao:
#
#   bash scripts/capturar.sh
#
# Testar sem gravar nada:
#
#   bash scripts/capturar.sh --diagnostico
#
# Nenhuma senha de tribunal esta envolvida. O DJEN e canal publico, consultado
# apenas com o numero da OAB. O DataJud usa a chave publica do CNJ, a mesma
# para todos, que vive em backend/.env como DATAJUD_API_KEY.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$REPO/backend"
LOG="$HOME/logs/juridflow-captura.log"
TRAVA="$HOME/logs/juridflow-captura.trava"

mkdir -p "$HOME/logs"

registrar() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"
}

# --- so uma execucao por vez -----------------------------------------------
# A varredura do DataJud tem pausa entre consultas e pode passar da hora. Sem
# trava, o cron seguinte comecaria por cima da execucao anterior e as duas
# disputariam a mesma fila de processos.
#
# mkdir e atomico - ao contrario de "testa se existe, depois cria", que tem
# janela entre as duas operacoes.
if ! mkdir "$TRAVA" 2>/dev/null; then
  # Trava de mais de 2h e sobra de execucao que morreu no meio.
  if [ -n "$(find "$TRAVA" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
    registrar "trava antiga encontrada (mais de 2h) - removendo"
    rmdir "$TRAVA" 2>/dev/null
    mkdir "$TRAVA" 2>/dev/null || exit 0
  else
    registrar "ja ha uma captura em andamento - saindo"
    exit 0
  fi
fi
trap 'rmdir "$TRAVA" 2>/dev/null' EXIT

# --- node no PATH ----------------------------------------------------------
# O cron roda com ambiente minimo: sem isto, `node` nao existe.
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  command -v nvm >/dev/null 2>&1 && nvm use --lts >/dev/null 2>&1
fi

if ! command -v node >/dev/null 2>&1; then
  registrar "ERRO: node nao encontrado nem via nvm."
  exit 1
fi

# --- pre-requisitos --------------------------------------------------------
if [ ! -f "$BACKEND/dist/jobs/capturar.js" ]; then
  registrar "ERRO: $BACKEND/dist/jobs/capturar.js nao existe. Rode o deploy."
  exit 1
fi

if [ ! -f "$BACKEND/.env" ]; then
  registrar "ERRO: $BACKEND/.env nao existe."
  exit 1
fi

# --- log nao cresce para sempre --------------------------------------------
if [ -f "$LOG" ] && [ "$(wc -c < "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "$LOG.anterior"
  registrar "log rotacionado (passou de 5 MB)"
fi

# --- roda ------------------------------------------------------------------
cd "$BACKEND" || exit 1

if [ -t 1 ]; then
  # Terminal: mostra na tela e grava no log.
  node dist/jobs/capturar.js "$@" 2>&1 | tee -a "$LOG"
  exit "${PIPESTATUS[0]}"
fi

# Cron: so no log.
registrar "--- inicio ---"
node dist/jobs/capturar.js "$@" >> "$LOG" 2>&1
SAIDA=$?
registrar "--- fim (codigo $SAIDA) ---"
exit "$SAIDA"
