import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'
import { fetchPathDependency } from '../api'
import type { PathDependencyResult } from '../api'

interface PathDependencyChartProps {
  factor: number
  direction: 'call' | 'put'
  adjustmentThreshold: number
  impliedVolPct: number
  riskFreePct: number
  timeHorizonDays: number
  quantileReturns?: Record<number, number>
  forecastPeriod?: number
}

export default function PathDependencyChart({ 
  factor, 
  direction, 
  adjustmentThreshold, 
  impliedVolPct, 
  riskFreePct, 
  timeHorizonDays,
  quantileReturns,
}: PathDependencyChartProps) {
  const { t } = useTranslation()
  const [manualScenario, setManualScenario] = useState<string>('volatile_sideways')
  const [selectedQuantile, setSelectedQuantile] = useState<number>(50)
  const [result, setResult] = useState<PathDependencyResult | null>(null)
  const [loading, setLoading] = useState(true)

  const hasQuantiles = quantileReturns && Object.keys(quantileReturns).length > 0
  const availableQuantiles = hasQuantiles 
    ? [10, 30, 50, 70, 90].filter(q => quantileReturns![q] !== undefined)
    : []

  const manualScenarioLabels: Record<string, string> = {
    volatile_falling: t('pathDependency.manualVolatileDown'),
    volatile_sideways: t('pathDependency.manualSideways'),
    volatile_rising: t('pathDependency.manualVolatileUp')
  }

  const getQuantileLabel = (q: number) => {
    if (!quantileReturns) return ''
    const ret = quantileReturns[q]
    return t('pathDependency.aiScenarioLabel', {
      name: t(`pathDependency.aiQ${q}`),
      ret: `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%`
    })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    
    fetchPathDependency({
      factor,
      direction,
      adjustmentThreshold,
      impliedVolPct,
      riskFreePct,
      timeHorizonDays,
      quantileReturns,
      selectedQuantile,
      manualScenario,
    }).then((res) => {
      if (!cancelled) {
        setResult(res)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [factor, direction, adjustmentThreshold, impliedVolPct, riskFreePct, timeHorizonDays, quantileReturns, selectedQuantile, manualScenario])

  const data = result?.data || []
  const baseReturn = result?.baseReturn || 0
  const certReturn = result?.certReturn || 0
  const optReturn = result?.optReturn || 0
  const expectedReturn = result?.expectedReturn || 0
  const volatilityDrag = result?.volatilityDrag || 0

  return (
    <div className="path-dependency">
      <div className="path-controls">
        {hasQuantiles ? (
          <div className="scenario-select">
            <label>{t('pathDependency.quantileScenario')}</label>
            <div className="quantile-scenario-buttons">
              {availableQuantiles.map(q => (
                <button
                  key={q}
                  className={`scenario-btn quantile-btn ${selectedQuantile === q ? 'active' : ''} ${q < 50 ? 'bearish' : q > 50 ? 'bullish' : 'neutral'}`}
                  onClick={() => setSelectedQuantile(q)}
                >
                  {getQuantileLabel(q)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="scenario-select">
            <label>{t('pathDependency.scenario')}</label>
            <div className="scenario-buttons">
              {Object.keys(manualScenarioLabels).map(s => (
                <button
                  key={s}
                  className={`scenario-btn ${manualScenario === s ? 'active' : ''}`}
                  onClick={() => setManualScenario(s)}
                >
                  {manualScenarioLabels[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="path-chart">
        {loading ? (
          <div className="chart-loader">
            <div className="loader-spinner"></div>
            <span>{t('loading', 'Loading...')}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 65 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
              <XAxis 
                dataKey="day" 
                label={{ value: t('pathDependency.tradingDays'), position: 'bottom', fill: '#aaa' }}
                tick={{ fill: '#888' }}
              />
              <YAxis 
                domain={['auto', 'auto']}
                label={{ value: t('pathDependency.value'), angle: -90, position: 'insideLeft', fill: '#aaa' }}
                tick={{ fill: '#888' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181f', border: '1px solid #2a2a32', borderRadius: '6px' }}
                labelStyle={{ color: '#f1f1f1' }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)}%`,
                  name === 'base' ? t('pathDependency.underlying') : (name === 'opt' ? t('pathDependency.option') : t('pathDependency.certificate'))
                ]}
                labelFormatter={(label) => `${t('tooltip.day')} ${label}`}
              />
              <Legend
                formatter={(value) => {
                  if (value === 'base') return t('pathDependency.underlying')
                  if (value === 'opt') return `${t('pathDependency.option')} (ATM, 1Y)`
                  return `${t('inputs.factor')} ${factor}x ${direction === 'call' ? t('product.long') : t('product.short')}`
                }}
                wrapperStyle={{ transform: 'translateY(22px)' }}
              />
              <ReferenceLine y={100} stroke="#666" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="base" stroke="#ffab00" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="opt" stroke="#64b5f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cert" stroke={direction === 'call' ? '#00e676' : '#ff5252'} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="path-results">
        <div className="result-card">
          <span className="result-label">{t('pathDependency.underlying')}</span>
          <span className={`result-value ${baseReturn >= 0 ? 'profit' : 'loss'}`}>
            {baseReturn >= 0 ? '+' : ''}{baseReturn.toFixed(2)}%
          </span>
        </div>
        <div className="result-card">
          <span className="result-label">{t('pathDependency.certificate')}</span>
          <span className={`result-value ${certReturn >= 0 ? 'profit' : 'loss'}`}>
            {certReturn >= 0 ? '+' : ''}{certReturn.toFixed(2)}%
          </span>
        </div>
        <div className="result-card">
          <span className="result-label">{t('pathDependency.option')}</span>
          <span className={`result-value ${optReturn >= 0 ? 'profit' : 'loss'}`}>
            {optReturn >= 0 ? '+' : ''}{optReturn.toFixed(2)}%
          </span>
        </div>
        <div className="result-card">
          <span className="result-label">{t('pathDependency.expectedReturn')}</span>
          <span className="result-value expected">
            {expectedReturn >= 0 ? '+' : ''}{expectedReturn.toFixed(2)}%
          </span>
        </div>
        <div className="result-card highlight">
          <span className="result-label">{t('pathDependency.volatilityDrag')}</span>
          <span className={`result-value ${volatilityDrag >= 0 ? 'profit' : 'loss'}`}>
            {volatilityDrag >= 0 ? '+' : ''}{volatilityDrag.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="path-explanation">
        <p>
          <strong>{t('pathDependency.explanation')}:</strong> {t('pathDependency.explText1')}{' '}
          {t('pathDependency.explText2')} {baseReturn >= 0 ? t('pathDependency.rise') : t('pathDependency.fall')} {t('pathDependency.explText3')} {Math.abs(baseReturn).toFixed(1)}% {t('pathDependency.explText4')} {Math.abs(expectedReturn).toFixed(1)}% {t('pathDependency.explText5')}
          {Math.abs(volatilityDrag) > 1 && (
            <span className="drag-warning">
              {' '}{t('pathDependency.dragWarning')} {volatilityDrag.toFixed(1)}% {t('pathDependency.dragWarning2')}
              {volatilityDrag < -5 && ` ${t('pathDependency.dragWarning3')}`}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
