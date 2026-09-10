import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { normalizarDia } from './lib/feriados';

/**
 * Seed do JuridFlow.
 *
 * Cria a ESTRUTURA do escritorio - tenant, usuarios com os quatro perfis,
 * calendario forense e modelos de peca. Nao cria processo, intimacao,
 * andamento nem lancamento financeiro.
 *
 * A versao anterior semeava 5 processos, 3 intimacoes, andamentos, tarefas e
 * lancamentos ficticios. Num sistema que vai receber dado real de escritorio,
 * registro de exemplo no banco de producao e indistinguivel do registro
 * verdadeiro depois do primeiro dia de uso.
 *
 * A senha inicial vem de SEED_ADMIN_PASSWORD. Sem essa variavel o seed para:
 * senha padrao em codigo e a forma mais comum de sistema juridico ficar aberto.
 */

const prisma = new PrismaClient();

interface FeriadoSemente {
  nome: string;
  mes: number;
  dia: number;
  abrangencia: 'estadual' | 'municipal' | 'forense';
  uf?: string;
  municipio?: string;
}

/**
 * Dias sem expediente forense de base, previstos em lei mas que variam por
 * tribunal. Ficam como abrangencia "forense" e o escritorio ajusta na tela
 * de calendario conforme o provimento do seu tribunal.
 */
const FERIADOS_FORENSES: FeriadoSemente[] = [
  { nome: 'Dia do Advogado', mes: 8, dia: 11, abrangencia: 'forense' },
  { nome: 'Dia do Servidor Publico', mes: 10, dia: 28, abrangencia: 'forense' },
  { nome: 'Dia da Justica', mes: 12, dia: 8, abrangencia: 'forense' },
];

/** Feriados estaduais e municipais mais frequentes. Editaveis pela tela. */
const FERIADOS_LOCAIS: FeriadoSemente[] = [
  { nome: 'Revolucao Constitucionalista', mes: 7, dia: 9, abrangencia: 'estadual', uf: 'SP' },
  { nome: 'Aniversario de Sao Paulo', mes: 1, dia: 25, abrangencia: 'municipal', municipio: 'Sao Paulo' },
  { nome: 'Sao Jorge', mes: 4, dia: 23, abrangencia: 'estadual', uf: 'RJ' },
  { nome: 'Sao Sebastiao', mes: 1, dia: 20, abrangencia: 'municipal', municipio: 'Rio de Janeiro' },
  { nome: 'Data Magna de Minas Gerais', mes: 4, dia: 21, abrangencia: 'estadual', uf: 'MG' },
  { nome: 'Revolucao Farroupilha', mes: 9, dia: 20, abrangencia: 'estadual', uf: 'RS' },
  { nome: 'Data Magna da Bahia', mes: 7, dia: 2, abrangencia: 'estadual', uf: 'BA' },
  { nome: 'Data Magna do Parana', mes: 12, dia: 19, abrangencia: 'estadual', uf: 'PR' },
];

const MODELOS_PECA = [
  {
    titulo: 'Procuracao ad judicia',
    categoria: 'Procuracao',
    conteudo: `PROCURACAO AD JUDICIA ET EXTRA

OUTORGANTE: {nome_cliente}

OUTORGADO: {advogado_nome}, advogado inscrito na OAB sob o n. {advogado_oab},
com escritorio em {escritorio_nome}.

PODERES: pelo presente instrumento, o outorgante nomeia e constitui seu
bastante procurador o outorgado, a quem confere os poderes da clausula ad
judicia et extra, para o foro em geral, podendo propor as acoes competentes e
defender nas contrarias, transigir, desistir, firmar compromissos, receber e
dar quitacao, substabelecer com ou sem reserva de poderes, praticando todos os
demais atos necessarios ao fiel cumprimento deste mandato.

{comarca}, {data_hoje}.


_______________________________________
{nome_cliente}`,
  },
  {
    titulo: 'Peticao intermediaria - juntada de documentos',
    categoria: 'Peticao Intermediaria',
    conteudo: `EXCELENTISSIMO SENHOR DOUTOR JUIZ DE DIREITO DA {vara} DA COMARCA DE {comarca}

Processo n. {numero_processo}

{nome_cliente}, ja qualificado nos autos do processo em epigrafe, por seu
advogado que ao final subscreve, vem respeitosamente a presenca de Vossa
Excelencia requerer a juntada dos documentos anexos, que instruem o pedido
formulado.

Requer, ainda, que as futuras intimacoes sejam dirigidas ao subscritor.

Termos em que pede deferimento.

{comarca}, {data_hoje}.


{advogado_nome}
OAB {advogado_oab}`,
  },
  {
    titulo: 'Contestacao - modelo base',
    categoria: 'Contestacao',
    conteudo: `EXCELENTISSIMO SENHOR DOUTOR JUIZ DE DIREITO DA {vara} DA COMARCA DE {comarca}

Processo n. {numero_processo}
Valor da causa: {valor_causa}

{nome_cliente}, ja qualificado, por seu advogado, vem apresentar

CONTESTACAO

aos termos da acao proposta, pelos fatos e fundamentos a seguir expostos.

I - DOS FATOS

[descrever]

II - DO DIREITO

[fundamentar]

III - DOS PEDIDOS

Ante o exposto, requer a improcedencia integral dos pedidos formulados na
inicial, com a condenacao da parte autora ao pagamento das custas processuais
e dos honorarios advocaticios de sucumbencia.

Protesta por todos os meios de prova em direito admitidos.

Termos em que pede deferimento.

{comarca}, {data_hoje}.


{advogado_nome}
OAB {advogado_oab}`,
  },
  {
    titulo: 'Recurso de apelacao - modelo base',
    categoria: 'Recurso',
    conteudo: `EXCELENTISSIMO SENHOR DOUTOR JUIZ DE DIREITO DA {vara} DA COMARCA DE {comarca}

Processo n. {numero_processo}

{nome_cliente}, por seu advogado, inconformado com a r. sentenca proferida nos
autos, vem interpor

RECURSO DE APELACAO

com fundamento no art. 1.009 do Codigo de Processo Civil, pelas razoes anexas,
requerendo o recebimento e a remessa ao {orgao} para julgamento.

Termos em que pede deferimento.

{comarca}, {data_hoje}.


{advogado_nome}
OAB {advogado_oab}`,
  },
];

