import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchPayoffSurface, fetchQuantilePayoff } from '../api'

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
  quantileReturns?: Record<number, number>
  forecastPeriod?: number
}

export default function PayoffSurface(props: Props) {
  const { t } = useTranslation()
  const [grid, setGrid] = useState<any>({ rows: [], min: 0, max: 0 })
  const [quantileData, setQuantileData] = useState<Array<{ quantile: number; underlyingReturn: number; payoff: number }>>([])
  const [loading, setLoading] = useState(true)

  const hasQuantiles = props.quantileReturns && Object.keys(props.quantileReturns).length > 0

  const requestKey = JSON.stringify({
    productType: props.productType,
    direction: props.direction,
    currentPrice: props.currentPrice,
    strikePrice: props.strikePrice,
    premium: props.premium,
    knockoutBarrier: props.knockoutBarrier,
    ratio: props.ratio,
    quantileReturns: props.quantileReturns,
    forecastPeriod: props.forecastPeriod,
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setQuantileData([])
    
    if (hasQuantiles) {
      fetchQuantilePayoff({
        productType: props.productType,
        direction: props.direction,
        currentPrice: props.currentPrice,
        strikePrice: props.strikePrice,
        premium: props.premium,
        knockoutBarrier: props.knockoutBarrier,
        ratio: props.ratio,
        quantileReturns: props.quantileReturns!,
        forecastPeriod: props.forecastPeriod,
      }).then((res) => {
        if (!cancelled) {
          setQuantileData(res.data)
          setLoading(false)
        }
      }).catch(() => {
        if (!cancelled) setLoading(false)
      })
    } else {
      fetchPayoffSurface(props).then((r) => {
        if (!cancelled) {
          setGrid(r)
          setLoading(false)
        }
      }).catch(() => {
        if (!cancelled) setLoading(false)
      })
    }
    
    return () => { cancelled = true }
  }, [requestKey, hasQuantiles])

  const colorFor = (v: number) => {
    const maxAbs = 100
    const t = Math.min(1, Math.abs(v) / maxAbs)
    const hue = v >= 0 ? 120 : 0
    const light = 22 + 28 * t
    return `hsl(${hue}, 70%, ${light}%)`
  }

  if (loading) {
    return (
      <div className="chart-loader">
        <div className="loader-spinner"></div>
        <span>{t('loading', 'Loading...')}</span>
      </div>
    )
  }

  if (hasQuantiles && quantileData.length > 0) {
    return (
      <div className="mc-container">
        <div className="heatmap">
          <div className="heat-title">
            <div>{t('heatmap.quantileTitle', 'ML Quantile Payoffs')} ({props.forecastPeriod} {t('heatmap.days')})</div>
            <div className="heat-subtitle">{t('heatmap.unit')}</div>
          </div>

          <div className="quantile-payoff-table">
            <div className="qp-header-row">
              <div className="qp-header">{t('heatmap.quantile', 'Quantile')}</div>
              <div className="qp-header">{t('heatmap.underlyingReturn', 'Underlying Return')}</div>
              <div className="qp-header">{t('heatmap.productPayoff', 'Product Payoff')}</div>
            </div>
            {quantileData.map(({ quantile, underlyingReturn, payoff }) => (
              <div 
                key={quantile} 
                className={`qp-row ${quantile < 50 ? 'bearish' : quantile > 50 ? 'bullish' : 'neutral'}`}
              >
                <div className="qp-cell qp-quantile">Q{quantile}</div>
                <div className="qp-cell qp-return">
                  {underlyingReturn >= 0 ? '+' : ''}{underlyingReturn.toFixed(1)}%
                </div>
                <div 
                  className="qp-cell qp-payoff"
                  style={{ background: colorFor(payoff) }}
                >
                  {payoff >= 0 ? '+' : ''}{payoff.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          <div className="quantile-legend">
            <span className="legend-item bearish">Q10-Q40: {t('heatmap.bearish', 'Bearish')}</span>
            <span className="legend-item neutral">Q50: {t('heatmap.median', 'Median')}</span>
            <span className="legend-item bullish">Q60-Q90: {t('heatmap.bullish', 'Bullish')}</span>
          </div>
        </div>
      </div>
    )
  }

  const deltas = (grid.deltas?.length ? grid.deltas : [-20, -10, 0, 10, 20]) as number[]
  const horizons = (grid.horizons?.length ? grid.horizons : [0.25, 0.5, 0.75, 1].map(f => Math.max(1, Math.round(Math.max(1, Math.round(props.maturityDays)) * f)))) as number[]

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

          {grid.rows.map((row: { delta: number; days: number; mean: number }[], i: number) => (
            <div key={`r-${horizons[i] ?? i}`} className="heat-row-group">
              <div className="heat-row-header">{(horizons[i] ?? 0)} {t('heatmap.days')}</div>
              {row.map((cell: { delta: number; days: number; mean: number }) => (
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
