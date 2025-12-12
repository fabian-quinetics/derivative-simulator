import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchPayoffSurface } from '../api'

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
  riskFreePct: number
  maturityDays: number
}

export default function PayoffSurface(props: Props) {
  const { t } = useTranslation()
  const [grid, setGrid] = useState<any>({ rows: [], min: 0, max: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPayoffSurface(props).then((r) => {
      if (!cancelled) {
        setGrid(r)
        setLoading(false)
      }
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
    props.impliedVol,
    props.driftPct,
    props.riskFreePct,
    props.maturityDays,
  ])

  const colorFor = (v: number) => {
    const maxAbs = Math.max(Math.abs(grid.min ?? 0), Math.abs(grid.max ?? 0)) || 1
    const t = Math.min(1, Math.abs(v) / maxAbs)
    const hue = v >= 0 ? 120 : 0
    const light = 22 + 28 * t
    return `hsl(${hue}, 70%, ${light}%)`
  }

  const deltas = (grid.deltas?.length ? grid.deltas : [-20, -10, 0, 10, 20]) as number[]
  const horizons = (grid.horizons?.length ? grid.horizons : [0.25, 0.5, 0.75, 1].map(f => Math.max(1, Math.round(Math.max(1, Math.round(props.maturityDays)) * f)))) as number[]

  if (loading) {
    return (
      <div className="chart-loader">
        <div className="loader-spinner"></div>
        <span>{t('loading', 'Loading...')}</span>
      </div>
    )
  }

  return (
    <div className="mc-container">
      <div className="heatmap">
        <div className="heat-title">
          <div>{t('heatmap.title')}</div>
          <div className="heat-subtitle">{t('heatmap.unit')}</div>
        </div>

        <div
          className="heat-grid"
          style={{ gridTemplateColumns: `90px repeat(${deltas.length}, 1fr)` }}
        >
          <div className="heat-corner">{t('heatmap.underlyingReturn')}</div>
          {deltas.map((d) => (
            <div key={`d-${d}`} className="heat-col-header">
              {d > 0 ? `+${d}%` : `${d}%`}
            </div>
          ))}

          {grid.rows.map((row, i) => (
            <div key={`r-${horizons[i] ?? i}`} className="heat-row-group">
              <div className="heat-row-header">{(horizons[i] ?? 0)} {t('heatmap.days')}</div>
              {row.map((cell) => (
                <div
                  key={`${cell.delta}-${cell.days}`}
                  className="heat-cell"
                  style={{ background: colorFor(cell.mean) }}
                  title={`Δ ${cell.delta}% | ${cell.days} ${t('heatmap.days')}: ${cell.mean.toFixed(2)} ${t('heatmap.unit')}`}
                >
                  {cell.mean.toFixed(1)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
