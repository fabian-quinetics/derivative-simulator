import { useEffect, useState, useRef } from 'react'
import PayoffChart from './PayoffChart'
import PathDependencyChart from './PathDependencyChart'
import MonteCarloSimulator from './MonteCarloSimulator'
import PayoffSurface from './PayoffSurface'
import { fetchSummary } from '../api'

type ProductType = 'warrant' | 'knockout' | 'factor'
type Direction = 'call' | 'put'

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
  riskFreePct: number
}

type BsGreeks = { delta: number; gamma: number; vega: number; theta: number }

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
    riskFreePct: 1,
  })
  const [impliedVolDraft, setImpliedVolDraft] = useState(30)
  const [maturityDraft, setMaturityDraft] = useState(365)
  const [driftDraft, setDriftDraft] = useState(6)
  const [riskFreeDraft, setRiskFreeDraft] = useState(1)
  const impliedVolTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maturityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const driftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const riskFreeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [summary, setSummary] = useState<any>(null)

  const updateParam = <K extends keyof WarrantParams>(key: K, value: WarrantParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (summaryTimer.current) clearTimeout(summaryTimer.current)
    summaryTimer.current = setTimeout(() => {
      fetchSummary(params).then(setSummary)
    }, 150)
    return () => {
      if (summaryTimer.current) clearTimeout(summaryTimer.current)
    }
  }, [params])

  const bsPrice = (summary?.bsPrice ?? 0) as number
  const bsGreeks = (summary?.bsGreeks ?? { delta: 0, gamma: 0, vega: 0, theta: 0 }) as BsGreeks
  const premiumValue = (summary?.premiumValue ?? 0) as number
  const metrics = summary?.metrics ?? { intrinsicValue: 0, timeValue: 0, breakeven: 0, leverage: 0, moneyness: '', knockoutDistance: 0, dailyChange: 0 }
  const chartData = summary?.chartData ?? []
  const factorHistogram = summary?.factorHistogram ?? []

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
              : 'Renditeprofil bei Fälligkeit'}
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
            <h2>{params.productType === 'warrant' ? 'Rendite-Verteilung' : 'Rendite-Verteilung (Monte Carlo)'}</h2>
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
              sims={500}
              driftPct={params.driftPct}
            />
          </div>
        )}

        <div className="chart-container surface-block">
          <h2>Rendite-Heatmap</h2>
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
            riskFreePct={params.riskFreePct}
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
