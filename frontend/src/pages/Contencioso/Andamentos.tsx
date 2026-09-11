import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Gavel, Radar, PenLine, CheckCheck, Check, Sparkles, Inbox, SearchX } from 'lucide-react';
import { api } from '../../services/api';
import { Andamento } from '../../types';
import { siglaTribunal, formatarCnj } from '../../lib/cnj';
import { ApiError } from '../../services/http';
import { Skeleton } from '../../components/common/Skeleton';
import {
  PageHeader,
  FilterBar,
  CampoBusca,
  Seletor,
  StatCard,
  StatGrid,
  Painel,
  PainelCabecalho,
  GrupoData,
  LinhaLista,
  Badge,
  Botao,
  EmptyState,
  ErrorState,
} from '../../components/ui';

/**
 * Andamentos processuais.
 *
 * Tres defeitos de comportamento corrigidos junto com o desenho:
 *
 *   1. "Marcar como lido" so mexia no estado do React. A rota
 *      PATCH /andamentos/:id/lido existia e nunca era chamada - ao recarregar
 *      a pagina, tudo voltava a aparecer como nao lido. Agora grava, com
 *      reversao na tela se o servidor recusar.
 *   2. Falha de carregamento caia num console.error e a tela renderizava a
 *      lista vazia. Quem olhasse concluiria que nao ha movimentacao nenhuma,
 *      quando na verdade a API estava fora. Vazio e erro agora sao telas
 *      diferentes.
 *   3. O rotulo de origem vinha de um ternario que marcava todo andamento
 *      manual como "TJSP". O tribunal agora sai do proprio numero CNJ.
 *
 * O agrupamento por dia e o eixo da tela: a pergunta de quem abre Andamentos
 * e "o que entrou hoje", nao "quais sao os 200 ultimos".
 */

