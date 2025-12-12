import { useState, useMemo, useRef } from 'react'
import PayoffChart from './PayoffChart'
import PathDependencyChart from './PathDependencyChart'
import MonteCarloSimulator from './MonteCarloSimulator'
import PayoffSurface from './PayoffSurface'

type ProductType = 'warrant' | 'knockout' | 'factor'
type Direction = 'call' | 'put'

const normCdf = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-0.5 * x * x)
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const p = d * poly
  return x > 0 ? 1 - p : p
}

interface WarrantParams {
  productType: ProductType
  direction: Direction
  currentPrice: number
  strikePrice: number
  ratio: number
  knockoutBarrier: number
  factor: number
  adjustmentThreshold: number
  impliedVol: number
  maturityDays: number
  driftPct: number
  rho: number
  riskFreePct: number
}

type BsGreeks = { delta: number; gamma: number; vega: number; theta: number; rho: number }

const optionPriceBS = (p: WarrantParams): { price: number; greeks: BsGreeks } => {
  if (p.productType !== 'warrant') return { price: 0, greeks: { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 } }
  const sigma = p.impliedVol / 100
  const T = Math.max(p.maturityDays / 365, 0.0001)
  const r = p.riskFreePct / 100
  const d1 = (Math.log(p.currentPrice / p.strikePrice) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  const call = p.currentPrice * normCdf(d1) - p.strikePrice * Math.exp(-r * T) * normCdf(d2)
  const put = p.strikePrice * Math.exp(-r * T) * normCdf(-d2) - p.currentPrice * normCdf(-d1)
  const price = (p.direction === 'call' ? call : put) * p.ratio
  const pdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
  const baseDelta = p.direction === 'call' ? normCdf(d1) : normCdf(d1) - 1
  const delta = baseDelta * p.ratio
  const gamma = (pdf(d1) / (p.currentPrice * sigma * Math.sqrt(T))) * p.ratio
  const vega = p.currentPrice * pdf(d1) * Math.sqrt(T) * 0.01 * p.ratio
  const thetaBase = p.direction === 'call'
    ? -(p.currentPrice * pdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * p.strikePrice * Math.exp(-r * T) * normCdf(d2)
    : -(p.currentPrice * pdf(d1) * sigma) / (2 * Math.sqrt(T)) + r * p.strikePrice * Math.exp(-r * T) * normCdf(-d2)
  const theta = (thetaBase / 365) * p.ratio
  const rhoBase = p.direction === 'call'
    ? p.strikePrice * T * Math.exp(-r * T) * normCdf(d2)
    : -p.strikePrice * T * Math.exp(-r * T) * normCdf(-d2)
  const rho = rhoBase * 0.01 * p.ratio
  return { price, greeks: { delta, gamma, vega, theta, rho } }
}

const optionPriceHeston = (p: WarrantParams) => {
  if (p.productType !== 'warrant') return 0
  // Heston deaktiviert – vorübergehend B&S verwenden
  return optionPriceBS(p).price
}

export default function WarrantCalculator() {
  const [params, setParams] = useState<WarrantParams>({
    productType: 'warrant',
    direction: 'call',
    currentPrice: 100,
    strikePrice: 100,
    ratio: 0.1,
    knockoutBarrier: 90,
    factor: 3,
    adjustmentThreshold: 15,
    impliedVol: 30,
    maturityDays: 365,
    driftPct: 6,
    rho: -0.3,
    riskFreePct: 1,
  })
  const [impliedVolDraft, setImpliedVolDraft] = useState(30)
  const [maturityDraft, setMaturityDraft] = useState(365)
  const [driftDraft, setDriftDraft] = useState(6)
  const [rhoDraft, setRhoDraft] = useState(-0.3)
  const [riskFreeDraft, setRiskFreeDraft] = useState(1)
  const impliedVolTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maturityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const driftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const riskFreeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rhoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateParam = <K extends keyof WarrantParams>(key: K, value: WarrantParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const { price: bsPrice, greeks: bsGreeks } = useMemo(() => optionPriceBS(params), [params])
  const hestonPrice = useMemo(() => optionPriceHeston(params), [params])
  const premiumValue = params.productType === 'warrant' ? bsPrice : 0

  const metrics = useMemo(() => {
    const { productType, direction, currentPrice, strikePrice, ratio, knockoutBarrier, factor } = params
    const premium = premiumValue

    if (productType === 'warrant') {
      let intrinsicValue = 0
      if (direction === 'call') {
        intrinsicValue = Math.max(0, (currentPrice - strikePrice) * ratio)
      } else {
        intrinsicValue = Math.max(0, (strikePrice - currentPrice) * ratio)
      }
      const timeValue = Math.max(0, premium - intrinsicValue)
      const breakeven = direction === 'call' 
        ? strikePrice + (premium / ratio)
        : strikePrice - (premium / ratio)
      const leverage = premium > 0 ? (currentPrice * ratio) / premium : 0
      const moneyness = direction === 'call'
        ? currentPrice > strikePrice ? 'Im Geld' : currentPrice === strikePrice ? 'Am Geld' : 'Aus dem Geld'
        : currentPrice < strikePrice ? 'Im Geld' : currentPrice === strikePrice ? 'Am Geld' : 'Aus dem Geld'
      return { intrinsicValue, timeValue, breakeven, leverage, moneyness, knockoutDistance: 0, dailyChange: 0 }
    }
    
    if (productType === 'knockout') {
      let intrinsicValue = direction === 'call'
        ? Math.max(0, (currentPrice - strikePrice) * ratio)
        : Math.max(0, (strikePrice - currentPrice) * ratio)
      const knockoutDistance = direction === 'call'
        ? ((currentPrice - knockoutBarrier) / currentPrice) * 100
        : ((knockoutBarrier - currentPrice) / currentPrice) * 100
      const leverage = currentPrice / (currentPrice - strikePrice) || 0
      const isKnockedOut = direction === 'call' 
        ? currentPrice <= knockoutBarrier
        : currentPrice >= knockoutBarrier
      return { 
        intrinsicValue: isKnockedOut ? 0 : intrinsicValue, 
        timeValue: 0, 
        breakeven: strikePrice, 
        leverage: Math.abs(leverage), 
        moneyness: isKnockedOut ? 'Ausgeknockt' : knockoutDistance > 10 ? 'Sicher' : 'Gefährdet',
        knockoutDistance,
        dailyChange: 0
      }
    }
    
    if (productType === 'factor') {
      const dailyChange = 1.5
      const factorReturn = dailyChange * factor
      return { 
        intrinsicValue: 0, 
        timeValue: 0, 
        breakeven: 0, 
        leverage: factor,
        moneyness: direction === 'call' ? 'Long' : 'Short',
        knockoutDistance: 0,
        dailyChange: factorReturn
      }
    }
    
    return { intrinsicValue: 0, timeValue: 0, breakeven: 0, leverage: 0, moneyness: '', knockoutDistance: 0, dailyChange: 0 }
  }, [params, premiumValue])

  const chartData = useMemo(() => {
    const { productType, direction, strikePrice, ratio, knockoutBarrier, factor, currentPrice } = params
    const premium = premiumValue
    const data = []
    
    if (productType === 'warrant') {
      const mid = (strikePrice + currentPrice) / 2
      const span = Math.max(strikePrice, currentPrice) * 0.6
      const start = Math.max(0, mid - span)
      const end = mid + span
      for (let price = start; price <= end; price += (end - start) / 50) {
        let payoff = direction === 'call'
          ? Math.max(0, (price - strikePrice) * ratio) - premium
          : Math.max(0, (strikePrice - price) * ratio) - premium
        data.push({ price: Math.round(price * 100) / 100, payoff: Math.round(payoff * 100) / 100, zero: 0 })
      }
    }
    
    if (productType === 'knockout') {
      const range = strikePrice * 0.4
      const start = direction === 'call' ? knockoutBarrier : strikePrice - range
      const end = direction === 'call' ? strikePrice + range : knockoutBarrier
      const buyPrice = direction === 'call'
        ? (currentPrice - strikePrice) * ratio
        : (strikePrice - currentPrice) * ratio
      for (let price = start; price <= end; price += (end - start) / 50) {
        let value = direction === 'call'
          ? Math.max(0, (price - strikePrice) * ratio)
          : Math.max(0, (strikePrice - price) * ratio)
        const payoff = value - buyPrice
        data.push({ price: Math.round(price * 100) / 100, payoff: Math.round(payoff * 100) / 100, zero: 0, knockout: knockoutBarrier })
      }
    }
    
    if (productType === 'factor') {
      for (let change = -10; change <= 10; change += 0.5) {
        const factorReturn = change * factor * (direction === 'call' ? 1 : -1)
        data.push({ price: change, payoff: Math.round(factorReturn * 100) / 100, zero: 0 })
      }
    }
    
    return data
  }, [params, premiumValue])

  const factorHistogram = useMemo(() => {
    if (params.productType !== 'factor') return []
    const { currentPrice, factor, direction, adjustmentThreshold } = params
    const volatility = 20
    const days = 60
    const sims = 200
    const drift = 0
    const randNorm = () => {
      let u = 0
      let v = 0
      while (u === 0) u = Math.random()
      while (v === 0) v = Math.random()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    }
    const payoffs: number[] = []
    const dt = 1 / 252
    const sigma = volatility / 100
    const mu = drift / 100
    for (let i = 0; i < sims; i++) {
      let price = currentPrice
      let certValue = 1
      for (let d = 0; d < days; d++) {
        const z = randNorm()
        const step = Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z)
        const prev = price
        price = price * step
        const baseChangePct = ((price - prev) / prev) * 100
        const cappedPct = Math.abs(baseChangePct) > adjustmentThreshold ? Math.sign(baseChangePct) * adjustmentThreshold : baseChangePct
        const dir = direction === 'call' ? 1 : -1
        certValue = certValue * (1 + (cappedPct / 100) * factor * dir)
        if (certValue < 0.001) certValue = 0.001
      }
      payoffs.push((certValue - 1) * 100)
    }
    if (payoffs.length === 0) return []
    const min = Math.min(...payoffs)
    const max = Math.max(...payoffs)
    const bins = 24
    const width = (max - min) / bins || 1
    return new Array(bins).fill(0).map((_, i) => {
      const start = min + i * width
      const end = start + width
      const count = payoffs.filter(v => v >= start && v < end).length
      const mid = (start + end) / 2
      return { bucket: Math.round(mid * 10) / 10, count }
    })
  }, [params])

  const productLabels = {
    warrant: 'Optionsschein',
    knockout: 'Knock-Out',
    factor: 'Faktor-Zertifikat'
  }

  return (
    <div className="calculator">
      <div className="input-section">
        <h2>Produkt</h2>
        
        <div className="product-select">
          {(['warrant', 'knockout', 'factor'] as ProductType[]).map(type => (
            <button
              key={type}
              className={`product-btn ${params.productType === type ? 'active' : ''}`}
              onClick={() => updateParam('productType', type)}
            >
              {productLabels[type]}
            </button>
          ))}
        </div>

        <div className="type-toggle">
          <button 
            className={`toggle-btn ${params.direction === 'call' ? 'active call' : ''}`}
            onClick={() => updateParam('direction', 'call')}
          >
            {params.productType === 'factor' ? 'Long' : 'Call'}
          </button>
          <button 
            className={`toggle-btn ${params.direction === 'put' ? 'active put' : ''}`}
            onClick={() => updateParam('direction', 'put')}
          >
            {params.productType === 'factor' ? 'Short' : 'Put'}
          </button>
        </div>

        <div className="input-group">
          <label>Aktueller Kurs des Basiswerts (EUR)</label>
          <input
            type="number"
            value={params.currentPrice}
            onChange={e => updateParam('currentPrice', parseFloat(e.target.value) || 0)}
          />
          <input
            type="range"
            min="10"
            max="200"
            value={params.currentPrice}
            onChange={e => updateParam('currentPrice', parseFloat(e.target.value))}
          />
        </div>

        {params.productType !== 'factor' && (
          <div className="input-group">
            <label>{params.productType === 'knockout' ? 'Basispreis (Strike)' : 'Basispreis / Strike'} (EUR)</label>
            <input
              type="number"
              value={params.strikePrice}
              onChange={e => updateParam('strikePrice', parseFloat(e.target.value) || 0)}
            />
            <input
              type="range"
              min="10"
              max="200"
              value={params.strikePrice}
              onChange={e => updateParam('strikePrice', parseFloat(e.target.value))}
            />
          </div>
        )}

        {params.productType === 'warrant' && (
          <>
            <div className="input-group">
              <label>Implizite Vola (%)</label>
              <input
                type="number"
                value={params.impliedVol}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0
                  setImpliedVolDraft(v)
                  updateParam('impliedVol', v)
                }}
              />
              <input
                type="range"
                min="5"
                max="80"
                value={impliedVolDraft}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setImpliedVolDraft(v)
                  if (impliedVolTimer.current) clearTimeout(impliedVolTimer.current)
                  impliedVolTimer.current = setTimeout(() => updateParam('impliedVol', v), 400)
                }}
                onMouseUp={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('impliedVol', v)
                }}
                onTouchEnd={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('impliedVol', v)
                }}
              />
            </div>
            <div className="input-group">
              <label>Laufzeit (Tage, max 1095)</label>
              <input
                type="number"
                value={params.maturityDays}
                onChange={e => {
                  const v = Math.min(1095, Math.max(1, parseFloat(e.target.value) || 1))
                  setMaturityDraft(v)
                  updateParam('maturityDays', v)
                }}
                step="1"
              />
              <input
                type="range"
                min="1"
                max="1095"
                step="1"
                value={maturityDraft}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setMaturityDraft(v)
                  if (maturityTimer.current) clearTimeout(maturityTimer.current)
                  maturityTimer.current = setTimeout(() => updateParam('maturityDays', v), 400)
                }}
                onMouseUp={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('maturityDays', v)
                }}
                onTouchEnd={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('maturityDays', v)
                }}
              />
            </div>
            <div className="input-group">
              <label>Drift p.a. (%)</label>
              <input
                type="number"
                value={params.driftPct}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0
                  setDriftDraft(v)
                  updateParam('driftPct', v)
                }}
                step="0.1"
              />
              <input
                type="range"
                min="-10"
                max="15"
                step="0.1"
                value={driftDraft}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setDriftDraft(v)
                  if (driftTimer.current) clearTimeout(driftTimer.current)
                  driftTimer.current = setTimeout(() => updateParam('driftPct', v), 400)
                }}
                onMouseUp={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('driftPct', v)
                }}
                onTouchEnd={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('driftPct', v)
                }}
              />
            </div>
            <div className="input-group">
              <label>Risikofreier Zins p.a. (%)</label>
              <input
                type="number"
                value={params.riskFreePct}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0
                  setRiskFreeDraft(v)
                  updateParam('riskFreePct', v)
                }}
                step="0.1"
              />
              <input
                type="range"
                min="-2"
                max="10"
                step="0.1"
                value={riskFreeDraft}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setRiskFreeDraft(v)
                  if (riskFreeTimer.current) clearTimeout(riskFreeTimer.current)
                  riskFreeTimer.current = setTimeout(() => updateParam('riskFreePct', v), 400)
                }}
                onMouseUp={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('riskFreePct', v)
                }}
                onTouchEnd={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('riskFreePct', v)
                }}
              />
            </div>
            <div className="input-group">
              <label>Bezugsverhältnis (z.B. 0.1 = 1:10)</label>
              <input
                type="number"
                value={params.ratio}
                onChange={e => updateParam('ratio', parseFloat(e.target.value) || 0.1)}
                step="0.01"
              />
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={params.ratio}
                onChange={e => updateParam('ratio', parseFloat(e.target.value))}
              />
            </div>
            <div className="input-group">
              <label>rho (Korrelation)</label>
              <input
                type="number"
                value={params.rho}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setRhoDraft(v)
                  updateParam('rho', v)
                }}
                step="0.05"
              />
              <input
                type="range"
                min="-0.9"
                max="0.9"
                step="0.05"
                value={rhoDraft}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setRhoDraft(v)
                  if (rhoTimer.current) clearTimeout(rhoTimer.current)
                  rhoTimer.current = setTimeout(() => updateParam('rho', v), 400)
                }}
                onMouseUp={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('rho', v)
                }}
                onTouchEnd={e => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  updateParam('rho', v)
                }}
              />
            </div>
          </>
        )}

        {params.productType === 'knockout' && (
          <>
            <div className="input-group">
              <label>Knock-Out Barriere (EUR)</label>
              <input
                type="number"
                value={params.knockoutBarrier}
                onChange={e => updateParam('knockoutBarrier', parseFloat(e.target.value) || 0)}
              />
              <input
                type="range"
                min="10"
                max="200"
                value={params.knockoutBarrier}
                onChange={e => updateParam('knockoutBarrier', parseFloat(e.target.value))}
              />
            </div>
            <div className="input-group">
              <label>Bezugsverhältnis</label>
              <input
                type="number"
                value={params.ratio}
                onChange={e => updateParam('ratio', parseFloat(e.target.value) || 0.1)}
                step="0.01"
              />
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={params.ratio}
                onChange={e => updateParam('ratio', parseFloat(e.target.value))}
              />
            </div>
          </>
        )}

        {params.productType === 'factor' && (
          <div className="input-group">
            <label>Hebelfaktor</label>
            <input
              type="number"
              value={params.factor}
              onChange={e => updateParam('factor', parseFloat(e.target.value) || 2)}
            />
            <input
              type="range"
              min="2"
              max="10"
              value={params.factor}
              onChange={e => updateParam('factor', parseFloat(e.target.value))}
            />
          </div>
        )}
        {params.productType === 'factor' && (
          <div className="input-group">
            <label>Anpassungsschwelle (% pro Tag)</label>
            <input
              type="number"
              value={params.adjustmentThreshold}
              onChange={e => updateParam('adjustmentThreshold', parseFloat(e.target.value) || 1)}
            />
            <input
              type="range"
              min="5"
              max="25"
              step="1"
              value={params.adjustmentThreshold}
              onChange={e => updateParam('adjustmentThreshold', parseFloat(e.target.value))}
            />
          </div>
        )}
      </div>

      <div className="results-section">
        <div className="metrics">
          <h2>Kennzahlen</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">Status</span>
              <span className={`metric-value status ${
                metrics.moneyness === 'Im Geld' || metrics.moneyness === 'Sicher' || metrics.moneyness === 'Long' ? 'itm' : 
                metrics.moneyness === 'Am Geld' ? 'atm' : 
                metrics.moneyness === 'Ausgeknockt' ? 'knockout' : 'otm'
              }`}>
                {metrics.moneyness}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Basiswert</span>
              <span className="metric-value">{params.currentPrice.toFixed(2)} EUR</span>
            </div>
            
            {params.productType === 'warrant' && (
              <>
                <div className="metric-card">
                  <span className="metric-label">Innerer Wert</span>
                  <span className="metric-value">{metrics.intrinsicValue.toFixed(2)} EUR</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Zeitwert</span>
                  <span className="metric-value">{metrics.timeValue.toFixed(2)} EUR</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Break-Even</span>
                  <span className="metric-value">{metrics.breakeven.toFixed(2)} EUR</span>
                </div>
              </>
            )}
            
            {params.productType === 'knockout' && (
              <>
                <div className="metric-card">
                  <span className="metric-label">Wert</span>
                  <span className="metric-value">{metrics.intrinsicValue.toFixed(2)} EUR</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">KO-Abstand</span>
                  <span className={`metric-value ${metrics.knockoutDistance < 5 ? 'loss' : ''}`}>
                    {metrics.knockoutDistance.toFixed(1)}%
                  </span>
                </div>
              </>
            )}
            
            {params.productType === 'factor' && (
              <div className="metric-card">
                <span className="metric-label">Bei +1% Basiswert</span>
                <span className="metric-value profit">
                  {params.direction === 'call' ? '+' : '-'}{params.factor}%
                </span>
              </div>
            )}

            <div className="metric-card">
              <span className="metric-label">Hebel</span>
              <span className="metric-value">{metrics.leverage.toFixed(2)}x</span>
            </div>
            
            {params.productType === 'warrant' && (
              <>
                <div className="metric-card">
                  <span className="metric-label">Preis B&S</span>
                  <span className="metric-value">{bsPrice.toFixed(3)} EUR</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Preis Heston</span>
                  <span className="metric-value">{hestonPrice.toFixed(3)} EUR</span>
                </div>
            <div className="metric-card">
              <span className="metric-label">Drift p.a.</span>
              <span className="metric-value">{params.driftPct.toFixed(2)}%</span>
            </div>
                <div className="metric-card">
                  <span className="metric-label">Risikofrei p.a.</span>
                  <span className="metric-value">{params.riskFreePct.toFixed(2)}%</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Delta</span>
                  <span className="metric-value">{bsGreeks.delta.toFixed(3)}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Gamma</span>
                  <span className="metric-value">{bsGreeks.gamma.toFixed(5)}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Vega</span>
                  <span className="metric-value">{bsGreeks.vega.toFixed(3)}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Theta (p/Tag)</span>
                  <span className="metric-value">{bsGreeks.theta.toFixed(3)}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Rho</span>
                  <span className="metric-value">{bsGreeks.rho.toFixed(3)}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Max. Verlust</span>
                  <span className="metric-value loss">-{premiumValue.toFixed(2)} EUR</span>
                </div>
              </>
            )}
            
            {params.productType === 'knockout' && (
              <div className="metric-card">
                <span className="metric-label">Max. Verlust</span>
                <span className="metric-value loss">-100%</span>
              </div>
            )}
          </div>
        </div>

        <div className="chart-container">
          <h2>
            {params.productType === 'factor' 
              ? 'Tägliche Performance' 
              : 'Auszahlungsprofil bei Fälligkeit'}
          </h2>
          <PayoffChart 
            data={chartData} 
            type={params.direction} 
            breakeven={metrics.breakeven}
            productType={params.productType}
            knockoutBarrier={params.knockoutBarrier}
            histogram={factorHistogram}
            currentPrice={params.currentPrice}
            strikePrice={params.strikePrice}
          />
        </div>

        {params.productType !== 'factor' && (
          <div className="chart-container mc-block">
            <h2>Monte-Carlo Payoff</h2>
            <MonteCarloSimulator
              productType={params.productType}
              direction={params.direction}
              currentPrice={params.currentPrice}
              strikePrice={params.strikePrice}
              premium={premiumValue}
              ratio={params.ratio}
              knockoutBarrier={params.knockoutBarrier}
              factor={params.factor}
              adjustmentThreshold={params.adjustmentThreshold}
              volatilityPct={params.impliedVol}
              days={params.maturityDays}
              sims={50}
              driftPct={params.driftPct}
            />
          </div>
        )}

        <div className="chart-container surface-block">
          <h2>Payoff-Surface</h2>
          <PayoffSurface
            productType={params.productType}
            direction={params.direction}
            currentPrice={params.currentPrice}
            strikePrice={params.strikePrice}
            premium={premiumValue}
            ratio={params.ratio}
            knockoutBarrier={params.knockoutBarrier}
            factor={params.factor}
            adjustmentThreshold={params.adjustmentThreshold}
            impliedVol={params.impliedVol}
            driftPct={params.driftPct}
            maturityDays={params.maturityDays}
          />
        </div>

        {params.productType === 'factor' && (
          <div className="chart-container path-container">
            <h2>Pfadabhängigkeit Simulation</h2>
            <PathDependencyChart factor={params.factor} direction={params.direction} adjustmentThreshold={params.adjustmentThreshold} />
          </div>
        )}

        <div className="explanation">
          <h3>{productLabels[params.productType]} - {params.direction === 'call' ? (params.productType === 'factor' ? 'Long' : 'Call') : (params.productType === 'factor' ? 'Short' : 'Put')}</h3>
          {params.productType === 'warrant' && params.direction === 'call' && (
            <p>
              Sie setzen auf <strong>steigende Kurse</strong>. Liegt der Basiswert bei Fälligkeit über {params.strikePrice.toFixed(2)} EUR, 
              erhalten Sie die Differenz multipliziert mit dem Bezugsverhältnis. 
              Ihr Break-Even liegt bei <strong>{metrics.breakeven.toFixed(2)} EUR</strong>. 
              Darunter verfällt der Optionsschein wertlos.
            </p>
          )}
          {params.productType === 'warrant' && params.direction === 'put' && (
            <p>
              Sie setzen auf <strong>fallende Kurse</strong>. Liegt der Basiswert bei Fälligkeit unter {params.strikePrice.toFixed(2)} EUR, 
              erhalten Sie die Differenz multipliziert mit dem Bezugsverhältnis. 
              Ihr Break-Even liegt bei <strong>{metrics.breakeven.toFixed(2)} EUR</strong>. 
              Darüber verfällt der Optionsschein wertlos.
            </p>
          )}
          {params.productType === 'knockout' && params.direction === 'call' && (
            <p>
              <strong>Knock-Out Long:</strong> Sie profitieren von steigenden Kursen mit konstantem Hebel. 
              <span className="warning"> Achtung: Fällt der Basiswert auf oder unter {params.knockoutBarrier.toFixed(2)} EUR, 
              verfällt das Produkt sofort wertlos!</span> Aktueller Abstand zur Barriere: <strong>{metrics.knockoutDistance.toFixed(1)}%</strong>.
            </p>
          )}
          {params.productType === 'knockout' && params.direction === 'put' && (
            <p>
              <strong>Knock-Out Short:</strong> Sie profitieren von fallenden Kursen mit konstantem Hebel. 
              <span className="warning"> Achtung: Steigt der Basiswert auf oder über {params.knockoutBarrier.toFixed(2)} EUR, 
              verfällt das Produkt sofort wertlos!</span> Aktueller Abstand zur Barriere: <strong>{metrics.knockoutDistance.toFixed(1)}%</strong>.
            </p>
          )}
          {params.productType === 'factor' && (
            <p>
              <strong>Faktor {params.factor}x {params.direction === 'call' ? 'Long' : 'Short'}:</strong> Das Zertifikat bildet die 
              <strong> tägliche</strong> prozentuale Veränderung des Basiswerts mit Faktor {params.factor} ab. 
              {params.direction === 'call' 
                ? ` Steigt der Basiswert um 1%, gewinnt das Zertifikat ${params.factor}%.`
                : ` Fällt der Basiswert um 1%, gewinnt das Zertifikat ${params.factor}%.`}
              <span className="warning"> Achtung: Pfadabhängigkeit! Bei längerer Haltedauer kann die Performance 
              erheblich vom erwarteten Ergebnis abweichen.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
