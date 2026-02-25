import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Wallet, Mail, Lock, User, Building2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const { login, registrar } = useAuth()
  const [modo, setModo] = useState('login') // 'login' | 'registrar'
  const [form, setForm] = useState({ email: '', senha: '', nome: '', empresa: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro(''); setSucesso(''); setCarregando(true)

    try {
      if (modo === 'login') {
        await login(form.email, form.senha)
      } else {
        if (!form.nome.trim()) { setErro('Informe seu nome.'); return }
        if (!form.empresa.trim()) { setErro('Informe o nome da empresa.'); return }
        if (form.senha.length < 6) { setErro('Senha deve ter ao menos 6 caracteres.'); return }
        await registrar(form.email, form.senha, form.nome, form.empresa)
        setSucesso('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
        setModo('login')
      }
    } catch (err) {
      const msgs = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'User already registered': 'Este e-mail já está cadastrado.',
        'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
      }
      setErro(msgs[err.message] || err.message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">ERP Financeiro</h1>
          <p className="text-slate-500 mt-1">Gestão financeira completa para sua empresa</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Abas */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => { setModo('login'); setErro(''); setSucesso('') }}
              className={`flex-1 py-4 font-bold text-sm transition-all ${modo === 'login' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}
            >Entrar</button>
            <button
              onClick={() => { setModo('registrar'); setErro(''); setSucesso('') }}
              className={`flex-1 py-4 font-bold text-sm transition-all ${modo === 'registrar' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}
            >Criar Conta</button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {/* Alertas */}
            {erro && (
              <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />{erro}
              </div>
            )}
            {sucesso && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />{sucesso}
              </div>
            )}

            {/* Campos de registro */}
            {modo === 'registrar' && (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Seu Nome</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text" required placeholder="João Silva"
                      value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nome da Empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text" required placeholder="Minha Empresa Ltda"
                      value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* E-mail */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email" required placeholder="seu@email.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password" required placeholder="••••••••"
                  value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit" disabled={carregando}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-lg py-4 rounded-xl shadow-lg transition-all"
            >
              {carregando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar Minha Conta'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          Cada empresa tem seus dados isolados e seguros
        </p>
      </div>
    </div>
  )
}