interface AndamentosProps {
  onOpenIA: () => void;
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const MS_DIA = 86_400_000;

const DIA_POR_EXTENSO = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const DIA_CURTO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function paraData(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function rotuloDoGrupo(d: Date): string {
  const distancia = Math.round((inicioDoDia(new Date()) - inicioDoDia(d)) / MS_DIA);
  const completa = DIA_POR_EXTENSO.format(d);
  if (distancia === 0) return `Hoje · ${completa}`;
  if (distancia === 1) return `Ontem · ${completa}`;
  return completa;
}

function tempoRelativo(d: Date): string {
  const segundos = Math.floor((Date.now() - d.getTime()) / 1000);
  // Data futura (relogio do tribunal adiantado, importacao com fuso errado):
  // "Ha -3 minutos" seria pior do que mostrar a data.
  if (segundos < 0) return DIA_CURTO.format(d);
  if (segundos < 60) return 'Agora há pouco';

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Há ${minutos} minuto${minutos > 1 ? 's' : ''}`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Há ${horas} hora${horas > 1 ? 's' : ''}`;

  const dias = Math.floor(horas / 24);
  if (dias < 30) return `Há ${dias} dia${dias > 1 ? 's' : ''}`;

  return DIA_CURTO.format(d);
}

// ---------------------------------------------------------------------------
// Origem do registro
// ---------------------------------------------------------------------------

const FONTE = {
  djen: { icone: Gavel, tom: 'marca' as const, texto: 'DJEN' },
  datajud: { icone: Radar, tom: 'marca' as const, texto: 'DataJud' },
  manual: { icone: PenLine, tom: 'neutro' as const, texto: 'Manual' },
};

const PERIODOS = [
  { valor: 'tudo', texto: 'Todo o período', dias: null },
  { valor: 'hoje', texto: 'Hoje', dias: 0 },
  { valor: '7', texto: 'Últimos 7 dias', dias: 7 },
  { valor: '30', texto: 'Últimos 30 dias', dias: 30 },
];

interface AndamentoNaTela extends Andamento {
  data: Date | null;
  sigla: string | null;
}

export const Andamentos: React.FC<AndamentosProps> = ({ onOpenIA }) => {
  const [andamentos, setAndamentos] = useState<Andamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marcandoTodos, setMarcandoTodos] = useState(false);

  const [busca, setBusca] = useState('');
  const [tribunal, setTribunal] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [periodo, setPeriodo] = useState('tudo');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setAndamentos(await api.getAndamentos());
    } catch (e) {
      const mensagem =
        e instanceof ApiError
          ? e.message
          : 'Erro inesperado ao buscar os andamentos. Tente novamente em instantes.';
      setErro(mensagem);
      setAndamentos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Grava no servidor e reverte a tela se a gravacao falhar. */
  const marcarLido = useCallback(async (id: string) => {
    setAndamentos((prev) => prev.map((a) => (a.id === id ? { ...a, lido: true } : a)));
    try {
      await api.marcarAndamentoLido(id);
    } catch {
      // O ApiErrorBanner ja anuncia a falha; aqui so desfaz para a tela nao
      // mentir que o registro foi baixado.
      setAndamentos((prev) => prev.map((a) => (a.id === id ? { ...a, lido: false } : a)));
    }
  }, []);

  const enriquecidos: AndamentoNaTela[] = useMemo(
    () =>
      andamentos.map((a) => ({
        ...a,
        data: paraData(a.dataHora),
        sigla: siglaTribunal(a.cnj),
      })),
    [andamentos]
  );

  const tribunais = useMemo(() => {
    const vistos = new Set<string>();
    enriquecidos.forEach((a) => a.sigla && vistos.add(a.sigla));
    return Array.from(vistos).sort();
  }, [enriquecidos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const dias = PERIODOS.find((p) => p.valor === periodo)?.dias ?? null;
    const corte = dias === null ? null : inicioDoDia(new Date()) - dias * MS_DIA;

    return enriquecidos.filter((a) => {
      if (status === 'nao-lidos' && a.lido) return false;
      if (status === 'lidos' && !a.lido) return false;
      if (tribunal !== 'todos' && a.sigla !== tribunal) return false;
      if (corte !== null && (!a.data || a.data.getTime() < corte)) return false;

      if (termo) {
        const alvo = [a.cnj, a.tipo, a.descricao, a.orgao, a.cliente, a.sigla ?? '']
          .join(' ')
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [enriquecidos, busca, tribunal, status, periodo]);

  /** Preserva a ordem que veio do backend (data desc) dentro de cada dia. */
  const grupos = useMemo(() => {
    const mapa = new Map<string, { rotulo: string; itens: AndamentoNaTela[] }>();

    filtrados.forEach((a) => {
      const chave = a.data ? String(inicioDoDia(a.data)) : 'sem-data';
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          rotulo: a.data ? rotuloDoGrupo(a.data) : 'Sem data registrada',
          itens: [],
        });
      }
      mapa.get(chave)!.itens.push(a);
    });

    return Array.from(mapa.values());
  }, [filtrados]);

  const indicadores = useMemo(() => {
    const hoje = inicioDoDia(new Date());
    return {
      novosHoje: enriquecidos.filter((a) => a.data && inicioDoDia(a.data) === hoje).length,
      naoLidos: enriquecidos.filter((a) => !a.lido).length,
      processos: new Set(enriquecidos.map((a) => a.processoId).filter(Boolean)).size,
      capturados: enriquecidos.filter((a) => a.fonte !== 'manual').length,
    };
  }, [enriquecidos]);

  const naoLidosVisiveis = filtrados.filter((a) => !a.lido);

  /**
   * Baixa em lote o que esta visivel no filtro atual - nao a base inteira.
   * Nao ha rota de lote no backend, entao sao N requisicoes; por isso o
   * escopo e o da tela, e nao os 200 registros carregados.
   */
  async function marcarTodosVisiveis() {
    if (naoLidosVisiveis.length === 0) return;
    setMarcandoTodos(true);

    const ids = naoLidosVisiveis.map((a) => a.id);
    setAndamentos((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, lido: true } : a)));

    const resultados = await Promise.allSettled(ids.map((id) => api.marcarAndamentoLido(id)));
    const falhas = new Set(ids.filter((_, i) => resultados[i].status === 'rejected'));

    if (falhas.size > 0) {
      setAndamentos((prev) => prev.map((a) => (falhas.has(a.id) ? { ...a, lido: false } : a)));
    }
    setMarcandoTodos(false);
  }

  const filtroAtivo =
    busca.trim() !== '' || tribunal !== 'todos' || status !== 'todos' || periodo !== 'tudo';

