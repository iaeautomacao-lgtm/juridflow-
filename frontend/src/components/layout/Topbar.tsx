import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Bell,
  User,
  ChevronDown,
  Building2,
  UserCheck,
  CheckCircle2,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { cx } from '../ui';

/**
 * Barra superior.
 *
 * Duas correcoes de comportamento junto com o visual:
 *
 *   1. Os menus suspensos (Novo, notificacoes) so fechavam clicando no proprio
 *      botao. Clicar fora, apertar Esc ou abrir o outro menu deixava os dois
 *      abertos sobrepostos. Agora fecham por clique fora e por Esc.
 *   2. O ponto vermelho do sino ja acendia por notificacao fixa no codigo -
 *      "Nova intimacao DJEN / Processo 1002345-89.2024.8.26.0100" aparecia num
 *      sistema recem instalado, sem um unico processo. Os avisos vem de
 *      contagem real desde entao; mantido.
 *
 * Os dados do usuario vem da sessao. Este cabecalho ja teve 'GO',
 * 'Dra. Gisele Oliveira' e 'OAB/SP 432.109' escritos no codigo, exibidos para
 * quem quer que estivesse logado.
 */

interface Aviso {
  tom: 'marca' | 'atencao' | 'erro';
  titulo: string;
  detalhe: string;
}

const PONTO_AVISO: Record<Aviso['tom'], string> = {
  marca: 'bg-marca',
  atencao: 'bg-atencao',
  erro: 'bg-erro',
};

