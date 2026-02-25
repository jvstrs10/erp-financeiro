import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowUpCircle, ArrowDownCircle, Wallet, Plus, Trash2, Calendar,
  Tag, AlignLeft, Filter, CheckCircle2, Circle, Upload, X, FileText,
  AlertCircle, Landmark, Wand2, LayoutDashboard, ListOrdered, 
  Settings, Download, UploadCloud, PieChart, Briefcase, Clock,
  CheckSquare, Square, ChevronRight, FileSpreadsheet, Play, Save, Pencil, Paperclip,
  FileDown, BarChart, Target, Scale, ShieldAlert, FileCheck, LogOut, Building2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useERP } from '../hooks/useERP';

// --- UTILITÁRIOS ---
const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
const formatarData = (dataStr) => {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
};

const formatarDescricaoEDocumento = (descricao) => {
  if (!descricao) return { texto: '', doc: null };
  const regex = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\b/;
  const match = descricao.match(regex);
  if (match) {
    const doc = match[1];
    let textoLimpo = descricao.replace(doc, '').replace(/\s+-\s*$/, '').replace(/\s*-\s*-/, '-').trim();
    if (textoLimpo.endsWith('-')) textoLimpo = textoLimpo.slice(0, -1).trim();
    return { texto: textoLimpo, doc };
  }
  return { texto: descricao, doc: null };
};

const stringSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const editDistance = (s1, s2) => {
    s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };
  return (longer.length - editDistance(longer, shorter)) / longer.length;
};

