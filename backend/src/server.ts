import express from 'express';
import cors from 'cors';
import { config } from './lib/config';
import { prisma } from './lib/prisma';
import { serializadorPrisma } from './lib/serialize';
import apiRoutes from './routes';

/**
 * Entrada do backend do JuridFlow.
 *
 * O que saiu daqui nesta versao: 210 linhas de CREATE TABLE em SQL cru,
 * executadas por prisma.$executeRawUnsafe no boot. Aquele bloco era uma
 * segunda definicao do banco, paralela ao schema.prisma e ja divergente dele,
 * escrita em sintaxe SQLite (BOOLEAN DEFAULT 1, DATETIME DEFAULT
 * CURRENT_TIMESTAMP, identificador entre aspas duplas) que o MariaDB rejeita.
 *
 * A estrutura do banco agora vem exclusivamente de prisma/migrations, via
 * `npm run migrate:deploy`. O servidor nao altera schema no boot - fazer DDL
 * na subida do processo significa que dois processos subindo juntos disputam a
 * mesma alteracao.
 */

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // cPanel/Passenger e Nginx ficam na frente

// CORS por lista explicita. Antes era cors() sem argumento, que responde
// Access-Control-Allow-Origin para qualquer origem.
app.use(
  cors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(serializadorPrisma);

/**
 * Healthcheck.
 *
 * Responde em dois caminhos, por motivos diferentes:
 *
 *   /health      so alcancavel de dentro do servidor (127.0.0.1:3001). E o
 *                que o manter-api.sh consulta para decidir se reinicia.
 *
 *   /api/health  alcancavel de fora, pela ponte PHP. Sem isto, conferir a API
 *                pelo navegador devolvia 404 mesmo com tudo funcionando - o
 *                proprio deploy-cpanel.sh mandava conferir este endereco, e a
 *                resposta sempre parecia falha.
 *
 * O publico diz menos: status e hora, nada de nome de servico, ambiente ou
 * estado do banco. Quem monitora de fora precisa saber se esta de pe; nao
 * precisa saber o que ha dentro.
 */
async function bancoResponde(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (erro: any) {
    // O motivo nao vai na resposta - vai no log do servidor. Quem consulta o
    // healthcheck de fora nao precisa da mensagem do driver do banco, e quem
    // esta depurando precisa dela em algum lugar.
    console.error('[JuridFlow] healthcheck: banco inacessivel:', erro?.message ?? erro);
    return false;
  }
}

app.get('/health', async (_req, res) => {
  // Healthcheck que ignora o banco nao serve para nada: o processo pode
  // estar de pe e a aplicacao inteira inoperante.
  const ok = await bancoResponde();
  res.status(ok ? 200 : 503).json({
    status: ok ? 'OK' : 'DEGRADED',
    service: 'JuridFlow Backend API',
    banco: ok ? 'conectado' : 'inacessivel',
    ambiente: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', async (_req, res) => {
  const ok = await bancoResponde();
  res.status(ok ? 200 : 503).json({
    status: ok ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Rota ${req.method} ${req.originalUrl} nao encontrada.` });
});

// Handler final: erro que escapou de um controller nao deve derrubar o
// processo nem vazar stack na resposta.
app.use(
  (
    erro: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[JuridFlow] erro nao tratado:', erro);
    const status = typeof erro?.statusCode === 'number' ? erro.statusCode : 500;
    res.status(status).json({
      message: status < 500 ? erro?.message : 'Erro interno do servidor.',
      ...(config.isProducao ? {} : { detalhe: erro?.message }),
    });
  }
);

async function bootstrap(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[JuridFlow] banco conectado.');
  } catch (error: any) {
    console.error(
      '[JuridFlow] nao foi possivel conectar ao banco. Verifique DATABASE_URL em backend/.env.'
    );
    console.error(error?.message ?? error);
    process.exit(1);
  }

  // Aviso, nao criacao: se o banco esta vazio, a instrucao e rodar as
  // migrations e o seed - nao o servidor improvisar tabela.
  try {
    const tenants = await prisma.tenant.count();
    if (tenants === 0) {
      console.warn(
        '[JuridFlow] nenhum tenant cadastrado. Rode "npm run migrate:deploy" e depois "npm run seed".'
      );
    }
  } catch {
    console.warn(
      '[JuridFlow] tabelas ausentes ou desatualizadas. Rode "npm run migrate:deploy".'
    );
  }

  const server = app.listen(config.port, () => {
    console.log(`[JuridFlow] API em http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(`[JuridFlow] health: http://localhost:${config.port}/health`);
  });

  const encerrar = async (sinal: string) => {
    console.log(`[JuridFlow] ${sinal} recebido, encerrando.`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => void encerrar('SIGTERM'));
  process.on('SIGINT', () => void encerrar('SIGINT'));
}

void bootstrap();

export { app };
