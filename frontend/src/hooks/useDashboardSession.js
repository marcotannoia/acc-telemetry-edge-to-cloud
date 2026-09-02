import { useContext } from 'react'
import { DashboardSessionContext } from '../context/dashboardSessionContext.js'

export function useDashboardSession() {
  const context = useContext(DashboardSessionContext)

  if (!context) {
    throw new Error('useDashboardSession deve essere usato dentro DashboardSessionProvider.')
  }

  return context
}
