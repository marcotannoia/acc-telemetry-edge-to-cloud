export const defaultApiUrl = 'https://iu9g1sfq9j.execute-api.eu-south-1.amazonaws.com/' // url api gateaway
// FLOWCHART -> FRONTEND -? API GATE -> LAMBDA -> API GATE -> FRONTEND

export async function api(payload, apiUrl = defaultApiUrl) { // facciamo richiesta a Lambda, function(parametri_che_voglio, dove mandarli)
  const response = await fetch(apiUrl.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({})) // dal frontend ottengo risposta per la richietsa per dei dati
  const body = typeof data.body === 'string' ? JSON.parse(data.body) : data // prendiamo la parte "utile" dalla risposta 

  if (!response.ok || body.statusCode >= 400) { // errori generici  
    throw new Error(body.message || `Errore API ${response.status}`)
  }

  return body
}
