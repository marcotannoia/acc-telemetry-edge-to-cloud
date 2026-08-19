import { DashboardSessionProvider } from '../context/DashboardSessionContext.jsx'

export function AppProviders({ children }) {
  return (
    <DashboardSessionProvider>
      {children}
    </DashboardSessionProvider>
  )
}
