import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'

type ProductType = 'warrant' | 'knockout' | 'factor'
type Direction = 'call' | 'put'

interface Props {
  productType: ProductType
  direction: Direction
  currentPrice: number
  strikePrice: number
  premium: number
  ratio: number
  knockoutBarrier: number
  factor: number
  adjustmentThreshold: number
  volatilityPct: number
  days: number
  sims: number
  driftPct: number
}

export default function MonteCarloSimulator(props: Props) {

  const result = useMemo(() => {
    const randNorm = () => {
      let u = 0
      let v = 0
      while (u === 0) u = Math.random()
      while (v === 0) v = Math.random()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    }

    const payoffs: number[] = []
    const dt = 1 / 252
    const sigma = props.volatilityPct / 100
    const mu = props.driftPct / 100
    const { productType, direction, currentPrice, strikePrice, premium, ratio, knockoutBarrier, factor, adjustmentThreshold, days } = props
    const sims = Math.max(10, Math.min(50, props.sims))

    for (let i = 0; i < sims; i++) {
      let price = currentPrice
      let certValue = 1
      let knockedOut = false
      for (let d = 0; d < days; d++) {
        const z = randNorm()
        const step = Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z)
        const prev = price
        price = price * step
        if (productType === 'factor') {
          const baseChange = (price - prev) / prev
          const baseChangePct = baseChange * 100
          const cappedPct = Math.abs(baseChangePct) > adjustmentThreshold ? Math.sign(baseChangePct) * adjustmentThreshold : baseChangePct
          const dir = direction === 'call' ? 1 : -1
          certValue = certValue * (1 + (cappedPct / 100) * factor * dir)
          if (certValue < 0.001) certValue = 0.001
        }
        if (productType === 'knockout') {
          if (direction === 'call' && price <= knockoutBarrier) {
            knockedOut = true
            break
          }
          if (direction === 'put' && price >= knockoutBarrier) {
            knockedOut = true
            break
          }
        }
      }

      let payoff = 0
      if (productType === 'warrant') {
        payoff = direction === 'call' ? Math.max(0, (price - strikePrice) * ratio) - premium : Math.max(0, (strikePrice - price) * ratio) - premium
      } else if (productType === 'knockout') {
        if (!knockedOut) {
          payoff = direction === 'call' ? Math.max(0, (price - strikePrice) * ratio) : Math.max(0, (strikePrice - price) * ratio)
        }
      } else {
        payoff = (certValue - 1) * 100
      }
      payoffs.push(payoff)
    }

    const sorted = [...payoffs].sort((a, b) => a - b)
    const pct = (p: number) => {
      const idx = Math.floor((p / 100) * (sorted.length - 1))
      return sorted[idx] ?? 0
    }

    const min = Math.min(...payoffs)
    const max = Math.max(...payoffs)
    const bins = 24
    const width = (max - min) / bins || 1
    const histogram = new Array(bins).fill(0).map((_, i) => {
      const start = min + i * width
      const end = start + width
      const count = payoffs.filter(v => v >= start && v < end).length
      return { bucket: `${start.toFixed(1)}`, count }
    })

    const mean = payoffs.reduce((a, b) => a + b, 0) / payoffs.length

    return {
      histogram,
      mean,
      p5: pct(5),
      p50: pct(50),
      p95: pct(95),
    }
  }, [props])

  const unit = props.productType === 'factor' ? '% Rendite' : 'EUR'

  return (
    <div className="mc-container">
      <div className="mc-results">
        <div className="mc-card">
          <span className="mc-label">Mittel</span>
          <span className={`mc-value ${result.mean >= 0 ? 'profit' : 'loss'}`}>{result.mean.toFixed(2)} {unit}</span>
        </div>
        <div className="mc-card">
          <span className="mc-label">p5</span>
          <span className={`mc-value ${result.p5 >= 0 ? 'profit' : 'loss'}`}>{result.p5.toFixed(2)} {unit}</span>
        </div>
        <div className="mc-card">
          <span className="mc-label">Median</span>
          <span className={`mc-value ${result.p50 >= 0 ? 'profit' : 'loss'}`}>{result.p50.toFixed(2)} {unit}</span>
        </div>
        <div className="mc-card">
          <span className="mc-label">p95</span>
          <span className={`mc-value ${result.p95 >= 0 ? 'profit' : 'loss'}`}>{result.p95.toFixed(2)} {unit}</span>
        </div>
      </div>

      <div className="mc-chart">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={result.histogram} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="bucket" tick={{ fill: '#888', fontSize: 10 }} interval={2} label={{ value: unit, position: 'insideBottom', offset: -10, fill: '#aaa' }} />
            <YAxis tick={{ fill: '#888' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} />
            <ReferenceLine y={0} stroke="#666" />
            <Bar dataKey="count" fill="#ffab00" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

