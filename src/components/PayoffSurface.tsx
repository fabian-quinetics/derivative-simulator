import { useMemo } from 'react'

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
  impliedVol: number
  driftPct: number
  maturityDays: number
}

export default function PayoffSurface(props: Props) {
  const deltas = [-20, -10, 0, 10, 20]
  const maxH = Math.max(1, Math.round(props.maturityDays))
  const horizons = [0.25, 0.5, 0.75, 1].map(f => Math.max(1, Math.round(maxH * f)))

  const grid = useMemo(() => {
    const randNorm = () => {
      let u = 0
      let v = 0
      while (u === 0) u = Math.random()
      while (v === 0) v = Math.random()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    }

    const simulate = (startPrice: number, days: number) => {
      const dt = 1 / 252
      const sigma = props.impliedVol / 100
      const mu = props.driftPct / 100
      const { productType, direction, strikePrice, premium, ratio, knockoutBarrier, factor, adjustmentThreshold } = props

      let payoff = 0
      const sims = 50
      for (let i = 0; i < sims; i++) {
        let price = startPrice
        let certValue = 1
        let knockedOut = false

        for (let d = 0; d < days; d++) {
          const z = randNorm()
          const step = Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z)
          const prev = price
          price = price * step

          if (productType === 'factor') {
            const baseChange = (price - prev) / prev
            const basePct = baseChange * 100
            const capped = Math.abs(basePct) > adjustmentThreshold ? Math.sign(basePct) * adjustmentThreshold : basePct
            const dir = direction === 'call' ? 1 : -1
            certValue = certValue * (1 + (capped / 100) * factor * dir)
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

        if (productType === 'warrant') {
          const v = direction === 'call' ? Math.max(0, (price - strikePrice) * ratio) - premium : Math.max(0, (strikePrice - price) * ratio) - premium
          payoff += v
        } else if (productType === 'knockout') {
          if (!knockedOut) {
            const v = direction === 'call' ? Math.max(0, (price - strikePrice) * ratio) : Math.max(0, (strikePrice - price) * ratio)
            payoff += v
          }
        } else {
          payoff += (certValue - 1) * 100
        }
      }

      return payoff / sims
    }

    const rows = horizons.map(h => {
      return deltas.map(d => {
        const startPrice = props.currentPrice * (1 + d / 100)
        const mean = simulate(startPrice, h)
        return { delta: d, days: h, mean }
      })
    })

    const flat = rows.flat()
    const mins = flat.reduce((m, c) => Math.min(m, c.mean), Infinity)
    const maxs = flat.reduce((m, c) => Math.max(m, c.mean), -Infinity)

    return { rows, min: mins, max: maxs }
  }, [props, horizons])

  const unit = props.productType === 'factor' ? '% Rendite' : 'EUR'

  const colorFor = (v: number) => {
    const { min, max } = grid
    const span = max - min || 1
    const t = (v - min) / span
    const hue = 120 * t
    return `hsl(${hue}, 70%, 45%)`
  }

  return (
    <div className="mc-container">
      <div className="heatmap">
        <div className="heat-header">
          <span>Δ Basiswert (%) →</span>
          <div className="heat-deltas">
            {deltas.map(d => (
              <span key={d}>{d}%</span>
            ))}
          </div>
        </div>
        <div className="heat-body">
          {grid.rows.map((row, i) => (
            <div className="heat-row" key={horizons[i]}>
              <div className="heat-days">{horizons[i]}T</div>
              {row.map(cell => (
                <div
                  key={`${cell.delta}-${cell.days}`}
                  className="heat-cell"
                  style={{ background: colorFor(cell.mean) }}
                  title={`${cell.delta}% / ${cell.days}T: ${cell.mean.toFixed(2)} ${unit}`}
                >
                  {cell.mean.toFixed(1)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="heat-legend">
          <span>Min {grid.min.toFixed(2)} {unit}</span>
          <span>Max {grid.max.toFixed(2)} {unit}</span>
        </div>
      </div>
    </div>
  )
}




