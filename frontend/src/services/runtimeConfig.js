import { defaultApiUrl } from './api.js' // prendo url di api gateaway

// -- FUNZIONE DI LETTURA ENDPOINT E USERID --  

export async function readRuntimeConfig() {
  const response = await fetch(`/runtime-config.json?ts=${Date.now()}`, {
    cache: 'no-store',
  })

  if (!response.ok) { // se non esiste
    throw new Error('Avvia prima analytics_backend/test_realtime.py per generare la configurazione.')
  }

  const config = await response.json()
  if (!config.user_id) {
    throw new Error('runtime-config.json non contiene user_id.')
  }

  return {
    apiUrl: config.api_url || defaultApiUrl,
    userId: config.user_id,
    iotEndpoint: config.iot_endpoint || '',
  }
}
