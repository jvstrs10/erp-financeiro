import { useAuth } from '../hooks/useAuth'
import LoginPage from '../components/LoginPage'
import App from '../components/App'

export default function Index() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />
  return <App />
}
