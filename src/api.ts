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

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
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

export interface Asset {
  id: number
  name: string
  currency: string
  currentPrice: number
}

export interface AssetPredictions {
  assetId: number
  name: string
  currency: string
  currentPrice: number | null
  predictedVolatility: number | null
  forecastPeriod: number
  quantileReturns: Record<number, number>
}

export function fetchAssets(assetClass: number = 2): Promise<{ assets: Asset[] }> {
  return getJson(`/api/assets?asset_class=${assetClass}`)
}

export function fetchAssetPredictions(assetId: number, forecastPeriod: number): Promise<AssetPredictions> {
  return postJson('/api/asset-predictions', { assetId, forecastPeriod })
}
