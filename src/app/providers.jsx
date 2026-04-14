import { AuthProvider } from '../auth/AuthProvider.jsx'
import { AppRouter } from './router.jsx'

export function Providers() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
