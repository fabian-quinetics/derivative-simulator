import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

interface PathDependencyChartProps {
  factor: number
  direction: 'call' | 'put'
  adjustmentThreshold: number
  impliedVolPct: number
  riskFreePct: number
  timeHorizonDays: number
}

export default function PathDependencyChart({ factor, direction, adjustmentThreshold, impliedVolPct, riskFreePct, timeHorizonDays }: PathDependencyChartProps) {
  const { t } = useTranslation()
  const [scenario, setScenario] = useState<string>('volatile_sideways')

  const scenarioLabels: Record<string, string> = {
    volatile_falling: t('pathDependency.volatileFalling'),
    volatile_sideways: t('pathDependency.volatileSideways'),
    volatile_rising: t('pathDependency.volatileRising')
  }

  const basePath = useMemo(() => {
    const hash = (s: string) => {
      let h = 2166136261
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
      }
      return h >>> 0
    }

    const mulberry32 = (seed: number) => {
      let a = seed >>> 0
      return () => {
        a = (a + 0x6D2B79F5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    const days = Math.min(250, Math.max(20, Math.round(timeHorizonDays || 60)))
    const annVolPct = Math.max(0, impliedVolPct || 0)
    const rng = mulberry32(hash(`${scenario}|${annVolPct}|${days}`))

    const normal = () => {
      const u1 = Math.max(1e-12, rng())
      const u2 = Math.max(1e-12, rng())
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    }

    const shocks: number[] = []
    for (let day = 0; day < days; day++) shocks.push(normal() * (annVolPct / 100) / Math.sqrt(252))

    let targetTotalReturn = 0
    if (scenario === 'volatile_rising') targetTotalReturn = 0.15
    else if (scenario === 'volatile_falling') targetTotalReturn = -0.15
    else targetTotalReturn = (rng() - 0.5) * 0.10

    const targetLog = Math.log(1 + targetTotalReturn)
    const sumShocks = shocks.reduce((a, b) => a + b, 0)
    const driftPerDay = (targetLog - sumShocks) / days

    const dailyChanges: number[] = []
    for (let day = 0; day < days; day++) {
      const lr = driftPerDay + shocks[day]
      const rDec = Math.exp(lr) - 1
      dailyChanges.push(rDec * 100)
    }

    const prices: number[] = [100]
    let baseValue = 100
    for (let i = 0; i < dailyChanges.length; i++) {
      baseValue = baseValue * (1 + dailyChanges[i] / 100)
      prices.push(baseValue)
    }
    return { prices, dailyChanges, days }
  }, [scenario, impliedVolPct, timeHorizonDays])

  const data = useMemo(() => {
    const sigma = Math.max(0, impliedVolPct) / 100
    const r = (riskFreePct || 0) / 100
    const strike = 100
    const optionMaturityDays = 365
    const maturityYears = optionMaturityDays / 365
    const isCallOpt = direction === 'call'
    const dirMultiplier = direction === 'call' ? 1 : -1

    const erf = (x: number) => {
      const sign = x >= 0 ? 1 : -1
      const ax = Math.abs(x)
      const t = 1 / (1 + 0.3275911 * ax)
      const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
      return sign * y
    }

    const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2))

    const bsPrice = (S: number, K: number, T: number, isCall: boolean) => {
      if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
        const intrinsic = isCall ? Math.max(0, S - K) : Math.max(0, K - S)
        return intrinsic
      }
      const sqrtT = Math.sqrt(T)
      const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
      const d2 = d1 - sigma * sqrtT
      if (isCall) return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2)
      return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1)
    }

    const s0 = basePath.prices[0] ?? 100
    const opt0 = Math.max(0.0001, bsPrice(s0, strike, maturityYears, isCallOpt))

    const rows = []
    let certValue = 100
    const days = basePath.days
    for (let day = 0; day <= days; day++) {
      const baseValue = basePath.prices[day] ?? basePath.prices[basePath.prices.length - 1] ?? 100
      const tRem = Math.max(0, (optionMaturityDays - day) / 365)
      const opt = bsPrice(baseValue, strike, tRem, isCallOpt)

      rows.push({
        day,
        base: baseValue,
        cert: certValue,
        opt: (opt / opt0) * 100,
        difference: certValue - baseValue
      })

      if (day < days) {
        const dailyChange = basePath.dailyChanges[day] ?? 0
        const applyAdj = (dailyChangePct: number) => {
          if (!adjustmentThreshold || adjustmentThreshold <= 0) return Math.max(0.001, 1 + (dailyChangePct / 100) * factor * dirMultiplier)
          const thr = Math.abs(adjustmentThreshold)
          let rem = dailyChangePct
          let m = 1
          for (let i = 0; i < 10; i++) {
            const isHit = dirMultiplier > 0 ? rem <= -thr : rem >= thr
            if (!isHit) return m * Math.max(0.001, 1 + (rem / 100) * factor * dirMultiplier)
            const r1 = dirMultiplier > 0 ? -thr : thr
            m *= Math.max(0.001, 1 + (r1 / 100) * factor * dirMultiplier)
            const denom = 1 + r1 / 100
            if (denom === 0) return m
            rem = ((1 + rem / 100) / denom - 1) * 100
          }
          return m * Math.max(0.001, 1 + (rem / 100) * factor * dirMultiplier)
        }
        certValue = certValue * applyAdj(dailyChange)
        if (certValue < 0.01) certValue = 0.01
      }
    }

    return rows
  }, [basePath, factor, direction, adjustmentThreshold, impliedVolPct, riskFreePct])

  const finalBase = data[data.length - 1]?.base || 100
  const finalCert = data[data.length - 1]?.cert || 100
  const finalOpt = data[data.length - 1]?.opt || 100
  const baseReturn = ((finalBase - 100) / 100) * 100
  const certReturn = ((finalCert - 100) / 100) * 100
  const optReturn = finalOpt - 100
  const expectedReturn = baseReturn * factor * (direction === 'call' ? 1 : -1)
  const volatilityDrag = certReturn - expectedReturn

  return (
    <div className="path-dependency">
      <div className="path-controls">
        <div className="scenario-select">
          <label>{t('pathDependency.scenario')}</label>
          <div className="scenario-buttons">
            {Object.keys(scenarioLabels).map(s => (
              <button
                key={s}
                className={`scenario-btn ${scenario === s ? 'active' : ''}`}
                onClick={() => setScenario(s)}
              >
                {scenarioLabels[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="path-chart">
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
              formatter={(value) => value === 'base' ? t('pathDependency.underlying') : (value === 'opt' ? t('pathDependency.option') : `${t('inputs.factor')} ${factor}x ${direction === 'call' ? t('product.long') : t('product.short')}`)}
              wrapperStyle={{ transform: 'translateY(22px)' }}
            />
            <ReferenceLine y={100} stroke="#666" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="base" stroke="#ffab00" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="opt" stroke="#64b5f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cert" stroke={direction === 'call' ? '#00e676' : '#ff5252'} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
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
