import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Folder, 
  Download, 
  Sparkles, 
  Copy, 
  Check, 
  Wand2,
  FilePlus
} from 'lucide-react';
import { api } from '../../services/api';
import { DocumentoModel, ModeloPeca } from '../../types';
import { Skeleton } from '../../components/common/Skeleton';

export const Documentos: React.FC = () => {
  const [aba, setAba] = useState<'arquivos' | 'modelos'>('arquivos');
  const [documentos, setDocumentos] = useState<DocumentoModel[]>([]);
  const [modelos, setModelos] = useState<ModeloPeca[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados Gerador de Peças
  const [modeloSelecionado, setModeloSelecionado] = useState<ModeloPeca | null>(null);
  // Campos comecam vazios de proposito.
  //
  // Antes vinham pre-preenchidos com 'Mariana Souza Cruz',
  // '1002345-89.2024.8.26.0100', '4a Vara Civel' e
  // 'TechSolucoes Servicos de Internet Ltda'. Uma peca copiada do gerador sem
  // trocar os campos sairia com nome de cliente e parte contraria inventados,
  // o que num documento juridico e o pior tipo de dado de exemplo possivel.
  const [varNomeCliente, setVarNomeCliente] = useState('');
  const [varProcesso, setVarProcesso] = useState('');
  const [varVara, setVarVara] = useState('');
  const [varComarca, setVarComarca] = useState('');
  const [varContraria, setVarContraria] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [dData, mData] = await Promise.all([
          api.getDocumentos(),
          api.getModelosPeca()
        ]);
        setDocumentos(dData);
        setModelos(mData);
        if (mData.length > 0) {
          setModeloSelecionado(mData[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const gerarTextoSubstituido = (template: string) => {
    return template
      .replace(/\{nome_cliente\}/g, varNomeCliente)
      .replace(/\{numero_processo\}/g, varProcesso)
      .replace(/\{vara\}/g, varVara)
      .replace(/\{comarca\}/g, varComarca)
      .replace(/\{parte_contraria\}/g, varContraria);
  };

  const handleCopiarPeca = () => {
    if (modeloSelecionado) {
      const textoFinal = gerarTextoSubstituido(modeloSelecionado.conteudoComVariaveis);
      navigator.clipboard.writeText(textoFinal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Documentos & Gerador de Peças
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie os arquivos digitais dos autos e crie minutas de petições com variáveis dinâmicas.
          </p>
        </div>

        <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
          <button
            onClick={() => setAba('arquivos')}
            className={`pb-2 border-b-2 transition-colors ${
              aba === 'arquivos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            Arquivos dos Autos
          </button>
          <button
            onClick={() => setAba('modelos')}
            className={`pb-2 border-b-2 transition-colors ${
              aba === 'modelos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            Gerador de Peças (Modelos)
          </button>
        </div>
      </div>

      {aba === 'arquivos' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Nome do Arquivo</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Processo CNJ</th>
                <th className="py-3.5 px-4">Tamanho</th>
                <th className="py-3.5 px-4">Última Modificação</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4"><Skeleton count={3} className="h-10 my-1" /></td>
                </tr>
              ) : (
                documentos.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span>{doc.nome}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{doc.categoria}</td>
                    <td className="py-3.5 px-4 font-mono text-blue-600 font-bold">{doc.processoCnj || 'Geral'}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">{doc.tamanho}</td>
                    <td className="py-3.5 px-4 text-slate-500">{doc.dataModificacao}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Gerador de Peças com Variáveis Dinâmicas */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda: Lista de Modelos & Formulário de Variáveis */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card space-y-3">
              <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-blue-600" /> Selecione o Modelo
              </h3>
              <div className="space-y-2">
                {modelos.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModeloSelecionado(m)}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-xs ${
                      modeloSelecionado?.id === m.id
                        ? 'bg-blue-50/70 border-blue-500 font-semibold text-blue-900 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <p className="font-bold">{m.titulo}</p>
                    <p className="text-[10px] text-slate-500">{m.categoria} • {m.descricao}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Form de Substituição de Tags */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card space-y-3 text-xs">
              <h3 className="font-bold text-xs text-slate-800">Preencher Variáveis Dinâmicas</h3>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">{"{nome_cliente}"}</label>
                  <input
                    type="text"
                    value={varNomeCliente}
                    onChange={(e) => setVarNomeCliente(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">{"{numero_processo}"}</label>
                  <input
                    type="text"
                    value={varProcesso}
                    onChange={(e) => setVarProcesso(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">{"{parte_contraria}"}</label>
                  <input
                    type="text"
                    value={varContraria}
                    onChange={(e) => setVarContraria(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">{"{vara}"}</label>
                    <input
                      type="text"
                      value={varVara}
                      onChange={(e) => setVarVara(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">{"{comarca}"}</label>
                    <input
                      type="text"
                      value={varComarca}
                      onChange={(e) => setVarComarca(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Preview da Minuta Gerada */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" /> Pré-Visualização da Minuta Gerada
                </h3>

                <button
                  onClick={handleCopiarPeca}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiado ? 'Copiado!' : 'Copiar Texto Completo'}</span>
                </button>
              </div>

              {modeloSelecionado ? (
                <div className="mt-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap min-h-[400px]">
                  {gerarTextoSubstituido(modeloSelecionado.conteudoComVariaveis)}
                </div>
              ) : (
                <p className="text-slate-400 text-xs text-center py-10">Nenhum modelo selecionado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

