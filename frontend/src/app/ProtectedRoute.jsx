import { Navigate, Outlet } from 'react-router-dom'
import { CenteredMessage } from '../components/CenteredMessage.jsx'
import { useDashboardSession } from '../hooks/useDashboardSession.js'

export default function ProtectedRoute() {
  const { accessMode, isAuthenticated } = useDashboardSession()

  if (accessMode === 'loading') {
    return <CenteredMessage message="Riconoscimento della postazione" />
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />
}
