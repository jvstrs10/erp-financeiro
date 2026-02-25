import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useERP() {
  const { empresa } = useAuth()
  const supabase = createClient()

  const [transacoes, setTransacoes] = useState([])
  const [contasPagar, setContasPagar] = useState([])
  const [contasReceber, setContasReceber] = useState([])
  const [contas, setContas] = useState([])
  const [categorias, setCategorias] = useState({ entrada: [], saida: [] })
  const [centrosCusto, setCentrosCusto] = useState([])
  const [regras, setRegras] = useState([])
  const [carregando, setCarregando] = useState(true)

  const empresaId = empresa?.id

  // ── Carregamento inicial ──────────────────────────────────
  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      const [
        { data: t }, { data: cp }, { data: cr },
        { data: c }, { data: cats }, { data: cc }, { data: r }
      ] = await Promise.all([
        supabase.from('transacoes').select('*, conta:contas(nome)').eq('empresa_id', empresaId).order('data', { ascending: false }),
        supabase.from('contas_pagar').select('*').eq('empresa_id', empresaId).order('vencimento'),
        supabase.from('contas_receber').select('*').eq('empresa_id', empresaId).order('vencimento'),
        supabase.from('contas').select('*').eq('empresa_id', empresaId),
        supabase.from('categorias').select('*').eq('empresa_id', empresaId),
        supabase.from('centros_custo').select('*').eq('empresa_id', empresaId),
        supabase.from('regras').select('*').eq('empresa_id', empresaId),
      ])

      // Normalizar transações para o formato esperado pelo componente
      setTransacoes((t || []).map(tx => ({
        ...tx,
        conta: tx.conta_id,
        centroCusto: tx.centro_custo,
        conciliada: tx.conciliada,
      })))

      setContasPagar(cp || [])
      setContasReceber(cr || [])
      setContas(c || [])
      setCentrosCusto((cc || []).map(x => x.nome))
      setRegras(r || [])

      // Organizar categorias por tipo
      const catsOrg = { entrada: [], saida: [] }
      ;(cats || []).forEach(cat => catsOrg[cat.tipo]?.push(cat.nome))
      setCategorias(catsOrg)
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => { carregar() }, [carregar])

  // ── Transações ────────────────────────────────────────────
  const adicionarTransacao = async (dados) => {
    const { data, error } = await supabase.from('transacoes').insert({
      empresa_id: empresaId,
      data: dados.data,
      descricao: dados.descricao,
      valor: parseFloat(dados.valor),
      tipo: dados.tipo,
      categoria: dados.categoria,
      conta_id: dados.conta || contas[0]?.id,
      centro_custo: dados.centroCusto || 'Geral',
      conciliada: dados.conciliada ?? false,
      comprovante: dados.comprovante || null,
      justificativa: dados.justificativa || null,
    }).select('*, conta:contas(nome)').single()

    if (error) throw error
    setTransacoes(prev => [{ ...data, conta: data.conta_id, centroCusto: data.centro_custo }, ...prev])
    return data
  }

  const atualizarTransacao = async (id, campos) => {
    const payload = {}
    if (campos.categoria !== undefined) payload.categoria = campos.categoria
    if (campos.conciliada !== undefined) payload.conciliada = campos.conciliada
    if (campos.comprovante !== undefined) payload.comprovante = campos.comprovante
    if (campos.justificativa !== undefined) payload.justificativa = campos.justificativa
    if (campos.centro_custo !== undefined) payload.centro_custo = campos.centro_custo

    const { error } = await supabase.from('transacoes').update(payload).eq('id', id).eq('empresa_id', empresaId)
    if (error) throw error
    setTransacoes(prev => prev.map(t => t.id === id ? { ...t, ...campos } : t))
  }

  const apagarTransacao = async (id) => {
    const { error } = await supabase.from('transacoes').delete().eq('id', id).eq('empresa_id', empresaId)
    if (error) throw error
    setTransacoes(prev => prev.filter(t => t.id !== id))
  }

  const importarTransacoes = async (novasTransacoes) => {
    const registros = novasTransacoes.map(t => ({
      empresa_id: empresaId,
      data: t.data,
      descricao: t.descricao,
      valor: t.valor,
      tipo: t.tipo,
      categoria: t.categoria,
      conta_id: contas[0]?.id,
      centro_custo: 'Geral',
      conciliada: true,
    }))
    const { data, error } = await supabase.from('transacoes').insert(registros).select()
    if (error) throw error
    await carregar()
    return data
  }

  // ── Contas a Pagar ────────────────────────────────────────
  const adicionarContaPagar = async (dados) => {
    const { data, error } = await supabase.from('contas_pagar').insert({
      empresa_id: empresaId,
      vencimento: dados.vencimento,
      descricao: dados.descricao,
      valor: parseFloat(dados.valor),
      fornecedor: dados.fornecedor,
      status: 'pendente',
    }).select().single()
    if (error) throw error
    setContasPagar(prev => [data, ...prev])
  }

  const liquidarContaPagar = async (titulo) => {
    const { error } = await supabase.from('contas_pagar')
      .update({ status: 'pago' }).eq('id', titulo.id).eq('empresa_id', empresaId)
    if (error) throw error
    setContasPagar(prev => prev.map(t => t.id === titulo.id ? { ...t, status: 'pago' } : t))
    // Gera transação automaticamente
    await adicionarTransacao({
      data: new Date().toISOString().split('T')[0],
      descricao: titulo.descricao + (titulo.fornecedor ? ` - ${titulo.fornecedor}` : ''),
      valor: titulo.valor, tipo: 'saida', categoria: 'Fornecedores',
      conta: contas[0]?.id, centroCusto: 'Geral', conciliada: false
    })
  }

  const apagarContaPagar = async (id) => {
    const { error } = await supabase.from('contas_pagar').delete().eq('id', id).eq('empresa_id', empresaId)
    if (error) throw error
    setContasPagar(prev => prev.filter(t => t.id !== id))
  }

  // ── Contas a Receber ──────────────────────────────────────
  const adicionarContaReceber = async (dados) => {
    const { data, error } = await supabase.from('contas_receber').insert({
      empresa_id: empresaId,
      vencimento: dados.vencimento,
      descricao: dados.descricao,
      valor: parseFloat(dados.valor),
      cliente: dados.cliente,
      status: 'pendente',
    }).select().single()
    if (error) throw error
    setContasReceber(prev => [data, ...prev])
  }

  const liquidarContaReceber = async (titulo) => {
    const { error } = await supabase.from('contas_receber')
      .update({ status: 'recebido' }).eq('id', titulo.id).eq('empresa_id', empresaId)
    if (error) throw error
    setContasReceber(prev => prev.map(t => t.id === titulo.id ? { ...t, status: 'recebido' } : t))
    await adicionarTransacao({
      data: new Date().toISOString().split('T')[0],
      descricao: titulo.descricao + (titulo.cliente ? ` - ${titulo.cliente}` : ''),
      valor: titulo.valor, tipo: 'entrada', categoria: 'Recebimento de Cliente',
      conta: contas[0]?.id, centroCusto: 'Geral', conciliada: false
    })
  }

  const apagarContaReceber = async (id) => {
    const { error } = await supabase.from('contas_receber').delete().eq('id', id).eq('empresa_id', empresaId)
    if (error) throw error
    setContasReceber(prev => prev.filter(t => t.id !== id))
  }

  // ── Categorias ────────────────────────────────────────────
  const adicionarCategoria = async (tipo, nome) => {
    const { error } = await supabase.from('categorias').insert({ empresa_id: empresaId, nome: nome.trim(), tipo })
    if (error) throw error
    setCategorias(prev => ({ ...prev, [tipo]: [...prev[tipo], nome.trim()] }))
  }

  const removerCategoria = async (tipo, nome) => {
    const { error } = await supabase.from('categorias')
      .delete().eq('empresa_id', empresaId).eq('nome', nome).eq('tipo', tipo)
    if (error) throw error
    setCategorias(prev => ({ ...prev, [tipo]: prev[tipo].filter(c => c !== nome) }))
  }

  const editarCategoria = async (tipo, nomeAntigo, novoNome) => {
    const { error } = await supabase.from('categorias')
      .update({ nome: novoNome.trim() })
      .eq('empresa_id', empresaId).eq('nome', nomeAntigo).eq('tipo', tipo)
    if (error) throw error
    setCategorias(prev => ({ ...prev, [tipo]: prev[tipo].map(c => c === nomeAntigo ? novoNome.trim() : c) }))
    setTransacoes(prev => prev.map(t => (t.tipo === tipo && t.categoria === nomeAntigo) ? { ...t, categoria: novoNome.trim() } : t))
  }

  // ── Regras ────────────────────────────────────────────────
  const adicionarRegra = async (regra) => {
    const { data, error } = await supabase.from('regras').insert({ empresa_id: empresaId, ...regra }).select().single()
    if (error) throw error
    setRegras(prev => [...prev, data])
  }

  const apagarRegra = async (id) => {
    const { error } = await supabase.from('regras').delete().eq('id', id).eq('empresa_id', empresaId)
    if (error) throw error
    setRegras(prev => prev.filter(r => r.id !== id))
  }

  return {
    // Estado
    transacoes, setTransacoes,
    contasPagar, contasReceber,
    contas, categorias, centrosCusto, regras,
    carregando, recarregar: carregar,
    // Ações
    adicionarTransacao, atualizarTransacao, apagarTransacao, importarTransacoes,
    adicionarContaPagar, liquidarContaPagar, apagarContaPagar,
    adicionarContaReceber, liquidarContaReceber, apagarContaReceber,
    adicionarCategoria, removerCategoria, editarCategoria,
    adicionarRegra, apagarRegra,
  }
}
