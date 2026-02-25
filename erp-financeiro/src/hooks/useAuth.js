import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [empresa, setEmpresa] = useState(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) carregarPerfil(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) carregarPerfil(session.user.id)
      else { setPerfil(null); setEmpresa(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const carregarPerfil = async (userId) => {
    try {
      const { data: perfilData } = await supabase
        .from('perfis').select('*, empresa:empresas(*)').eq('id', userId).single()
      if (perfilData) {
        setPerfil(perfilData)
        setEmpresa(perfilData.empresa)
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, senha) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  }

  const registrar = async (email, senha, nome, nomeEmpresa) => {
    const { error } = await supabase.auth.signUp({
      email, password: senha,
      options: { data: { nome, empresa: nomeEmpresa } }
    })
    if (error) throw error
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, perfil, empresa, loading, login, registrar, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
