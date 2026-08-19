export const DEFAULT_API_URL = 'https://iu9g1sfq9j.execute-api.eu-south-1.amazonaws.com/'

function responseBody(data) {
  if (typeof data.body !== 'string') return data

  try {
    return JSON.parse(data.body)
  } catch {
    return data
  }
}

export async function postApi(payload, { apiUrl = DEFAULT_API_URL, signal } = {}) {
  const response = await fetch(apiUrl.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  const data = await response.json().catch(() => ({}))
  const body = responseBody(data)

  if (!response.ok || body.statusCode >= 400) {
    throw new Error(body.message || `Errore API ${response.status}`)
  }

  return body
}
