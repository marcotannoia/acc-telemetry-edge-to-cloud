import { DEFAULT_API_URL } from './apiClient.js'

export async function loadRuntimeConfiguration({ signal } = {}) {
  const response = await fetch(`/runtime-config.json?ts=${Date.now()}`, {
    cache: 'no-store',
    signal,
  })

  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Avvia prima analytics_backend/test_realtime.py per generare la configurazione.')
  }

  const configuration = await response.json().catch(() => {
    throw new Error('runtime-config.json non contiene JSON valido.')
  })

  if (!configuration.user_id) {
    throw new Error('runtime-config.json non contiene user_id.')
  }

  return {
    userId: configuration.user_id,
    apiUrl: configuration.api_url || DEFAULT_API_URL,
    iotEndpoint: configuration.iot_endpoint || '',
  }
}
