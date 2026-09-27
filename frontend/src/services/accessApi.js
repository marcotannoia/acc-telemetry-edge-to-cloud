import { postApi } from './apiClient.js'

export function accessPayload(credentials) {
  return {
    station_code: credentials.stationCode,
    access_code: credentials.accessCode,
  }
}

export async function createDashboardAccess({ apiUrl, signal, stationCode, userId }) {
  return postApi({
    action: 'create_dashboard_access',
    user_id: userId,
    station_code: stationCode,
  }, { apiUrl, signal })
}

export async function authenticateDashboard({ apiUrl, credentials, signal }) {
  return postApi({
    action: 'authenticate_dashboard',
    ...accessPayload(credentials),
  }, { apiUrl, signal })
}
