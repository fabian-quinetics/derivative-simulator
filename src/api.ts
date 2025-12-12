const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8081/derivative-simulator'
    : '/derivative-simulator'

async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await res.json()
}

export function fetchSummary(params: any) {
  return postJson('/api/summary', params)
}

export function fetchMonteCarlo(params: any) {
  return postJson('/api/monte-carlo', params)
}

export function fetchPayoffSurface(params: any) {
  return postJson('/api/payoff-surface', params)
}
