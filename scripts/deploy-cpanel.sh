#!/bin/bash
#
# Deploy do JuridFlow no cPanel.
#
# Roda NO SERVIDOR, no terminal da aplicacao Node (que e onde o PATH do Node
# esta carregado). Faz a sequencia inteira: pull, dependencias, build,
# migrations e publicacao do frontend.
#
#   cd ~/repositories/juridflow-
#   bash scripts/deploy-cpanel.sh
#
# Depois, no painel: Setup Node.js App > Restart Application.
#
# Nao reinicia a aplicacao sozinho porque o comando de restart do Passenger
# varia por provedor, e um restart errado deixa a API fora do ar sem aviso.

set -euo pipefail

# --- ajuste ao seu ambiente ----------------------------------------------
DEPLOYPATH="${DEPLOYPATH:-/home/grpia/juridflow.grupoddm.ia.br}"
# -------------------------------------------------------------------------

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

titulo() { echo; echo "=== $* ==="; }
erro() { echo; echo "ERRO: $*" >&2; exit 1; }

command -v node >/dev/null || erro "node nao encontrado no PATH.
Rode este script no terminal da aplicacao Node do cPanel, nao no terminal
comum - e ele que carrega o ambiente do Node."

echo "repositorio : $REPO"
echo "destino     : $DEPLOYPATH"
echo "node        : $(node --version)"

titulo "1/6  Atualizando o codigo"
git pull --ff-only

titulo "2/6  Backend: dependencias"
cd "$REPO/backend"
npm ci --omit=dev --no-audit --no-fund
# O Prisma CLI e devDependency, mas generate e migrate precisam dele.
npm install --no-save prisma@5 --no-audit --no-fund

titulo "3/6  Backend: build"
npx prisma generate
npx tsc
[ -f dist/server.js ] || erro "dist/server.js nao foi gerado."

titulo "4/6  Banco: migrations"
[ -f .env ] || erro ".env nao existe em backend/.
Crie no servidor com DATABASE_URL, JWT_SECRET, CORS_ORIGINS e NODE_ENV.
Modelo na secao 3 de DEPLOY_CPANEL_MYSQL.md. Nunca versione o .env."
npx prisma migrate deploy

titulo "5/6  Frontend: build"
cd "$REPO/frontend"
npm ci --no-audit --no-fund
npm run build
[ -f dist/index.html ] || erro "dist/index.html nao foi gerado."
[ -f dist/.htaccess ] || erro "dist/.htaccess nao foi gerado.
Ele deveria vir de frontend/public/.htaccess - confira se o arquivo existe."

titulo "6/6  Publicando o frontend"
mkdir -p "$DEPLOYPATH"
# `dist/.` em vez de `dist/*`: inclui dotfiles, e o .htaccess e um deles.
# Sem ele, recarregar qualquer tela interna devolve 404.
cp -R dist/. "$DEPLOYPATH/"

echo
echo "-------------------------------------------------"
echo "Concluido."
echo
echo "Falta reiniciar a API:"
echo "  cPanel > Setup Node.js App > Restart Application"
echo
echo "Depois confira:"
echo "  curl https://juridflow.grupoddm.ia.br/api/health"
echo "-------------------------------------------------"