const ROTULO_CARGO: Record<string, string> = {
  socio: 'Sócio',
  advogado: 'Advogado',
  estagiario: 'Estagiário',
  financeiro: 'Financeiro',
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface TopbarProps {
  onOpenIA: () => void;
  onQuickAction: (action: string) => void;
}

type MenuAberto = 'novo' | 'avisos' | null;

export const Topbar: React.FC<TopbarProps> = ({ onQuickAction }) => {
  const { usuario } = useAuth();
  const [modo, setModo] = useState<'escritorio' | 'pessoal'>('escritorio');
  const [busca, setBusca] = useState('');
  const [menu, setMenu] = useState<MenuAberto>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const areaMenus = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const kpis = await api.getDashboardKpis();
        if (!ativo) return;

        const lista: Aviso[] = [];

        if (kpis?.intimacoes?.pendentes > 0) {
          lista.push({
            tom: 'marca',
            titulo: `${kpis.intimacoes.pendentes} intimação(ões) pendente(s)`,
            detalhe: 'Vincular ao processo e abrir o prazo',
          });
        }
        if (kpis?.intimacoes?.sem_processo > 0) {
          lista.push({
            tom: 'marca',
            titulo: `${kpis.intimacoes.sem_processo} intimação(ões) sem processo cadastrado`,
            detalhe: 'Cadastrar o processo para poder vincular',
          });
        }
        if (kpis?.tarefas?.atrasadas > 0) {
          lista.push({
            tom: 'erro',
            titulo: `${kpis.tarefas.atrasadas} tarefa(s) em atraso`,
            detalhe: 'O vencimento já passou',
          });
        }
        if (kpis?.andamentos?.nao_lidos > 0) {
          lista.push({
            tom: 'atencao',
            titulo: `${kpis.andamentos.nao_lidos} andamento(s) não lido(s)`,
            detalhe: 'Capturados do DataJud',
          });
        }
        if (kpis?.certificados?.vencendo_em_30_dias > 0) {
          lista.push({
            tom: 'atencao',
            titulo: `${kpis.certificados.vencendo_em_30_dias} certificado(s) vencendo`,
            detalhe: 'Nos próximos 30 dias',
          });
        }

        setAvisos(lista);
      } catch {
        // O ApiErrorBanner ja mostrou a falha da requisicao; o sino fica sem
        // avisos em vez de exibir numero inventado.
        if (ativo) setAvisos([]);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  // Fecha por clique fora e por Esc.
  useEffect(() => {
    if (!menu) return;

    function aoClicar(e: MouseEvent) {
      if (areaMenus.current && !areaMenus.current.contains(e.target as Node)) setMenu(null);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(null);
    }

    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menu]);

  const itensNovo = [
    { acao: 'novo-processo', icone: Briefcase, texto: 'Novo processo' },
    { acao: 'nova-tarefa', icone: CheckCircle2, texto: 'Nova tarefa / prazo' },
    { acao: 'novo-atendimento', icone: User, texto: 'Novo atendimento CRM' },
    { acao: 'novo-financeiro', icone: DollarSign, texto: 'Lançamento financeiro' },
  ];

  return (
    <header className="h-16 shrink-0 bg-superficie-alta border-b border-borda px-6 max-[860px]:px-4 flex items-center gap-4 sticky top-0 z-10">
      {/* Escopo. Ainda nao filtra nada: a separacao entre carteira pessoal e
          do escritorio depende de responsavel por processo, que o backend
          ainda nao expoe. Ver DOCUMENTACAO.md - pendencias. */}
      <div className="flex items-center p-1 rounded-lg bg-superficie-sutil max-[1100px]:hidden">
        {(
          [
            ['escritorio', Building2, 'Escritório'],
            ['pessoal', UserCheck, 'Pessoal'],
          ] as const
        ).map(([valor, Icone, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setModo(valor)}
            aria-pressed={modo === valor}
            className={cx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] transition-colors',
              modo === valor
                ? 'bg-superficie-alta text-marca font-semibold shadow-card'
                : 'text-texto-suave hover:text-texto'
            )}
          >
            <Icone className="w-3.5 h-3.5" aria-hidden="true" />
            {texto}
          </button>
        ))}
      </div>

      {/* Busca global */}
      <div className="relative flex-1 max-w-[430px]">
        <Search
          className="w-3.5 h-3.5 text-texto-fraco absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Busca global"
          placeholder="Buscar processos, clientes, intimações ou tarefas..."
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-borda bg-superficie text-xs text-texto placeholder:text-texto-fraco transition-colors focus:bg-superficie-alta focus:border-marca focus:ring-2 focus:ring-marca/15"
        />
      </div>

      <div ref={areaMenus} className="ml-auto flex items-center gap-2">
        {/* Novo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === 'novo' ? null : 'novo')}
            aria-expanded={menu === 'novo'}
            aria-haspopup="menu"
            className="h-9 px-3.5 rounded-lg bg-marca hover:bg-marca-escura text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="max-[640px]:hidden">Novo</span>
            <ChevronDown className="w-3 h-3 opacity-80" aria-hidden="true" />
          </button>

          {menu === 'novo' && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-xl border border-borda bg-superficie-alta shadow-menu py-1 z-30"
            >
              {itensNovo.map(({ acao, icone: Icone, texto }) => (
                <button
                  key={acao}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    onQuickAction(acao);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-texto hover:bg-superficie-sutil transition-colors"
                >
                  <Icone className="w-4 h-4 text-texto-suave" aria-hidden="true" />
                  {texto}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Avisos */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === 'avisos' ? null : 'avisos')}
            aria-expanded={menu === 'avisos'}
            aria-label={
              avisos.length > 0
                ? `Avisos: ${avisos.length} item(ns) precisam de atenção`
                : 'Avisos: nada pendente'
            }
            className="relative w-9 h-9 rounded-lg border border-borda bg-superficie-alta text-texto-suave grid place-items-center hover:bg-superficie-sutil transition-colors"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
            {avisos.length > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-erro ring-2 ring-superficie-alta"
              />
            )}
          </button>

          {menu === 'avisos' && (
            <div className="absolute right-0 mt-2 w-80 max-[420px]:w-[calc(100vw-2rem)] rounded-xl border border-borda bg-superficie-alta shadow-menu p-4 z-30">
              <p className="text-xs font-bold text-texto pb-2 border-b border-borda">
                O que precisa de atenção
              </p>

              <div className="mt-3 space-y-3">
                {avisos.length === 0 ? (
                  <p className="text-[11px] text-texto-suave">
                    Nada pendente: worklist limpa e nenhuma tarefa em atraso.
                  </p>
                ) : (
                  avisos.map((aviso, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span
                        aria-hidden="true"
                        className={cx(
                          'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                          PONTO_AVISO[aviso.tom]
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-texto">{aviso.titulo}</p>
                        <p className="text-[11px] text-texto-suave">{aviso.detalhe}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Identificacao da sessao */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-borda max-[1100px]:hidden">
          <div className="w-9 h-9 rounded-lg bg-marca-escura text-white grid place-items-center text-[11px] font-bold">
            {usuario ? iniciais(usuario.nome) : '?'}
          </div>
          <div className="max-[1280px]:hidden">
            <p className="text-[11px] font-semibold text-texto leading-tight">
              {usuario?.nome ?? ''}
            </p>
            <p className="text-[10px] text-texto-suave mt-0.5">
              {usuario?.oab ? `OAB ${usuario.oab}` : usuario ? ROTULO_CARGO[usuario.cargo] : ''}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
