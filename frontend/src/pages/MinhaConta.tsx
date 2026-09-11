import React from 'react';
import { UserCircle, ShieldCheck, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TrocarSenha } from './TrocarSenha';

/**
 * Dados da propria conta e troca de senha voluntaria.
 *
 * Nome, e-mail, cargo e OAB sao somente leitura aqui: quem altera esses
 * campos e o socio, em Configuracoes > Perfis & Permissoes. Deixar a pessoa
 * editar o proprio cargo esvaziaria o requireCargo.
 */

const ROTULO_CARGO: Record<string, string> = {
  socio: 'Sócio',
  advogado: 'Advogado',
  estagiario: 'Estagiário',
  financeiro: 'Financeiro',
};

const ACESSO_POR_CARGO: Record<string, string[]> = {
  socio: [
    'Processos, prazos, captura e documentos',
    'Financeiro e contratos de honorários',
    'Trilha de auditoria LGPD',
    'Gestão da equipe e perfis de acesso',
  ],
  advogado: [
    'Processos, prazos, captura e documentos',
    'Criação de processo e geração de peças',
    'Atendimentos e conversão em processo',
  ],
  estagiario: [
    'Consulta de processos, prazos e andamentos',
    'Tarefas e vínculo de intimações',
    'Disparo de captura DJEN e DataJud',
  ],
  financeiro: [
    'Receitas, despesas e baixa de lançamentos',
    'Contratos de honorários',
    'Consultas gerais do escritório',
  ],
};

export const MinhaConta: React.FC = () => {
  const { usuario } = useAuth();

  if (!usuario) return null;

  const acessos = ACESSO_POR_CARGO[usuario.cargo] ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-blue-600" /> Minha conta
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Seus dados de acesso e troca de senha.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Dados</h3>

            <dl className="space-y-3 text-xs">
              {[
                ['Nome', usuario.nome],
                ['E-mail', usuario.email],
                ['Perfil de acesso', ROTULO_CARGO[usuario.cargo] ?? usuario.cargo],
                ['OAB', usuario.oab || '—'],
                ['Escritório', usuario.tenant?.nome ?? '—'],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500 shrink-0">{rotulo}</dt>
                  <dd className="text-slate-800 font-medium text-right break-words">{valor}</dd>
                </div>
              ))}
            </dl>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Nome, perfil e OAB são alterados pelo sócio administrador, em Configurações →
              Perfis &amp; Permissões. Ninguém altera o próprio perfil de acesso.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600" /> O que seu perfil acessa
            </h3>
            <ul className="space-y-1.5">
              {acessos.map((a) => (
                <li key={a} className="text-xs text-slate-600 flex gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              A permissão é verificada no servidor a cada requisição — esconder um menu não
              é o que protege o dado.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Trocar senha</h3>
          <TrocarSenha />
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Toda ação sua no sistema é registrada na trilha de auditoria do escritório, com
          data, hora e IP — exigência da LGPD. É também por isso que a sua senha deve ser
          conhecida somente por você: a trilha só identifica quem fez o quê se cada pessoa
          tiver a própria credencial.
        </p>
      </div>
    </div>
  );
};