function senhaInicial(): string {
  const senha = process.env.SEED_ADMIN_PASSWORD;
  if (!senha || senha.length < 10) {
    console.error(
      '\n[seed] SEED_ADMIN_PASSWORD ausente ou com menos de 10 caracteres.\n\n' +
        'Defina uma senha inicial antes de rodar o seed:\n\n' +
        '  Windows (PowerShell):  $env:SEED_ADMIN_PASSWORD = "<senha forte>"\n' +
        '  Linux/macOS:           export SEED_ADMIN_PASSWORD="<senha forte>"\n\n' +
        'Cada usuario deve trocar a senha no primeiro acesso.\n'
    );
    process.exit(1);
  }
  return senha;
}

async function main(): Promise<void> {
  const senha = senhaInicial();
  const nomeEscritorio = process.env.SEED_TENANT_NOME || 'Escritorio JuridFlow';
  const cnpj = process.env.SEED_TENANT_CNPJ || null;
  const dominio = (process.env.SEED_EMAIL_DOMINIO || 'juridflow.local').toLowerCase();

  console.log('[seed] iniciando.');

  const tenantExistente = await prisma.tenant.findFirst();
  if (tenantExistente) {
    console.log(
      `[seed] ja existe o tenant "${tenantExistente.nome}". ` +
        'O seed nao sobrescreve dado existente - nada foi alterado.'
    );
    return;
  }

  const tenant = await prisma.tenant.create({
    data: { nome: nomeEscritorio, cnpj },
  });
  console.log(`[seed] tenant criado: ${tenant.nome}`);

  const hash = await bcrypt.hash(senha, 12);

  const usuarios = [
    { nome: 'Socio Administrador', email: `socio@${dominio}`, cargo: 'socio', oab: null },
    { nome: 'Advogado', email: `advogado@${dominio}`, cargo: 'advogado', oab: null },
    { nome: 'Estagiario', email: `estagiario@${dominio}`, cargo: 'estagiario', oab: null },
    { nome: 'Financeiro', email: `financeiro@${dominio}`, cargo: 'financeiro', oab: null },
  ];

  for (const u of usuarios) {
    await prisma.user.create({
      data: { tenant_id: tenant.id, nome: u.nome, email: u.email, senha: hash, cargo: u.cargo, oab: u.oab },
    });
    console.log(`[seed] usuario ${u.cargo}: ${u.email}`);
  }

  // Calendario forense: ano corrente e os dois seguintes. Linhas globais
  // (tenant_id null) para valerem em qualquer escritorio da instalacao.
  const anoBase = new Date().getUTCFullYear();
  const anos = [anoBase, anoBase + 1, anoBase + 2];
  const linhasFeriado: Array<Record<string, unknown>> = [];

  for (const ano of anos) {
    for (const f of [...FERIADOS_FORENSES, ...FERIADOS_LOCAIS]) {
      linhasFeriado.push({
        tenant_id: null,
        nome: f.nome,
        data: normalizarDia(
          `${ano}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`
        ),
        abrangencia: f.abrangencia,
        uf: f.uf ?? null,
        municipio: f.municipio ?? null,
        orgao: null,
      });
    }
  }

  await prisma.feriado.createMany({ data: linhasFeriado as any });
  console.log(
    `[seed] ${linhasFeriado.length} feriados locais/forenses cadastrados (${anos.join(', ')}).`
  );
  console.log(
    '[seed] feriados nacionais e recesso do art. 220 sao calculados em lib/feriados.ts - nao vao para o banco.'
  );

  await prisma.modeloDocumento.createMany({
    data: MODELOS_PECA.map((m) => ({
      tenant_id: tenant.id,
      titulo: m.titulo,
      categoria: m.categoria,
      conteudo_template_com_variaveis: m.conteudo,
    })),
  });
  console.log(`[seed] ${MODELOS_PECA.length} modelos de peca cadastrados.`);

  console.log('\n[seed] concluido.');
  console.log('[seed] proximos passos no sistema:');
  console.log('  1. logar como socio@' + dominio + ' e trocar as senhas da equipe');
  console.log('  2. cadastrar a OAB do escritorio em Central de Captura > Franquia');
  console.log('  3. conferir o calendario forense do seu tribunal na tela de Feriados');
  console.log('  4. cadastrar os processos, ou importar via consulta ao DataJud\n');
}

main()
  .catch((erro) => {
    console.error('[seed] falhou:', erro);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
