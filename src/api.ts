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

export interface PathDependencyResult {
  data: Array<{ day: number; base: number; cert: number; opt: number; difference: number }>
  baseReturn: number
  certReturn: number
  optReturn: number
  expectedReturn: number
  volatilityDrag: number
}

export function fetchPathDependency(params: {
  factor: number
  direction: 'call' | 'put'
  adjustmentThreshold: number
  impliedVolPct: number
  riskFreePct: number
  timeHorizonDays: number
  quantileReturns?: Record<number, number>
  selectedQuantile?: number
  manualScenario?: string
}): Promise<PathDependencyResult> {
  return postJson('/api/path-dependency', params)
}

export interface QuantilePayoffResult {
  data: Array<{ quantile: number; underlyingReturn: number; payoff: number }>
  forecastPeriod: number
}

export function fetchQuantilePayoff(params: {
  productType: string
  direction: string
  currentPrice: number
  strikePrice: number
  premium: number
  knockoutBarrier?: number
  ratio?: number
  quantileReturns: Record<number, number>
  forecastPeriod?: number
}): Promise<QuantilePayoffResult> {
  return postJson('/api/quantile-payoff', params)
}