  function limparFiltros() {
    setBusca('');
    setTribunal('todos');
    setStatus('todos');
    setPeriodo('tudo');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        trilha={['Contencioso', 'Andamentos']}
        titulo="Andamentos Processuais"
        descricao="Movimentações capturadas do DJEN e do DataJud, e lançamentos manuais da equipe."
        acoes={
          <Botao
            variante="secundario"
            icone={CheckCheck}
            onClick={marcarTodosVisiveis}
            carregando={marcandoTodos}
            disabled={naoLidosVisiveis.length === 0}
            title={
              naoLidosVisiveis.length === 0
                ? 'Nenhum andamento não lido no filtro atual'
                : 'Marca como lidos apenas os andamentos visíveis neste filtro'
            }
          >
            {naoLidosVisiveis.length > 0
              ? `Marcar ${naoLidosVisiveis.length} como lidos`
              : 'Marcar como lidos'}
          </Botao>
        }
      />

      <StatGrid>
        <StatCard rotulo="Novos hoje" valor={indicadores.novosHoje} detalhe="Movimentações do dia" />
        <StatCard
          rotulo="Não lidos"
          valor={indicadores.naoLidos}
          detalhe="Aguardando conferência"
          tom={indicadores.naoLidos > 0 ? 'atencao' : 'neutro'}
        />
        <StatCard
          rotulo="Processos com movimento"
          valor={indicadores.processos}
          detalhe="No período carregado"
        />
        <StatCard
          rotulo="Capturados"
          valor={indicadores.capturados}
          detalhe="DJEN e DataJud, sem digitação"
        />
      </StatGrid>

      <FilterBar>
        <CampoBusca
          valor={busca}
          onChange={setBusca}
          rotulo="Buscar andamento"
          placeholder="Buscar por número CNJ, cliente, vara ou termo do andamento..."
        />
        <Seletor
          valor={tribunal}
          onChange={setTribunal}
          rotulo="Filtrar por tribunal"
          opcoes={[
            { valor: 'todos', texto: 'Todos os tribunais' },
            ...tribunais.map((t) => ({ valor: t, texto: t })),
          ]}
        />
        <Seletor
          valor={status}
          onChange={setStatus}
          rotulo="Filtrar por status"
          opcoes={[
            { valor: 'todos', texto: 'Todos os status' },
            { valor: 'nao-lidos', texto: 'Não lidos' },
            { valor: 'lidos', texto: 'Lidos' },
          ]}
        />
        <Seletor
          valor={periodo}
          onChange={setPeriodo}
          rotulo="Filtrar por período"
          opcoes={PERIODOS.map((p) => ({ valor: p.valor, texto: p.texto }))}
        />
      </FilterBar>

      <Painel>
        <PainelCabecalho
          titulo="Movimentações"
          contagem={
            carregando
              ? undefined
              : `${filtrados.length} ${filtrados.length === 1 ? 'registro' : 'registros'}`
          }
        />

        {carregando ? (
          <div className="p-4 space-y-3">
            <Skeleton count={5} className="h-[74px] rounded-lg" />
          </div>
        ) : erro ? (
          <ErrorState mensagem={erro} onTentarNovamente={() => void carregar()} />
        ) : filtrados.length === 0 ? (
          filtroAtivo ? (
            <EmptyState
              icone={SearchX}
              titulo="Nenhum andamento com esses filtros"
              descricao="Nenhuma movimentação corresponde à busca, ao tribunal, ao status ou ao período selecionados."
              acao={
                <Botao variante="secundario" tamanho="sm" onClick={limparFiltros}>
                  Limpar filtros
                </Botao>
              }
            />
          ) : (
            <EmptyState
              icone={Inbox}
              titulo="Nenhum andamento registrado"
              descricao="As movimentações aparecem aqui assim que a captura do DJEN ou do DataJud rodar para os processos cadastrados."
            />
          )
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.rotulo}>
              <GrupoData>{grupo.rotulo}</GrupoData>

              {grupo.itens.map((item) => {
                const fonte = FONTE[item.fonte];
                const titulo = item.tipo || item.descricao || 'Movimentação sem descrição';
                const detalhe = item.descricao && item.descricao !== titulo ? item.descricao : null;
                const contexto = [item.orgao, item.cliente].filter(Boolean).join(' · ');

                return (
                  <LinhaLista
                    key={item.id}
                    icone={fonte.icone}
                    tomIcone={fonte.tom}
                    etiqueta={item.sigla ?? undefined}
                    destaque={!item.lido}
                    badges={
                      <>
                        {!item.lido && <Badge tom="novo">Novo</Badge>}
                        <Badge tom="neutro">{fonte.texto}</Badge>
                        {/*
                          Slot do prazo. O Andamento ainda nao tem vinculo com
                          Tarefa no schema, entao nao ha como saber se esta
                          movimentacao abriu prazo. Quando o campo existir:
                          {item.abrePrazo && <Badge tom="prazo">Prazo</Badge>}
                        */}
                      </>
                    }
                    identificador={item.cnj ? formatarCnj(item.cnj) : undefined}
                    titulo={titulo}
                    meta={
                      (detalhe || contexto) && (
                        <>
                          {detalhe && <span className="block">{detalhe}</span>}
                          {contexto && <span className="block mt-0.5">{contexto}</span>}
                        </>
                      )
                    }
                    tempo={item.data ? tempoRelativo(item.data) : undefined}
                    acoes={
                      <>
                        <Botao variante="sutil" tamanho="sm" icone={Sparkles} onClick={onOpenIA}>
                          Analisar
                        </Botao>
                        {!item.lido && (
                          <Botao
                            variante="sutil"
                            tamanho="sm"
                            icone={Check}
                            onClick={() => void marcarLido(item.id)}
                            aria-label={`Marcar como lido: ${titulo}`}
                            title="Marcar como lido"
                          />
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          ))
        )}
      </Painel>
    </div>
  );
};
