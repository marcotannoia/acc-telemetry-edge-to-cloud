export const defaultApiUrl = 'https://iu9g1sfq9j.execute-api.eu-south-1.amazonaws.com/'

export async function api(payload, apiUrl = defaultApiUrl) {
  const response = await fetch(apiUrl.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  const body = typeof data.body === 'string' ? JSON.parse(data.body) : data

  if (!response.ok || body.statusCode >= 400) {
    throw new Error(body.message || `Errore API ${response.status}`)
  }

  return body
}
