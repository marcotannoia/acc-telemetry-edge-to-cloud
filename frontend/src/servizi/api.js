export const urlApiPredefinito = 'https://iu9g1sfq9j.execute-api.eu-south-1.amazonaws.com/'

export async function chiamaApi(payload, urlApi = urlApiPredefinito) {
  const risposta = await fetch(urlApi.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const dati = await risposta.json().catch(() => ({}))
  const corpo = typeof dati.body === 'string' ? JSON.parse(dati.body) : dati

  if (!risposta.ok || corpo.statusCode >= 400) {
    throw new Error(corpo.message || `Errore API ${risposta.status}`)
  }

  return corpo
}
