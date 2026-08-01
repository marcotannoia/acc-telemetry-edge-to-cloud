import { urlApiPredefinito } from './api.js'

//funziona che acquisisce endopint iot, idutente e api url

export async function leggiConfigurazioneRuntime() {
  const risposta = await fetch(`/runtime-config.json?ts=${Date.now()}`, {
    cache: 'no-store',
  })

  if (!risposta.ok || !risposta.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Avvia prima analytics_backend/test_realtime.py per generare la configurazione.')
  }

  const configurazione = await risposta.json().catch(() => {
    throw new Error('runtime-config.json non contiene JSON valido.')
  })

  if (!configurazione.user_id) {
    throw new Error('runtime-config.json non contiene user_id.')
  }

  return {
    idUtente: configurazione.user_id,
    urlApi: configurazione.api_url || urlApiPredefinito, // sarebbe il backend
    endpointIot: configurazione.iot_endpoint || '',
  }
}
