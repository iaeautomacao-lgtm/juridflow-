#!/bin/bash
#
# Deploy do JuridFlow no cPanel.
#
# Roda NO SERVIDOR, no Terminal do cPanel:
#
#   cd ~/repositories/juridflow-
#   bash scripts/deploy-cpanel.sh
#
# Depois, no painel: Setup Node.js App > Restart Application.
#
# ORDEM DAS ETAPAS
#   O frontend e publicado ANTES das migrations, de proposito. Ele nao depende
#   do banco, e a versao anterior deste script rodava as migrations no meio:
#   credencial de MySQL errada abortava tudo com `set -e`, e o dominio ficava
#   servindo listagem de diretorio como se nada tivesse sido feito.
#
#   Falha de migration agora e reportada no fim, sem desfazer o que ja subiu.
#   O frontend no ar com API fora mostra a tela de login e um erro claro de
#   conexao - diagnostico muito melhor que uma pagina vazia.
#
# Nao reinicia a aplicacao: o comando de restart do Passenger varia por
# provedor, e um restart errado deixa a API fora do ar sem aviso.

set -uo pipefail

# --- ajuste ao seu ambiente ----------------------------------------------
DEPLOYPATH="${DEPLOYPATH:-/home/grpia/juridflow.grupoddm.ia.br}"
# -------------------------------------------------------------------------

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

titulo() { echo; echo "=== $* ==="; }
erro() { echo; echo "ERRO: $*" >&2; exit 1; }

# Carrega o nvm: o Terminal do cPanel nao faz isso sozinho.
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  command -v nvm >/dev/null 2>&1 && nvm use --lts >/dev/null 2>&1
fi

command -v node >/dev/null 2>&1 || erro "node nao encontrado.
Tentei carregar o nvm de \$HOME/.nvm e nao achei. Rode antes:
  export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"; nvm use --lts"

echo "repositorio : $REPO"
echo "destino     : $DEPLOYPATH"
echo "node        : $(node --version)"

# ---------------------------------------------------------------- 1/5
titulo "1/5  Atualizando o codigo"
git pull --ff-only || erro "git pull falhou. Resolva o conflito e rode de novo."

# ---------------------------------------------------------------- 2/5
titulo "2/5  Frontend: build"
cd "$REPO/frontend"
npm ci --no-audit --no-fund || erro "npm ci falhou no frontend."
npm run build || erro "build do frontend falhou.
Se a mensagem falar de memoria, compile na sua maquina e envie frontend/dist
pronto - veja a secao 2 de DEPLOY_CPANEL_MYSQL.md."

[ -f dist/index.html ] || erro "dist/index.html nao foi gerado."
[ -f dist/.htaccess ] || erro "dist/.htaccess nao foi gerado.
Deveria vir de frontend/public/.htaccess. Confira se o arquivo existe no
repositorio (git pull trouxe?)."

# ---------------------------------------------------------------- 3/5
titulo "3/5  Publicando o frontend"
mkdir -p "$DEPLOYPATH" || erro "nao consegui criar $DEPLOYPATH"
# `dist/.` em vez de `dist/*`: inclui dotfiles, e o .htaccess e um deles.
# Sem ele, recarregar qualquer tela interna devolve 404 e o Apache lista o
# diretorio em vez de servir a aplicacao.
cp -R dist/. "$DEPLOYPATH/" || erro "falha ao copiar para $DEPLOYPATH"
[ -f "$DEPLOYPATH/index.html" ] || erro "index.html nao chegou ao destino."
[ -f "$DEPLOYPATH/.htaccess" ] || erro ".htaccess nao chegou ao destino."
echo "  index.html e .htaccess no ar em $DEPLOYPATH"

# ---------------------------------------------------------------- 4/5
titulo "4/5  Backend: dependencias e build"
cd "$REPO/backend"
npm ci --no-audit --no-fund || erro "npm ci falhou no backend."
npx prisma generate || erro "prisma generate falhou."
npx tsc || erro "compilacao do backend falhou."
[ -f dist/server.js ] || erro "dist/server.js nao foi gerado."

