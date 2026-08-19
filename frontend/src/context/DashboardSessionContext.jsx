import { useEffect, useState } from 'react'
import { authenticateDashboard, createDashboardAccess } from '../services/accessApi.js'
import { DEFAULT_API_URL } from '../services/apiClient.js'
import { loadRuntimeConfiguration } from '../services/runtimeConfiguration.js'
import { errorMessage } from '../utils/errorMessage.js'
import { DashboardSessionContext } from './dashboardSessionContext.js'

export function DashboardSessionProvider({ children }) {
  const [runtimeConfiguration, setRuntimeConfiguration] = useState(null)
  const [accessMode, setAccessMode] = useState('loading')
  const [accessError, setAccessError] = useState('')
  const [accessLoading, setAccessLoading] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState(null)
  const [credentials, setCredentials] = useState(null)
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL)

  useEffect(() => {
    const controller = new AbortController()

    async function recogniseStation() {
      try {
        const configuration = await loadRuntimeConfiguration({ signal: controller.signal })
        setRuntimeConfiguration(configuration)
        setApiUrl(configuration.apiUrl)
        setAccessMode('pilot')
      } catch (error) {
        if (error.name === 'AbortError') return
        setRuntimeConfiguration(null)
        setApiUrl(DEFAULT_API_URL)
        setAccessMode('engineer')
      }
    }

    recogniseStation()
    return () => controller.abort()
  }, [])

  async function generateAccess(stationCode) {
    if (!runtimeConfiguration) return false

    setAccessLoading(true)
    setAccessError('')

    try {
      const data = await createDashboardAccess({
        apiUrl,
        stationCode,
        userId: runtimeConfiguration.userId,
      })
      const nextCredentials = {
        stationCode: data.station_code,
        accessCode: data.access_code,
      }

      setGeneratedCodes(nextCredentials)
      setCredentials(nextCredentials)
      return true
    } catch (error) {
      setAccessError(errorMessage(error))
      return false
    } finally {
      setAccessLoading(false)
    }
  }

  async function loginAsEngineer(stationCode, accessCode) {
    setAccessLoading(true)
    setAccessError('')

    try {
      const nextCredentials = { stationCode, accessCode }
      await authenticateDashboard({ apiUrl, credentials: nextCredentials })
      setCredentials(nextCredentials)
      return true
    } catch (error) {
      setAccessError(errorMessage(error))
      return false
    } finally {
      setAccessLoading(false)
    }
  }

  const value = {
    accessError,
    accessLoading,
    accessMode,
    apiUrl,
    credentials,
    generatedCodes,
    generateAccess,
    isAuthenticated: Boolean(credentials),
    loginAsEngineer,
    runtimeConfiguration,
  }

  return (
    <DashboardSessionContext.Provider value={value}>
      {children}
    </DashboardSessionContext.Provider>
  )
}