export default function App() {
  const { perfil, empresa, logout } = useAuth();
  const {
    transacoes, contasPagar, contasReceber,
    contas, categorias, centrosCusto, regras, carregando,
    adicionarTransacao, atualizarTransacao, apagarTransacao, importarTransacoes,
    adicionarContaPagar, liquidarContaPagar, apagarContaPagar,
    adicionarContaReceber, liquidarContaReceber, apagarContaReceber,
    adicionarCategoria, removerCategoria, editarCategoria,
    adicionarRegra, apagarRegra,
  } = useERP();

  useEffect(() => {
    if (!window.XLSX) {
      const s = document.createElement('script');
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.head.appendChild(s);
    }
    if (!window.html2pdf) {
      const s2 = document.createElement('script');
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.head.appendChild(s2);
    }
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [hoje] = useState(new Date().toISOString().split('T')[0]);
  const [filtroDataInicio, setFiltroDataInicio] = useState(new Date().getFullYear() + '-01-01');
  const [filtroDataFim, setFiltroDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [filtroConta, setFiltroConta] = useState('Todas');
  const [filtroDocumento, setFiltroDocumento] = useState('Todas');
  const [showModal, setShowModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [abaInterna, setAbaInterna] = useState('pendentes');
  const [novaCatEntrada, setNovaCatEntrada] = useState('');
  const [novaCatSaida, setNovaCatSaida] = useState('');
  const [expandedDescId, setExpandedDescId] = useState(null);
  const [visualizarComprovante, setVisualizarComprovante] = useState(null);
  const [uploadingComprovanteId, setUploadingComprovanteId] = useState(null);
  const [justificativaTargetId, setJustificativaTargetId] = useState(null);
  const [justificativaText, setJustificativaText] = useState('');
  const [relatorioInicio, setRelatorioInicio] = useState(new Date().getFullYear() + '-01-01');
  const [relatorioFim, setRelatorioFim] = useState(new Date().toISOString().split('T')[0]);
  const [dragActive, setDragActive] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importStats, setImportStats] = useState({ novas: 0, duplicadas: 0, viaRegras: 0 });
  const [saldoOficialBanco, setSaldoOficialBanco] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const fileInputRef = useRef(null);
  const comprovanteInputRef = useRef(null);

  // --- DERIVAÇÕES ---
  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter(t =>
      t.data >= filtroDataInicio &&
      t.data <= filtroDataFim &&
      (filtroConta === 'Todas' || t.conta === filtroConta || t.conta_id === filtroConta) &&
      (filtroDocumento === 'Todas' ||
        (filtroDocumento === 'SemDoc' && t.tipo === 'saida' && !t.comprovante && !t.justificativa) ||
        (filtroDocumento === 'ComDoc' && (t.comprovante || t.justificativa || t.tipo === 'entrada'))
      )
    ).sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [transacoes, filtroDataInicio, filtroDataFim, filtroConta, filtroDocumento]);

  const dashboardPeriodo = useMemo(() => {
    const despesasBase = transacoes.filter(t => t.data >= filtroDataInicio && t.data <= filtroDataFim && t.tipo === 'saida');
    const despesasDoc = despesasBase.filter(t => t.comprovante || t.justificativa);
    const taxaConformidade = despesasBase.length > 0 ? Math.round((despesasDoc.length / despesasBase.length) * 100) : 100;
    const totais = transacoesFiltradas.reduce((acc, t) => {
      if (t.tipo === 'entrada') acc.entradas += Number(t.valor);
      else acc.saidas += Number(t.valor);
      return acc;
    }, { entradas: 0, saidas: 0 });
    return { ...totais, taxaConformidade, faltaDoc: despesasBase.length - despesasDoc.length };
  }, [transacoesFiltradas, transacoes, filtroDataInicio, filtroDataFim]);

  const dashboardAcumulado = useMemo(() => {
    return transacoes.filter(t => filtroConta === 'Todas' || t.conta === filtroConta || t.conta_id === filtroConta)
      .reduce((acc, t) => {
        if (t.tipo === 'entrada') acc.entradas += Number(t.valor);
        else acc.saidas += Number(t.valor);
        return acc;
      }, { entradas: 0, saidas: 0 });
  }, [transacoes, filtroConta]);

  const processarVencimentos = (lista) => {
    const dados = { pendentes: [], pagas: [], vencidas: [] };
    lista.forEach(item => {
      if (item.status === 'pago' || item.status === 'recebido') { dados.pagas.push(item); return; }
      const venc = new Date(item.vencimento + 'T00:00:00');
      const hojeDate = new Date(hoje + 'T00:00:00');
      const diffDias = Math.floor((venc - hojeDate) / (1000 * 60 * 60 * 24));
      if (diffDias < 0) dados.vencidas.push({ ...item, diasAtraso: Math.abs(diffDias) });
      else dados.pendentes.push({ ...item, diasAtraso: diffDias });
    });
    return dados;
  };

  const aPagarProc = processarVencimentos(contasPagar);
  const aReceberProc = processarVencimentos(contasReceber);

  // --- AÇÕES ---
  const mostrarErro = (msg) => { setErro(msg); setTimeout(() => setErro(''), 5000); };

  const alterarCategoriaTransacao = async (id, novaCategoria) => {
    try { await atualizarTransacao(id, { categoria: novaCategoria }); }
    catch { mostrarErro('Erro ao atualizar categoria.'); }
  };

  const apagarRegisto = async (colecao, id) => {
    if (!confirm('Eliminar registo permanentemente?')) return;
    try {
      if (colecao === 'transacoes') await apagarTransacao(id);
      if (colecao === 'pagar') await apagarContaPagar(id);
      if (colecao === 'receber') await apagarContaReceber(id);
    } catch { mostrarErro('Erro ao apagar registo.'); }
  };

  const liquidarTitulo = async (tipo, titulo) => {
    if (!confirm(`Confirmar liquidação de ${formatarMoeda(titulo.valor)}?`)) return;
    try {
      if (tipo === 'pagar') await liquidarContaPagar(titulo);
      else await liquidarContaReceber(titulo);
      alert('✅ Título liquidado e transação gerada com sucesso!');
    } catch { mostrarErro('Erro ao liquidar título.'); }
  };

  const salvarFormulario = async (e, tipo) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (tipo === 'transacao') await adicionarTransacao({ ...formData, conta: contas[0]?.id });
      else if (tipo === 'pagar') await adicionarContaPagar(formData);
      else if (tipo === 'receber') await adicionarContaReceber(formData);
      setShowModal(null);
      setFormData({});
    } catch { mostrarErro('Erro ao salvar. Tente novamente.'); }
    finally { setSalvando(false); }
  };

  // --- COMPROVANTES ---
  const handleAnexoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('O comprovante deve ter no máximo 2MB.');
    const reader = new FileReader();
    reader.onloadend = () => setFormData(prev => ({ ...prev, comprovante: reader.result }));
    reader.readAsDataURL(file);
  };

  const triggerComprovanteUpload = (id) => {
    setUploadingComprovanteId(id);
    setTimeout(() => { if (comprovanteInputRef.current) comprovanteInputRef.current.click(); }, 0);
  };

  const handleComprovanteExistenteUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingComprovanteId) return;
    if (file.size > 2 * 1024 * 1024) return alert('O comprovante deve ter no máximo 2MB.');
    const reader = new FileReader();
    reader.onloadend = async () => {
      try { await atualizarTransacao(uploadingComprovanteId, { comprovante: reader.result }); }
      catch { mostrarErro('Erro ao salvar comprovante.'); }
      setUploadingComprovanteId(null);
      if (comprovanteInputRef.current) comprovanteInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  // --- CONCILIAÇÃO ---
  const tentarConciliar = async (id, checked) => {
    if (!checked) { await atualizarTransacao(id, { conciliada: false }); return; }
    const t = transacoes.find(x => x.id === id);
    if (t.comprovante || t.justificativa || t.tipo === 'entrada') {
      await atualizarTransacao(id, { conciliada: true });
    } else {
      setJustificativaTargetId(id);
      setJustificativaText('');
    }
  };

  const salvarJustificativaEConciliar = async () => {
    if (!justificativaText.trim()) return alert('Por favor, insira uma justificativa válida.');
    try {
      await atualizarTransacao(justificativaTargetId, { justificativa: justificativaText.trim(), conciliada: true });
      setJustificativaTargetId(null);
    } catch { mostrarErro('Erro ao salvar justificativa.'); }
  };

  // --- CATEGORIAS ---
  const handleAdicionarCategoria = async (tipo) => {
    const valor = tipo === 'entrada' ? novaCatEntrada : novaCatSaida;
    if (!valor.trim()) return;
    if (categorias[tipo].includes(valor.trim())) return alert('Categoria já existe!');
    try {
      await adicionarCategoria(tipo, valor.trim());
      if (tipo === 'entrada') setNovaCatEntrada(''); else setNovaCatSaida('');
    } catch { mostrarErro('Erro ao adicionar categoria.'); }
  };

  const handleEditarCategoria = async (tipo, nomeAntigo) => {
    const novoNome = prompt('Editar categoria:', nomeAntigo);
    if (!novoNome || novoNome.trim() === '' || novoNome === nomeAntigo) return;
    if (categorias[tipo].includes(novoNome.trim())) return alert('Esta categoria já existe!');
    try { await editarCategoria(tipo, nomeAntigo, novoNome.trim()); }
    catch { mostrarErro('Erro ao editar categoria.'); }
  };

  const handleRemoverCategoria = async (tipo, nome) => {
    const emUso = transacoes.some(t => t.tipo === tipo && t.categoria === nome);
    const msg = emUso
      ? `A categoria "${nome}" está em uso. Tem a certeza que deseja removê-la?`
      : `Remover a categoria "${nome}"?`;
    if (!confirm(msg)) return;
    try { await removerCategoria(tipo, nome); }
    catch { mostrarErro('Erro ao remover categoria.'); }
  };

  // --- IMPORTAÇÃO ---
  const handleFileUpload = (e) => {
    e.preventDefault(); setDragActive(false);
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = (ev) => {
      const novasTransacoes = [];
      let duplicadas = 0; let viaRegras = 0;

      const processarLinha = (data, desc, val) => {
        if (!data || isNaN(val) || val === 0) return;
        const descricaoLimpa = desc.substring(0, 100);
        const tipo = val >= 0 ? 'entrada' : 'saida';
        let categoriaAtribuida = tipo === 'entrada' ? 'Outras Entradas' : 'Outras Saídas';
        const regra = regras.find(r => descricaoLimpa.toUpperCase().includes(r.palavra.toUpperCase()));
        if (regra) { categoriaAtribuida = regra.categoria; viaRegras++; }
        const nova = {
          id: 'imp_' + Math.random().toString(36).substr(2, 9),
          data, descricao: descricaoLimpa, valor: Math.abs(val), tipo,
          categoria: categoriaAtribuida, conta: contas[0]?.id, centroCusto: 'Geral', conciliada: true
        };
        const isDuplicado = transacoes.some(t =>
          t.data === nova.data && Math.abs(Number(t.valor) - nova.valor) < 0.01 &&
          stringSimilarity(t.descricao, nova.descricao) > 0.7
        );
        if (isDuplicado) duplicadas++; else novasTransacoes.push(nova);
      };

      if (ext === 'csv') {
        const linhas = ev.target.result.split('\n');
        linhas.forEach(linha => {
          const cols = linha.split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length < 3) return;
          const dataCol = cols.find(c => c.match(/^\d{2}\/\d{2}\/\d{4}$/) || c.match(/^\d{4}-\d{2}-\d{2}$/));
          const valCol = cols.find(c => c !== dataCol && !isNaN(parseFloat(c.replace(/\./g, '').replace(',', '.'))));
          const descCol = cols.find(c => c !== dataCol && c !== valCol) || "Sem descrição";
          if (dataCol && valCol) {
            let isoDate = dataCol;
            if (dataCol.includes('/')) { const [d, m, y] = dataCol.split('/'); isoDate = `${y}-${m}-${d}`; }
            let val = valCol.includes(',') && valCol.includes('.') ? valCol.replace(/\./g, '').replace(',', '.') : valCol.replace(',', '.');
            processarLinha(isoDate, descCol, parseFloat(val));
          }
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        if (!window.XLSX) return alert("Biblioteca Excel a carregar, tente de novo em 2 segundos.");
        const workbook = window.XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        jsonData.slice(1).forEach(row => {
          if (row.length < 3) return;
          let date = row[0];
          if (typeof date === 'number') date = new Date((date - 25569) * 86400 * 1000).toISOString().split('T')[0];
          processarLinha(date, String(row[1]), parseFloat(String(row[2]).replace(',', '.')));
        });
      } else if (ext === 'ofx') {
        const text = ev.target.result;
        const ledgerMatch = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([-.\d]+)/);
        if (ledgerMatch) setSaldoOficialBanco(parseFloat(ledgerMatch[1]));
        const matches = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g)];
        matches.forEach(m => {
          const dateMatch = m[1].match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/);
          const amtMatch = m[1].match(/<TRNAMT>([-\d.]+)/);
          const memoMatch = m[1].match(/<MEMO>([^<]+)/);
          if (dateMatch && amtMatch) processarLinha(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`, memoMatch ? memoMatch[1].trim() : 'OFX', parseFloat(amtMatch[1]));
        });
      }
      setImportPreview(novasTransacoes);
      setImportStats({ novas: novasTransacoes.length, duplicadas, viaRegras });
    };
    if (ext === 'xlsx' || ext === 'xls') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const confirmarImportacao = async () => {
    try {
      setSalvando(true);
      await importarTransacoes(importPreview);
      setImportPreview(null);
      setActiveTab('movimentos');
    } catch { mostrarErro('Erro ao importar transações. Tente novamente.'); }
    finally { setSalvando(false); }
  };

  // --- REGRAS ---
  const handleAdicionarRegra = async () => {
    const palavra = document.getElementById('newRuleWord').value.trim();
    const categoria = document.getElementById('newRuleCat').value;
    const tipo = categorias.saida.includes(categoria) ? 'saida' : 'entrada';
    if (!palavra) return;
    try {
      await adicionarRegra({ palavra, categoria, tipo });
      document.getElementById('newRuleWord').value = '';
    } catch { mostrarErro('Erro ao adicionar regra.'); }
  };

  // --- RENDERIZADORES ---
  const renderDashboard = () => {
    const totalPagar = aPagarProc.pendentes.reduce((acc, t) => acc + Number(t.valor), 0) + aPagarProc.vencidas.reduce((acc, t) => acc + Number(t.valor), 0);
    const totalReceber = aReceberProc.pendentes.reduce((acc, t) => acc + Number(t.valor), 0) + aReceberProc.vencidas.reduce((acc, t) => acc + Number(t.valor), 0);
    const saldoCalculado = dashboardAcumulado.entradas - dashboardAcumulado.saidas;
    const saldoProjetadoAcumulado = saldoCalculado + totalReceber - totalPagar;

    return (
      <div className="space-y-8 animate-in fade-in">
        <div>
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-500" /> Comparativo de Saldos <span className="normal-case tracking-normal text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-2">Todo o Histórico</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl shadow-md text-white">
              <div className="flex justify-between items-center mb-4"><span className="font-medium text-indigo-100">Soma das Transações</span><Wallet className="text-white w-6 h-6"/></div>
              <p className="text-3xl font-black">{formatarMoeda(saldoCalculado)}</p>
              <div className="mt-4 text-xs font-medium bg-white/10 px-3 py-1.5 rounded-lg w-max">Calculado pelo ERP</div>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-md text-white">
              <div className="flex justify-between items-center mb-4"><span className="font-medium text-slate-300">Saldo no Ficheiro OFX</span><Scale className="text-white w-6 h-6"/></div>
              <p className="text-3xl font-black text-sky-400">{saldoOficialBanco !== null ? formatarMoeda(saldoOficialBanco) : '---'}</p>
              <div className="mt-4 text-xs font-medium bg-white/10 px-3 py-1.5 rounded-lg w-max text-slate-300">Lido da tag do Banco</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
              <span className="text-slate-500 font-bold uppercase text-xs tracking-wider mb-2">Total Entradas Mestre</span>
              <p className="text-2xl font-black text-emerald-600">{formatarMoeda(dashboardAcumulado.entradas)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center ring-2 ring-indigo-500 ring-offset-2">
              <span className="text-indigo-600 font-bold uppercase text-xs tracking-wider mb-2 flex items-center gap-2"><Target className="w-4 h-4"/> Saldo Projetado</span>
              <p className="text-2xl font-black text-slate-800">{formatarMoeda(saldoProjetadoAcumulado)}</p>
              <span className="text-xs text-slate-400 mt-1">Inclui a Receber/Pagar</span>
            </div>
          </div>
          {saldoOficialBanco !== null && Math.abs(saldoCalculado - saldoOficialBanco) > 0.01 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0"/>
              <div>
                <p className="text-amber-800 font-bold">Diferença: {formatarMoeda(Math.abs(saldoCalculado - saldoOficialBanco))}</p>
                <p className="text-amber-700 text-sm mt-1">A soma das transações não bate com o saldo OFX. Adicione uma transação de ajuste manual na data de 1 de Janeiro.</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-500" /> Desempenho do Período <span className="normal-case tracking-normal text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full ml-2">{formatarData(filtroDataInicio)} a {formatarData(filtroDataFim)}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-2"><span className="text-slate-500 font-bold text-sm">Recebido</span><ArrowUpCircle className="text-emerald-500 w-5 h-5"/></div>
              <p className="text-2xl font-bold text-slate-800">{formatarMoeda(dashboardPeriodo.entradas)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-2"><span className="text-slate-500 font-bold text-sm">Gasto</span><ArrowDownCircle className="text-rose-500 w-5 h-5"/></div>
              <p className="text-2xl font-bold text-slate-800">{formatarMoeda(dashboardPeriodo.saidas)}</p>
            </div>
            <div className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm ${dashboardPeriodo.entradas - dashboardPeriodo.saidas >= 0 ? 'border-b-4 border-b-emerald-500' : 'border-b-4 border-b-rose-500'}`}>
              <div className="flex justify-between items-center mb-2"><span className="text-slate-500 font-bold text-sm">Resultado</span></div>
              <p className={`text-2xl font-bold ${dashboardPeriodo.entradas - dashboardPeriodo.saidas >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatarMoeda(dashboardPeriodo.entradas - dashboardPeriodo.saidas)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
              <div className="flex justify-between items-center mb-2"><span className="text-slate-500 font-bold text-sm flex items-center gap-1"><FileCheck className="w-4 h-4"/> Conformidade</span></div>
              <p className={`text-3xl font-black ${dashboardPeriodo.taxaConformidade === 100 ? 'text-emerald-600' : dashboardPeriodo.taxaConformidade > 70 ? 'text-amber-500' : 'text-rose-600'}`}>{dashboardPeriodo.taxaConformidade}%</p>
              <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${dashboardPeriodo.taxaConformidade === 100 ? 'bg-emerald-500' : dashboardPeriodo.taxaConformidade > 70 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${dashboardPeriodo.taxaConformidade}%` }}></div>
              </div>
              {dashboardPeriodo.faltaDoc > 0 && <p className="text-xs font-bold text-rose-500 mt-2 animate-pulse">Faltam {dashboardPeriodo.faltaDoc} comprovantes!</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChart className="w-5 h-5 text-indigo-500"/> Maiores Despesas do Período</h3>
            <div className="space-y-4">
              {Object.entries(transacoesFiltradas.filter(t => t.tipo === 'saida').reduce((acc, t) => { acc[t.categoria] = (acc[t.categoria] || 0) + Number(t.valor); return acc; }, {}))
                .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, val], idx, arr) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-slate-600 font-medium">{cat}</span><span className="font-bold">{formatarMoeda(val)}</span></div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-rose-400 h-full rounded-full" style={{ width: `${(val / arr[0][1]) * 100}%` }}></div></div>
                  </div>
                ))}
              {transacoesFiltradas.filter(t => t.tipo === 'saida').length === 0 && <p className="text-slate-400 text-sm text-center">Nenhuma despesa neste período.</p>}
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-amber-500"/> Alertas de Contas a Pagar</h3>
            <div className="space-y-3">
              {aPagarProc.vencidas.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 bg-rose-50 border border-rose-100 rounded-xl">
                  <div><p className="font-medium text-rose-800 text-sm">{t.fornecedor}</p><p className="text-xs text-rose-600">{t.diasAtraso} dias em atraso</p></div>
                  <span className="font-bold text-rose-700">{formatarMoeda(t.valor)}</span>
                </div>
              ))}
              {aPagarProc.pendentes.filter(t => t.diasAtraso <= 5).map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div><p className="font-medium text-amber-800 text-sm">{t.fornecedor}</p><p className="text-xs text-amber-600">Vence em {t.diasAtraso} dias</p></div>
                  <span className="font-bold text-amber-700">{formatarMoeda(t.valor)}</span>
                </div>
              ))}
              {aPagarProc.vencidas.length === 0 && aPagarProc.pendentes.filter(t => t.diasAtraso <= 5).length === 0 && (
                <div className="text-center text-slate-400 py-8">Nenhum alerta para os próximos 5 dias 🎉</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabelaTitulos = (tipo, dados) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex border-b border-slate-100">
        {['pendentes', 'vencidas', 'pagas'].map(aba => (
          <button key={aba} onClick={() => setAbaInterna(aba)} className={`px-6 py-4 font-medium text-sm transition-colors ${abaInterna === aba ? (aba === 'vencidas' ? 'text-rose-600 border-b-2 border-rose-600' : aba === 'pagas' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-indigo-600 border-b-2 border-indigo-600') : 'text-slate-500 hover:text-slate-800'}`}>
            {aba === 'pendentes' ? `Pendentes (${dados.pendentes.length})` : aba === 'vencidas' ? `Vencidas (${dados.vencidas.length})` : `Concluídas (${dados.pagas.length})`}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4 font-medium">Vencimento</th>
              <th className="p-4 font-medium">{tipo === 'pagar' ? 'Fornecedor' : 'Cliente'}</th>
              <th className="p-4 font-medium">Descrição</th>
              <th className="p-4 font-medium text-right">Valor</th>
              <th className="p-4 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados[abaInterna].length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-slate-400">Sem registos nesta categoria.</td></tr>
            ) : dados[abaInterna].map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="p-4">
                  <div className="font-medium text-slate-700">{formatarData(t.vencimento)}</div>
                  {abaInterna === 'vencidas' && <div className="text-xs text-rose-500">{t.diasAtraso} dias atraso</div>}
                </td>
                <td className="p-4 font-medium text-slate-800">{tipo === 'pagar' ? t.fornecedor : t.cliente}</td>
                <td className="p-4 text-slate-600">{t.descricao}</td>
                <td className="p-4 text-right font-bold text-slate-800">{formatarMoeda(t.valor)}</td>
                <td className="p-4 text-center">
                  {abaInterna !== 'pagas' && (
                    <button onClick={() => liquidarTitulo(tipo, t)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 mr-2"><CheckCircle2 className="w-4 h-4"/></button>
                  )}
                  <button onClick={() => apagarRegisto(tipo, t.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100"><Trash2 className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRelatorios = () => {
    const transacoesRelatorio = transacoes.filter(t => t.data >= relatorioInicio && t.data <= relatorioFim).sort((a, b) => new Date(a.data) - new Date(b.data));
    const totalEntradas = transacoesRelatorio.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0);
    const totalSaidas = transacoesRelatorio.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0);
    const saldo = totalEntradas - totalSaidas;
    const exportarPDF = () => {
      if (!window.html2pdf) return alert('Biblioteca PDF a carregar, aguarde.');
      const element = document.getElementById('relatorio-print-area');
      window.html2pdf().set({ margin: 10, filename: `Relatorio_${relatorioInicio}_a_${relatorioFim}.pdf`, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(element).save();
    };
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1"><label className="block text-sm font-bold text-slate-700 mb-1">Início</label><input type="date" value={relatorioInicio} onChange={e => setRelatorioInicio(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"/></div>
          <div className="flex-1"><label className="block text-sm font-bold text-slate-700 mb-1">Fim</label><input type="date" value={relatorioFim} onChange={e => setRelatorioFim(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"/></div>
          <button onClick={exportarPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 h-[42px]"><FileDown className="w-5 h-5"/> Exportar PDF</button>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm overflow-auto">
          <div id="relatorio-print-area" className="p-4 bg-white text-slate-900 min-w-[700px]">
            <div className="text-center mb-8 border-b-2 border-slate-200 pb-6">
              <h1 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Relatório Financeiro</h1>
              <p className="text-slate-500 mt-1 font-medium">{empresa?.nome} • {formatarData(relatorioInicio)} até {formatarData(relatorioFim)}</p>
            </div>
            <div className="flex justify-between gap-4 mb-8">
              {[['Total Recebido', totalEntradas, 'text-emerald-600'], ['Total Gasto', totalSaidas, 'text-rose-600'], ['Resultado', saldo, saldo >= 0 ? 'text-blue-600' : 'text-rose-600']].map(([label, val, cls]) => (
                <div key={label} className="flex-1 bg-slate-50 border border-slate-200 p-5 rounded-2xl text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-2xl font-black ${cls}`}>{formatarMoeda(val)}</p>
                </div>
              ))}
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead><tr className="border-b-2 border-slate-800"><th className="py-3 px-2 font-bold">Data</th><th className="py-3 px-2 font-bold">Descrição</th><th className="py-3 px-2 font-bold">Categoria</th><th className="py-3 px-2 font-bold text-right">Valor</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {transacoesRelatorio.length === 0 ? <tr><td colSpan="4" className="py-8 text-center text-slate-500">Nenhuma movimentação nestas datas.</td></tr>
                  : transacoesRelatorio.map(t => (
                    <tr key={t.id}><td className="py-3 px-2 text-slate-600">{formatarData(t.data)}</td><td className="py-3 px-2 font-bold text-slate-800">{t.descricao}</td><td className="py-3 px-2 text-slate-600 text-xs uppercase tracking-wider">{t.categoria}</td><td className={`py-3 px-2 text-right font-black ${t.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.tipo === 'entrada' ? '+' : '-'} {formatarMoeda(t.valor)}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCategorias = () => (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Tag className="text-pink-500 w-6 h-6"/> Gestão de Categorias</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[{ tipo: 'entrada', label: 'Entradas / Receitas', cor: 'emerald', val: novaCatEntrada, set: setNovaCatEntrada, Icon: ArrowUpCircle },
            { tipo: 'saida', label: 'Saídas / Despesas', cor: 'rose', val: novaCatSaida, set: setNovaCatSaida, Icon: ArrowDownCircle }].map(({ tipo, label, cor, val, set, Icon }) => (
            <div key={tipo} className={`bg-${cor}-50/50 p-6 rounded-2xl border border-${cor}-100`}>
              <h3 className={`font-bold text-${cor}-800 mb-4 flex items-center gap-2`}><Icon className="w-5 h-5"/> {label}</h3>
              <div className="flex gap-2 mb-4">
                <input type="text" value={val} onChange={e => set(e.target.value)} placeholder="Adicionar nova..." className={`flex-1 px-4 py-2 rounded-xl border border-${cor}-200 outline-none focus:ring-2 focus:ring-${cor}-500`} onKeyDown={e => e.key === 'Enter' && handleAdicionarCategoria(tipo)} />
                <button onClick={() => handleAdicionarCategoria(tipo)} className={`bg-${cor}-600 hover:bg-${cor}-700 text-white px-4 rounded-xl font-bold`}><Plus className="w-5 h-5"/></button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {categorias[tipo].map(c => (
                  <div key={c} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <span className="font-medium text-slate-700">{c}</span>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditarCategoria(tipo, c)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button>
                      <button onClick={() => handleRemoverCategoria(tipo, c)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (carregando) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f4f7fb] text-slate-800 font-sans overflow-hidden">

      {/* Notificação de erro global */}
      {erro && (
        <div className="fixed top-4 right-4 z-[100] bg-rose-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5"/>{erro}
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-64 bg-gradient-to-br from-[#2a1b4d] to-[#140b2e] text-slate-300 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-400 to-rose-500 p-2 rounded-lg"><Wallet className="w-5 h-5 text-white"/></div>
          <div>
            <h1 className="text-white font-bold tracking-wide leading-tight truncate max-w-[130px]">{empresa?.nome || 'ERP Financeiro'}</h1>
            <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-amber-400 uppercase tracking-wider">Premium v2.0</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {[
            { section: 'Principal' },
            { tab: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
            { tab: 'movimentos', label: 'Movimentos', Icon: ListOrdered },
            { tab: 'contas', label: 'Contas', Icon: Landmark },
            { section: 'Gestão' },
            { tab: 'pagar', label: 'Contas a Pagar', Icon: ArrowDownCircle, iconClass: 'text-rose-400', onClick: () => { setActiveTab('pagar'); setAbaInterna('pendentes'); } },
            { tab: 'receber', label: 'Contas a Receber', Icon: ArrowUpCircle, iconClass: 'text-emerald-400', onClick: () => { setActiveTab('receber'); setAbaInterna('pendentes'); } },
            { tab: 'conciliacao', label: 'Conciliação', Icon: CheckCircle2, iconClass: 'text-blue-400' },
            { tab: 'relatorios', label: 'Relatórios (PDF)', Icon: BarChart, iconClass: 'text-sky-400' },
            { section: 'Sistema' },
            { tab: 'categorias', label: 'Categorias', Icon: Tag, iconClass: 'text-pink-400' },
            { tab: 'importacao', label: 'Importar Extrato', Icon: UploadCloud, iconClass: 'text-amber-400' },
            { tab: 'regras', label: 'Regras Auto', Icon: Wand2, iconClass: 'text-purple-400' },
          ].map((item, i) => {
            if (item.section) return <div key={i} className="px-6 mt-4 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.section}</div>;
            const { tab, label, Icon, iconClass, onClick } = item;
            return (
              <button key={tab} onClick={onClick || (() => setActiveTab(tab))}
                className={`w-full flex items-center gap-3 px-6 py-3 font-medium transition-all ${activeTab === tab ? 'bg-white/10 text-white border-l-4 border-indigo-500' : 'hover:bg-white/5 hover:text-white border-l-4 border-transparent'}`}>
                <Icon className={`w-4 h-4 ${iconClass || ''}`}/> {label}
              </button>
            );
          })}
        </nav>

        {/* Perfil + Logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">{perfil?.nome?.[0]?.toUpperCase() || 'U'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{perfil?.nome}</p>
              <p className="text-slate-400 text-xs truncate">{perfil?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 text-sm transition-all">
            <LogOut className="w-4 h-4"/> Sair
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 capitalize">
            {activeTab === 'pagar' ? 'Contas a Pagar' : activeTab === 'receber' ? 'Contas a Receber' : activeTab === 'relatorios' ? 'Relatórios' : activeTab === 'conciliacao' ? 'Conciliação' : activeTab === 'importacao' ? 'Importar Extrato' : activeTab === 'categorias' ? 'Categorias' : activeTab === 'regras' ? 'Regras Auto' : activeTab === 'movimentos' ? 'Movimentos' : activeTab === 'contas' ? 'Contas' : 'Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
            <select value={filtroConta} onChange={(e) => setFiltroConta(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              <option value="Todas">🏦 Todas as Contas</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500">
              <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="bg-transparent border-none text-slate-700 text-sm outline-none"/>
              <span className="text-slate-400 text-sm font-medium">até</span>
              <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="bg-transparent border-none text-slate-700 text-sm outline-none"/>
            </div>
            <button onClick={() => setShowModal(activeTab === 'pagar' ? 'pagar' : activeTab === 'receber' ? 'receber' : 'transacao')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md shadow-indigo-200 flex items-center gap-2 ml-2">
              <Plus className="w-4 h-4"/> Novo
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' && renderDashboard()}

          {activeTab === 'movimentos' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">
              <input type="file" accept="image/*,application/pdf" ref={comprovanteInputRef} onChange={handleComprovanteExistenteUpload} className="hidden"/>
              <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <span className="text-sm font-bold text-slate-500">Filtrar:</span>
                {[['Todas', 'Todas as Transações', 'indigo', null], ['SemDoc', 'Faltam Comprovantes', 'rose', ShieldAlert], ['ComDoc', 'Documentadas', 'emerald', FileCheck]].map(([val, label, cor, Icon]) => (
                  <button key={val} onClick={() => setFiltroDocumento(val)} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${filtroDocumento === val ? `bg-${cor}-100 text-${cor}-700 border border-${cor}-200 shadow-sm` : 'text-slate-600 hover:bg-slate-100 border border-transparent'}`}>
                    {Icon && <Icon className="w-4 h-4"/>}{label}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 font-medium text-slate-500 w-24">Data</th>
                      <th className="p-4 font-medium text-slate-500">Descrição</th>
                      <th className="p-4 font-medium text-slate-500 w-64">Categoria</th>
                      <th className="p-4 font-medium text-slate-500 text-right">Valor</th>
                      <th className="p-4 font-medium text-slate-500 text-center">Status</th>
                      <th className="p-4 font-medium text-slate-500 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {transacoesFiltradas.length === 0 ? <tr><td colSpan="6" className="p-12 text-center text-slate-400">Nenhum movimento registado.</td></tr> :
                      transacoesFiltradas.map((t) => {
                        const { texto, doc } = formatarDescricaoEDocumento(t.descricao);
                        return (
                          <tr key={t.id} className="hover:bg-slate-50 group">
                            <td className="p-4 text-slate-600 font-medium">{formatarData(t.data)}</td>
                            <td className="p-4 max-w-[250px] cursor-pointer" onClick={() => setExpandedDescId(expandedDescId === t.id ? null : t.id)}>
                              <div className="flex items-center gap-2">
                                <p className={`font-bold text-slate-800 ${expandedDescId === t.id ? 'whitespace-normal break-words' : 'truncate'}`}>{texto}</p>
                                {!t.comprovante && !t.justificativa && t.tipo === 'saida' && (
                                  <span className="shrink-0 text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> SEM DOC</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {doc && <span className="inline-flex items-center bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[10px] font-black border border-indigo-200">{doc.length > 14 ? 'CNPJ:' : 'CPF:'} {doc}</span>}
                                <span className="text-xs text-slate-400">{contas.find(c => c.id === t.conta_id || c.id === t.conta)?.nome} • {t.centro_custo || t.centroCusto}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <select value={t.categoria} onChange={(e) => alterarCategoriaTransacao(t.id, e.target.value)} className="bg-slate-100 px-3 py-2 rounded-md text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 w-full min-w-[220px]">
                                {categorias[t.tipo]?.map(c => <option key={c} value={c}>{c}</option>)}
                                {!categorias[t.tipo]?.includes(t.categoria) && <option value={t.categoria}>{t.categoria}</option>}
                              </select>
                            </td>
                            <td className={`p-4 text-right font-black ${t.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.tipo === 'entrada' ? '+' : '-'} {formatarMoeda(t.valor)}</td>
                            <td className="p-4 text-center">
                              {t.conciliada ? <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 flex items-center justify-center gap-1 w-max mx-auto"><CheckCircle2 className="w-3 h-3"/> Conciliado</span>
                                : <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100 flex items-center justify-center gap-1 w-max mx-auto"><Clock className="w-3 h-3"/> Pendente</span>}
                            </td>
                            <td className="p-4 text-center flex items-center justify-center gap-2">
                              {t.comprovante ? (
                                <>
                                  <button onClick={() => setVisualizarComprovante(t.comprovante)} className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg"><Paperclip className="w-4 h-4"/></button>
                                  <button onClick={() => atualizarTransacao(t.id, { comprovante: null })} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg"><X className="w-4 h-4"/></button>
                                </>
                              ) : (
                                <button onClick={() => triggerComprovanteUpload(t.id)} className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"><Upload className="w-4 h-4"/></button>
                              )}
                              {t.justificativa && <button onClick={() => alert(`Justificativa:\n\n${t.justificativa}`)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"><FileText className="w-4 h-4"/></button>}
                              <button onClick={() => apagarRegisto('transacoes', t.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'pagar' && renderTabelaTitulos('pagar', aPagarProc)}
          {activeTab === 'receber' && renderTabelaTitulos('receber', aReceberProc)}

          {activeTab === 'conciliacao' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex gap-3">
                <div className="text-2xl">ℹ️</div>
                <div><p className="font-bold text-blue-900">Como funciona a Conciliação</p><p className="text-sm text-blue-800 mt-1">Marque as transações que já conferiu no seu extrato bancário.</p></div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50"><tr><th className="p-4">Conciliar</th><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4 text-right">Valor</th><th className="p-4">Doc.</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {transacoesFiltradas.map(t => (
                    <tr key={t.id} className={`hover:bg-slate-50 ${t.conciliada ? 'opacity-60' : ''}`}>
                      <td className="p-4"><input type="checkbox" checked={t.conciliada} onChange={e => tentarConciliar(t.id, e.target.checked)} className="w-5 h-5 rounded accent-indigo-600 cursor-pointer"/></td>
                      <td className="p-4 font-medium">{formatarData(t.data)}</td>
                      <td className="p-4"><span className="font-medium">{t.descricao}</span><span className={`ml-2 text-xs px-2 py-0.5 rounded font-bold ${t.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{t.tipo}</span></td>
                      <td className={`p-4 text-right font-black ${t.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.tipo === 'entrada' ? '+' : '-'} {formatarMoeda(t.valor)}</td>
                      <td className="p-4">{t.comprovante ? <Paperclip className="w-4 h-4 text-indigo-500"/> : t.justificativa ? <FileText className="w-4 h-4 text-blue-500"/> : t.tipo === 'saida' ? <AlertCircle className="w-4 h-4 text-rose-400"/> : <CheckCircle2 className="w-4 h-4 text-emerald-400"/>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'importacao' && (
            <div className="max-w-4xl mx-auto bg-white p-10 rounded-3xl shadow-sm border border-slate-100">
              <div className="text-center mb-8">
                <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"><UploadCloud className="w-8 h-8 text-indigo-600"/></div>
                <h2 className="text-2xl font-bold text-slate-800">Importação Automática</h2>
                <p className="text-slate-500 mt-2">Suporta ficheiros CSV, Excel (.xlsx) e OFX de qualquer banco.</p>
              </div>
              {!importPreview ? (
                <div onDragOver={e => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleFileUpload} onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${dragActive ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}>
                  <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4"/>
                  <h3 className="font-bold text-lg text-slate-700">Arraste o ficheiro para aqui</h3>
                  <p className="text-sm text-slate-500 mt-1">ou clique para selecionar</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.ofx" className="hidden"/>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl"><p className="text-3xl font-black text-emerald-600">{importStats.novas}</p><p className="text-sm font-medium text-emerald-800">A Importar</p></div>
                    <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl"><p className="text-3xl font-black text-purple-600">{importStats.viaRegras}</p><p className="text-sm font-medium text-purple-800">Categorizadas</p></div>
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl"><p className="text-3xl font-black text-rose-600">{importStats.duplicadas}</p><p className="text-sm font-medium text-rose-800">Duplicados</p></div>
                  </div>
                  <div className="border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
                    <table className="w-full text-sm text-left"><thead className="bg-slate-50 sticky top-0"><tr><th className="p-3">Data</th><th className="p-3">Descrição</th><th className="p-3">Categoria</th><th className="p-3 text-right">Valor</th></tr></thead>
                      <tbody>{importPreview.map(t => (<tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-3">{formatarData(t.data)}</td><td className="p-3 font-medium">{t.descricao}</td><td className="p-3"><span className="bg-slate-200 px-2 py-1 rounded text-xs">{t.categoria}</span></td><td className={`p-3 text-right font-bold ${t.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.tipo === 'entrada' ? '+' : '-'} {formatarMoeda(t.valor)}</td></tr>))}</tbody>
                    </table>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button onClick={() => setImportPreview(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl">Cancelar</button>
                    <button onClick={confirmarImportacao} disabled={salvando} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl flex justify-center items-center gap-2">
                      {salvando ? 'Salvando...' : <><CheckCircle2 className="w-5 h-5"/> Confirmar Importação</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'regras' && (
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Wand2 className="text-purple-600"/> Motor de Regras</h2>
              <div className="bg-purple-50 p-6 rounded-2xl mb-8 border border-purple-100">
                <h3 className="font-bold text-purple-900 mb-4">Adicionar Nova Regra</h3>
                <div className="flex gap-3">
                  <input type="text" id="newRuleWord" placeholder="Palavra (ex: UBER)" className="flex-1 px-4 py-3 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500"/>
                  <select id="newRuleCat" className="flex-1 px-4 py-3 rounded-xl border border-purple-200 outline-none bg-white">
                    <optgroup label="Saídas">{categorias.saida.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                    <optgroup label="Entradas">{categorias.entrada.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  </select>
                  <button onClick={handleAdicionarRegra} className="bg-purple-600 hover:bg-purple-700 text-white px-6 font-bold rounded-xl"><Plus className="w-5 h-5"/></button>
                </div>
              </div>
              <div className="space-y-3">
                {regras.map(r => (
                  <div key={r.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-4"><span className="bg-white border px-3 py-1 rounded-lg font-bold shadow-sm">"{r.palavra}"</span><ChevronRight className="w-4 h-4 text-slate-400"/><span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-bold">{r.categoria}</span></div>
                    <button onClick={() => apagarRegra(r.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-5 h-5"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'contas' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {contas.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="bg-indigo-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><Landmark className="text-indigo-600 w-6 h-6"/></div>
                  <h3 className="text-lg font-bold text-slate-800">{c.nome}</h3>
                  <p className="text-sm text-slate-500 capitalize mb-4">{c.tipo}</p>
                  <div className="text-2xl font-black text-slate-900">
                    {formatarMoeda(transacoes.filter(t => t.conta_id === c.id || t.conta === c.id).reduce((acc, t) => t.tipo === 'entrada' ? acc + Number(t.valor) : acc - Number(t.valor), 0))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'categorias' && renderCategorias()}
          {activeTab === 'relatorios' && renderRelatorios()}
        </div>
      </main>

      {/* MODAL GENÉRICO */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {showModal === 'transacao' ? 'Nova Transação' : showModal === 'pagar' ? 'Nova Conta a Pagar' : 'Nova Conta a Receber'}
              </h2>
              <button onClick={() => setShowModal(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={(e) => salvarFormulario(e, showModal)} className="p-6 space-y-5">
              {showModal === 'transacao' && (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <button type="button" onClick={() => setFormData({ ...formData, tipo: 'entrada', categoria: categorias.entrada[0] })} className={`py-3 rounded-xl font-bold border-2 transition-all ${formData.tipo === 'entrada' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>Entrada</button>
                  <button type="button" onClick={() => setFormData({ ...formData, tipo: 'saida', categoria: categorias.saida[0] })} className={`py-3 rounded-xl font-bold border-2 transition-all ${(!formData.tipo || formData.tipo === 'saida') ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>Saída</button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{showModal === 'transacao' ? 'Data' : 'Vencimento'}</label>
                  <input type="date" required value={formData[showModal === 'transacao' ? 'data' : 'vencimento'] || hoje} onChange={e => setFormData({ ...formData, [showModal === 'transacao' ? 'data' : 'vencimento']: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"/>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Valor</label>
                  <input type="number" required step="0.01" min="0" value={formData.valor || ''} onChange={e => setFormData({ ...formData, valor: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-lg" placeholder="0,00"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label>
                <input type="text" required value={formData.descricao || ''} onChange={e => setFormData({ ...formData, descricao: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Compra de Material..."/>
              </div>
              {showModal === 'pagar' && <div><label className="block text-sm font-bold text-slate-700 mb-1">Fornecedor</label><input type="text" required value={formData.fornecedor || ''} onChange={e => setFormData({ ...formData, fornecedor: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none"/></div>}
              {showModal === 'receber' && <div><label className="block text-sm font-bold text-slate-700 mb-1">Cliente</label><input type="text" required value={formData.cliente || ''} onChange={e => setFormData({ ...formData, cliente: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none"/></div>}
              {showModal === 'transacao' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                    <select value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                      {categorias[formData.tipo || 'saida'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Centro Custo</label>
                    <select value={formData.centroCusto || centrosCusto[0]} onChange={e => setFormData({ ...formData, centroCusto: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                      {centrosCusto.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Comprovante (Opcional)</label>
                <input type="file" accept="image/*,application/pdf" onChange={handleAnexoUpload} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"/>
                {formData.comprovante && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Comprovante anexado</p>}
              </div>
              <button type="submit" disabled={salvando} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-lg py-4 rounded-xl shadow-lg flex justify-center items-center gap-2">
                {salvando ? 'Salvando...' : <><Play className="w-5 h-5"/> Guardar Registo</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL COMPROVANTE */}
      {visualizarComprovante && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Paperclip className="w-5 h-5 text-indigo-600"/> Comprovante</h2>
              <button onClick={() => setVisualizarComprovante(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex justify-center items-center bg-slate-100 min-h-[50vh]">
              {visualizarComprovante.startsWith('data:application/pdf')
                ? <iframe src={visualizarComprovante} className="w-full h-[70vh] rounded-xl border border-slate-300" title="PDF"/>
                : <img src={visualizarComprovante} alt="Comprovante" className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-sm"/>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL JUSTIFICATIVA */}
      {justificativaTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50">
              <h2 className="text-xl font-bold text-rose-800 flex items-center gap-2"><AlertCircle className="w-6 h-6"/> Conciliação Bloqueada</h2>
              <button onClick={() => setJustificativaTargetId(null)} className="p-2 text-rose-400 hover:bg-rose-200 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">Para conciliar, é <strong className="text-rose-600">obrigatório</strong> anexar um comprovante ou justificar a ausência.</p>
              <textarea value={justificativaText} onChange={(e) => setJustificativaText(e.target.value)} placeholder="Ex: Fatura física não emitida, pagamento sob contrato mensal..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none min-h-[120px] text-sm"/>
              <button onClick={salvarJustificativaEConciliar} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-base py-3.5 rounded-xl flex justify-center items-center gap-2">
                <CheckCircle2 className="w-5 h-5"/> Salvar e Conciliar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