# ---------------------------------------------------------------- 5/5
# Ultima etapa de proposito: se a credencial do banco estiver errada, tudo
# acima ja esta publicado.
titulo "5/5  Banco: migrations"
MIGRACAO_OK=1
if [ ! -f .env ]; then
  echo "  PULADO: backend/.env nao existe."
  echo "  Crie no servidor com DATABASE_URL, JWT_SECRET e CORS_ORIGINS."
  echo "  Modelo na secao 3 de DEPLOY_CPANEL_MYSQL.md."
  MIGRACAO_OK=0
elif npx prisma migrate deploy; then
  echo "  migrations aplicadas"

  # O Prisma nao emite clausula de engine: herda o default do servidor. Se o
  # default for MyISAM, as tabelas nascem sem suporte a chave estrangeira - o
  # MySQL aceita a sintaxe das FKs e ignora em silencio, e o cascade a partir
  # de Tenant deixa de existir. Conferir e obrigatorio, nao opcional.
  MYISAM=$(node -e '
    require("dotenv").config();
    const u = new URL(process.env.DATABASE_URL);
    const cp = require("child_process");
    // Exclui _prisma_migrations: o Prisma a cria sem clausula de engine,
    // entao ela herda o default do servidor. Nao tem FK nem indice longo -
    // MyISAM ali e inofensivo, e contar ela daria falso alarme em todo deploy.
    const sql = "SELECT GROUP_CONCAT(table_name) FROM information_schema.tables"
      + " WHERE table_schema=DATABASE() AND engine<>\"InnoDB\""
      + " AND table_name<>\"_prisma_migrations\";";
    try {
      // Senha via MYSQL_PWD, nao via -p: argumento de linha de comando
      // aparece no ps para qualquer usuario da maquina, e isto e hospedagem
      // compartilhada.
      const out = cp.execFileSync("mysql", [
        "-u", decodeURIComponent(u.username),
        "-h", u.hostname, "-N", "-B",
        decodeURIComponent(u.pathname.slice(1)), "-e", sql
      ], {
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) }
      });
      // GROUP_CONCAT devolve NULL (que o mysql -N imprime como "NULL")
      // quando nenhuma linha casa - ou seja, quando esta tudo certo.
      const r = String(out).trim();
      process.stdout.write(r === "NULL" || r === "" ? "ok" : r);
    } catch { process.stdout.write("?"); }
  ' 2>/dev/null)

  if [ "$MYISAM" = "ok" ]; then
    echo "  todas as tabelas do schema em InnoDB"
  elif [ "$MYISAM" = "?" ]; then
    echo "  AVISO: nao consegui verificar o engine das tabelas."
  else
    echo
    echo "  ALERTA: fora do InnoDB -> $MYISAM"
    echo "  Chave estrangeira nao funciona em MyISAM - o MySQL ignora em"
    echo "  silencio, e o cascade a partir de Tenant deixa de existir."
    echo "  A migration precisa declarar ENGINE = InnoDB explicitamente."
    MIGRACAO_OK=0
  fi
else
  MIGRACAO_OK=0
  echo
  echo "  FALHOU. O frontend ESTA no ar; so a API depende disto."
  echo
  echo "  Se a mensagem foi P1000 (authentication failed), a credencial do"
  echo "  MySQL esta errada. Teste ela fora do Prisma:"
  echo
  echo "    mysql -u USUARIO -p -h localhost BANCO -e \"SELECT 1;\""
  echo
  echo "  Funciona no mysql mas nao no Prisma  -> falta percent-encoding na"
  echo "     DATABASE_URL (@ vira %40, # vira %23)."
  echo "  Access denied no mysql tambem        -> no painel, confira se o"
  echo "     usuario foi ADICIONADO ao banco com todos os privilegios."
  echo "     Criar banco e criar usuario sao etapas separadas no cPanel."
fi

# ----------------------------------------------------------------
echo
echo "-------------------------------------------------"
echo "FRONTEND  publicado em $DEPLOYPATH"
echo "          https://juridflow.grupoddm.ia.br"
if [ "$MIGRACAO_OK" -eq 1 ]; then
  echo "BANCO     migrations aplicadas"
  echo
  echo "Falta reiniciar a API:"
  echo "  cPanel > Setup Node.js App > Restart Application"
  echo
  echo "Depois confira:"
  echo "  curl https://juridflow.grupoddm.ia.br/api/health"
else
  echo "BANCO     PENDENTE - veja a mensagem acima"
  echo
  echo "O site abre, mas o login vai falhar ate o banco responder."
fi
echo "-------------------------------------------------"

exit 0
