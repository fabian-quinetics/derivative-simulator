import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { fetchMonteCarlo } from '../api'

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

  const [result, setResult] = useState<any>({ histogram: [], mean: 0, p5: 0, p50: 0, p95: 0 })

  useEffect(() => {
    let cancelled = false
    fetchMonteCarlo(props).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [
    props.productType,
    props.direction,
    props.currentPrice,
    props.strikePrice,
    props.premium,
    props.ratio,
    props.knockoutBarrier,
    props.factor,
    props.adjustmentThreshold,
    props.volatilityPct,
    props.days,
    props.sims,
    props.driftPct,
  ])

  const maxLoss = -100
  const xInterval = result?.histogram?.length > 25 ? Math.ceil(result.histogram.length / 10) : 1

  return (
    <div className="mc-container">
      <div className="mc-results">
        <div className="mc-card">
          <span className="mc-label">Max. Verlust</span>
          <span className="mc-value loss">{maxLoss.toFixed(0)}%</span>
        </div>
        <div className="mc-card">
          <span className="mc-label">Mittel</span>
          <span className={`mc-value ${result.mean >= 0 ? 'profit' : 'loss'}`}>{result.mean.toFixed(1)}%</span>
        </div>
        <div className="mc-card">
          <span className="mc-label">Schlecht (5%)</span>
          <span className={`mc-value ${result.p5 >= 0 ? 'profit' : 'loss'}`}>{result.p5.toFixed(1)}%</span>
        </div>
        <div className="mc-card">
          <span className="mc-label">Median</span>
          <span className={`mc-value ${result.p50 >= 0 ? 'profit' : 'loss'}`}>{result.p50.toFixed(1)}%</span>
        </div>
        <div className="mc-card">
          <span className="mc-label">Gut (95%)</span>
          <span className={`mc-value ${result.p95 >= 0 ? 'profit' : 'loss'}`}>{result.p95.toFixed(1)}%</span>
        </div>
      </div>

      <div className="mc-chart">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={result.histogram} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
            <XAxis dataKey="bucket" tick={{ fill: '#888', fontSize: 9 }} interval={xInterval} label={{ value: 'Rendite (%)', position: 'insideBottom', offset: -10, fill: '#666' }} />
            <YAxis tick={{ fill: '#888' }} label={{ value: 'Anteil (%)', angle: -90, position: 'insideLeft', fill: '#666' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181f', border: '1px solid #2a2a32', borderRadius: '6px' }}
              labelStyle={{ color: '#f1f1f1' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Anteil']}
            />
            <ReferenceLine y={0} stroke="#666" />
            <Bar dataKey="count" fill="#ffab00" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

