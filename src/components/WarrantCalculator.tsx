import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import PayoffChart from './PayoffChart'
import PathDependencyChart from './PathDependencyChart'
import MonteCarloSimulator from './MonteCarloSimulator'
import PayoffSurface from './PayoffSurface'
import InfoModal from './InfoModal'
import InfoIcon from './InfoIcon'
import { fetchSummary, fetchAssets, fetchAssetPredictions } from '../api'
import type { Asset, AssetPredictions } from '../api'

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

const FORECAST_PERIODS = [30, 60, 100]

export default function WarrantCalculator() {
  const { t } = useTranslation()
  const [params, setParams] = useState<WarrantParams>({
    productType: 'warrant',
    direction: 'call',
    currentPrice: 100,
    strikePrice: 100,
    ratio: 1,
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

  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null)
  const [forecastPeriod, setForecastPeriod] = useState<number>(100)
  const [assetPredictions, setAssetPredictions] = useState<AssetPredictions | null>(null)
  const [assetSearch, setAssetSearch] = useState('')
  const [assetsLoading, setAssetsLoading] = useState(false)

  const [summary, setSummary] = useState<any>(null)
  const [modalInfo, setModalInfo] = useState<{ title: string; content: string } | null>(null)

  useEffect(() => {
    setAssetsLoading(true)
    fetchAssets(2).then(res => {
      setAssets(res.assets)
      setAssetsLoading(false)
    }).catch(() => setAssetsLoading(false))
  }, [])

  useEffect(() => {
    if (selectedAssetId) {
      fetchAssetPredictions(selectedAssetId, forecastPeriod).then(predictions => {
        setAssetPredictions(predictions)
        if (predictions.currentPrice) {
          setParams(prev => ({ ...prev, currentPrice: predictions.currentPrice!, maturityDays: forecastPeriod }))
          setMaturityDraft(forecastPeriod)
        }
      }).catch(() => setAssetPredictions(null))
    } else {
      setAssetPredictions(null)
    }
  }, [selectedAssetId, forecastPeriod])

  const handleForecastPeriodChange = (fp: number) => {
    setForecastPeriod(fp)
    if (selectedAssetId) {
      setParams(prev => ({ ...prev, maturityDays: fp }))
      setMaturityDraft(fp)
    }
  }

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(assetSearch.toLowerCase())
  ).slice(0, 50)

  const updateParam = <K extends keyof WarrantParams>(key: K, value: WarrantParams[K]) => {
    setParams(prev => {
      const newParams = { ...prev, [key]: value }
      if (key === 'productType' && value === 'knockout') {
        if (prev.direction === 'call' && newParams.strikePrice >= newParams.currentPrice) {
          newParams.strikePrice = Math.round(newParams.currentPrice * 0.9)
        } else if (prev.direction === 'put' && newParams.strikePrice <= newParams.currentPrice) {
          newParams.strikePrice = Math.round(newParams.currentPrice * 1.1)
        }
      }
      if (key === 'productType' && value === 'factor') {
        newParams.maturityDays = 60
        setMaturityDraft(60)
        newParams.impliedVol = 30
        setImpliedVolDraft(30)
      }
      return newParams
    })
  }

  const [summaryLoading, setSummaryLoading] = useState(true)

  useEffect(() => {
    if (summaryTimer.current) clearTimeout(summaryTimer.current)
    setSummaryLoading(true)
    summaryTimer.current = setTimeout(() => {
      fetchSummary(params).then((s) => {
        setSummary(s)
        setSummaryLoading(false)
      })
    }, 150)
    return () => {
      if (summaryTimer.current) clearTimeout(summaryTimer.current)
    }
  }, [params])

  const bsPrice = (summary?.bsPrice ?? 0) as number
  const bsGreeks = (summary?.bsGreeks ?? { delta: 0, gamma: 0, vega: 0, theta: 0 }) as BsGreeks
  const premiumValue = (summary?.premiumValue ?? 0) as number
  const metrics = summary?.metrics ?? { intrinsicValue: 0, timeValue: 0, breakeven: 0, leverage: 0, moneyness: '', knockoutDistance: 0, dailyChange: 0, koPrice: 0 }
  const chartData = summary?.chartData ?? []
  const factorHistogram = summary?.factorHistogram ?? []

  const productLabels: Record<ProductType, string> = {
    warrant: t('product.warrant'),
    knockout: t('product.knockout'),
    factor: t('product.factor')
  }

  const getMoneyness = (m: string) => {
    if (m === 'itm') return t('metrics.itm')
    if (m === 'atm') return t('metrics.atm')
    if (m === 'otm') return t('metrics.otm')
    if (m === 'knockedOut') return t('metrics.knockedOut')
    if (m === 'notKnockedOut') return t('metrics.notKnockedOut')
    if (m === 'long') return t('product.long')
    if (m === 'short') return t('product.short')
    return m
  }

  const showInfo = (titleKey: string, infoKey: string) => {
    setModalInfo({ title: t(titleKey), content: t(infoKey) })
  }

  return (
    <div className="calculator">
      {modalInfo && (
        <InfoModal
          title={modalInfo.title}
          content={modalInfo.content}
          onClose={() => setModalInfo(null)}
        />
      )}

      <div className="input-section">
        <h2>{t('product.title')}</h2>

        <div className="input-group asset-selection">
          <label className="label-with-info">
            {t('inputs.asset', 'Asset')}
            <button className="label-info-btn" onClick={() => showInfo(t('inputs.asset', 'Asset'), t('info.asset', 'Select an asset to auto-fill price and see ML predictions'))}><InfoIcon size={12} /></button>
          </label>
          <input
            type="text"
            placeholder={t('inputs.searchAsset', 'Search assets...')}
            value={assetSearch}
            onChange={e => setAssetSearch(e.target.value)}
            className="asset-search"
          />
          <select
            value={selectedAssetId || ''}
            onChange={e => setSelectedAssetId(e.target.value ? parseInt(e.target.value) : null)}
            className="asset-dropdown"
          >
            <option value="">{assetsLoading ? t('loading', 'Loading...') : t('inputs.selectAsset', 'Select asset...')}</option>
            {filteredAssets.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
        </div>

        <div className="input-group forecast-period-selection">
          <label className="label-with-info">
            {t('inputs.forecastPeriod', 'Forecast Period')}
            <button className="label-info-btn" onClick={() => showInfo(t('inputs.forecastPeriod', 'Forecast Period'), t('info.forecastPeriod', 'The time horizon for ML predictions'))}><InfoIcon size={12} /></button>
          </label>
          <div className="forecast-period-toggle">
            {FORECAST_PERIODS.map(fp => (
              <button
                key={fp}
                className={`toggle-btn ${forecastPeriod === fp ? 'active' : ''}`}
                onClick={() => handleForecastPeriodChange(fp)}
              >
                {fp}d
              </button>
            ))}
          </div>
        </div>

        {assetPredictions && (
          <div className="predictions-display">
            <div className="prediction-item">
              <span className="prediction-label">{t('predictions.predictedVol', 'Predicted Volatility')}</span>
              <span className="prediction-value">
                {assetPredictions.predictedVolatility !== null 
                  ? `${assetPredictions.predictedVolatility.toFixed(1)}%` 
                  : '-'}
              </span>
            </div>
            {Object.keys(assetPredictions.quantileReturns).length > 0 && (
              <div className="quantile-predictions">
                <span className="prediction-label">{t('predictions.quantileReturns', 'Return Scenarios')}</span>
                <div className="quantile-grid">
                  {[10, 30, 50, 70, 90].map(q => (
                    <div key={q} className={`quantile-item ${q < 50 ? 'bearish' : q > 50 ? 'bullish' : 'neutral'}`}>
                      <span className="q-label">Q{q}</span>
                      <span className="q-value">
                        {assetPredictions.quantileReturns[q] !== undefined 
                          ? `${assetPredictions.quantileReturns[q] >= 0 ? '+' : ''}${assetPredictions.quantileReturns[q].toFixed(1)}%`
                          : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="product-select">
          {(['warrant', 'knockout', 'factor'] as ProductType[]).map(type => (
            <div key={type} className="product-btn-wrapper">
              <button
                className={`product-btn ${params.productType === type ? 'active' : ''}`}
                onClick={() => updateParam('productType', type)}
              >
                {productLabels[type]}
              </button>
              <button
                className="info-btn"
                onClick={(e) => { e.stopPropagation(); showInfo(productLabels[type], t(`info.${type}`)) }}
                title={t(`info.${type}`)}
              >
                <InfoIcon size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="type-toggle">
          <button 
            className={`toggle-btn ${params.direction === 'call' ? 'active call' : ''}`}
            onClick={() => updateParam('direction', 'call')}
          >
            {params.productType === 'factor' ? t('product.long') : t('product.call')}
          </button>
          <button 
            className={`toggle-btn ${params.direction === 'put' ? 'active put' : ''}`}
            onClick={() => updateParam('direction', 'put')}
          >
            {params.productType === 'factor' ? t('product.short') : t('product.put')}
          </button>
        </div>

        {params.productType !== 'factor' && (
          <div className="input-group">
            <label className="label-with-info">
              {t('inputs.currentPrice')}
              <button className="label-info-btn" onClick={() => showInfo(t('inputs.currentPrice'), t('info.currentPrice'))}><InfoIcon size={12} /></button>
            </label>
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
        )}

        {params.productType !== 'factor' && (
          <div className="input-group">
            <label className="label-with-info">
              {params.productType === 'knockout' ? t('inputs.strikeKnockout') : t('inputs.strikePrice')}
              <button className="label-info-btn" onClick={() => showInfo(t('inputs.strikePrice'), t('info.strikePrice'))}><InfoIcon size={12} /></button>
            </label>
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

        {params.productType !== 'factor' && (
          <>
            <div className="input-group">
              <label className="label-with-info">
                {t('inputs.impliedVol')}
                <button className="label-info-btn" onClick={() => showInfo(t('inputs.impliedVol'), t('info.impliedVol'))}><InfoIcon size={12} /></button>
              </label>
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
              <label className="label-with-info">
                {t('inputs.maturity')}
                <button className="label-info-btn" onClick={() => showInfo(t('inputs.maturity'), t('info.maturity'))}><InfoIcon size={12} /></button>
              </label>
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
              <label className="label-with-info">
                {t('inputs.drift')}
                <button className="label-info-btn" onClick={() => showInfo(t('inputs.drift'), t('info.drift'))}><InfoIcon size={12} /></button>
              </label>
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
              <label className="label-with-info">
                {t('inputs.riskFree')}
                <button className="label-info-btn" onClick={() => showInfo(t('inputs.riskFree'), t('info.riskFree'))}><InfoIcon size={12} /></button>
              </label>
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
          </>
        )}

        {params.productType === 'warrant' && (
          <div className="input-group">
            <label className="label-with-info">
              {t('inputs.ratio')}
              <button className="label-info-btn" onClick={() => showInfo(t('inputs.ratio'), t('info.ratio'))}><InfoIcon size={12} /></button>
            </label>
            <input
              type="number"
              value={params.ratio}
              onChange={e => updateParam('ratio', parseFloat(e.target.value) || 1)}
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
        )}

        {params.productType === 'knockout' && (
          <>
            <div className="input-group">
              <label className="label-with-info">
                {t('inputs.knockoutBarrier')}
                <button className="label-info-btn" onClick={() => showInfo(t('inputs.knockoutBarrier'), t('info.knockoutBarrier'))}><InfoIcon size={12} /></button>
              </label>
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
              <label className="label-with-info">
                {t('inputs.ratioSimple')}
                <button className="label-info-btn" onClick={() => showInfo(t('inputs.ratioSimple'), t('info.ratio'))}><InfoIcon size={12} /></button>
              </label>
              <input
                type="number"
                value={params.ratio}
                onChange={e => updateParam('ratio', parseFloat(e.target.value) || 1)}
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
            <label className="label-with-info">
              {t('inputs.factor')}
              <button className="label-info-btn" onClick={() => showInfo(t('inputs.factor'), t('info.factor'))}><InfoIcon size={12} /></button>
            </label>
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
            <label className="label-with-info">
              {t('inputs.volatilityAnn')}
              <button className="label-info-btn" onClick={() => showInfo(t('inputs.volatilityAnn'), t('info.volatilityAnn'))}><InfoIcon size={12} /></button>
            </label>
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
              max="120"
              step="1"
              value={impliedVolDraft}
              onChange={e => {
                const v = parseFloat(e.target.value)
                setImpliedVolDraft(v)
                if (impliedVolTimer.current) clearTimeout(impliedVolTimer.current)
                impliedVolTimer.current = setTimeout(() => updateParam('impliedVol', v), 250)
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
        )}
        {params.productType === 'factor' && (
          <div className="input-group">
            <label className="label-with-info">
              {t('inputs.timeHorizon')}
              <button className="label-info-btn" onClick={() => showInfo(t('inputs.timeHorizon'), t('info.timeHorizon'))}><InfoIcon size={12} /></button>
            </label>
            <input
              type="number"
              value={params.maturityDays}
              onChange={e => {
                const v = Math.min(250, Math.max(20, parseFloat(e.target.value) || 20))
                setMaturityDraft(v)
                updateParam('maturityDays', v)
              }}
              step="1"
            />
            <input
              type="range"
              min="20"
              max="250"
              step="10"
              value={maturityDraft}
              onChange={e => {
                const v = parseFloat(e.target.value)
                setMaturityDraft(v)
                if (maturityTimer.current) clearTimeout(maturityTimer.current)
                maturityTimer.current = setTimeout(() => updateParam('maturityDays', v), 250)
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
        )}
        {params.productType === 'factor' && (
          <div className="input-group">
            <label className="label-with-info">
              {t('inputs.adjustmentThreshold')}
              <button className="label-info-btn" onClick={() => showInfo(t('inputs.adjustmentThreshold'), t('info.adjustmentThreshold'))}><InfoIcon size={12} /></button>
            </label>
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
          <h2>{t('metrics.title')}</h2>
          <div className="metrics-grid">
            <div className="metric-card clickable" onClick={() => showInfo(t('metrics.status'), t('info.status'))}>
              <span className="info-icon"><InfoIcon size={12} /></span>
              <span className="metric-label">{t('metrics.status')}</span>
              <span className={`metric-value status ${
                metrics.moneyness === 'itm' || metrics.moneyness === 'notKnockedOut' || metrics.moneyness === 'long' ? 'itm' : 
                metrics.moneyness === 'atm' ? 'atm' : 
                metrics.moneyness === 'knockedOut' ? 'knockout' : 'otm'
              }`}>
                {getMoneyness(metrics.moneyness)}
              </span>
            </div>
            {params.productType === 'warrant' && (
              <>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.intrinsicValue'), t('info.intrinsicValue'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.intrinsicValue')}</span>
                  <span className="metric-value">{metrics.intrinsicValue.toFixed(2)} EUR</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.timeValue'), t('info.timeValue'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.timeValue')}</span>
                  <span className="metric-value">{metrics.timeValue.toFixed(2)} EUR</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.breakeven'), t('info.breakeven'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.breakeven')}</span>
                  <span className="metric-value">{metrics.breakeven.toFixed(2)} EUR</span>
                </div>
              </>
            )}
            
            {params.productType === 'knockout' && (
              <>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.fairValue'), t('info.value'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.fairValue')}</span>
                  <span className="metric-value">{(metrics.koPrice ?? metrics.intrinsicValue).toFixed(2)} EUR</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.intrinsicValue'), t('info.intrinsicValue'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.intrinsicValue')}</span>
                  <span className="metric-value">{metrics.intrinsicValue.toFixed(2)} EUR</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.timeValue'), t('info.timeValue'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.timeValue')}</span>
                  <span className="metric-value">{metrics.timeValue.toFixed(2)} EUR</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.koDistance'), t('info.koDistance'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.koDistance')}</span>
                  <span className={`metric-value ${metrics.knockoutDistance < 5 ? 'loss' : ''}`}>
                    {metrics.knockoutDistance.toFixed(1)}%
                  </span>
                </div>
              </>
            )}
            
            {params.productType === 'factor' && (
              <div className="metric-card clickable" onClick={() => showInfo(t('metrics.onePlus'), t('info.onePlus'))}>
                <span className="info-icon"><InfoIcon size={12} /></span>
                <span className="metric-label">{t('metrics.onePlus')}</span>
                <span className="metric-value profit">
                  {params.direction === 'call' ? '+' : '-'}{params.factor}%
                </span>
              </div>
            )}

            <div className="metric-card clickable" onClick={() => showInfo(t('metrics.leverage'), t('info.leverage'))}>
              <span className="info-icon"><InfoIcon size={12} /></span>
              <span className="metric-label">{t('metrics.leverage')}</span>
              <span className="metric-value">{metrics.leverage.toFixed(2)}x</span>
            </div>
            
            {params.productType === 'warrant' && (
              <>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.bsPrice'), t('info.bsPrice'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.bsPrice')}</span>
                  <span className="metric-value">{bsPrice.toFixed(3)} EUR</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.delta'), t('info.delta'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.delta')}</span>
                  <span className="metric-value">{bsGreeks.delta.toFixed(3)}</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.gamma'), t('info.gamma'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.gamma')}</span>
                  <span className="metric-value">{bsGreeks.gamma.toFixed(5)}</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.vega'), t('info.vega'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.vega')}</span>
                  <span className="metric-value">{bsGreeks.vega.toFixed(3)}</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.theta'), t('info.theta'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.theta')}</span>
                  <span className="metric-value">{bsGreeks.theta.toFixed(3)}</span>
                </div>
                <div className="metric-card clickable" onClick={() => showInfo(t('metrics.maxLoss'), t('info.maxLoss'))}>
                  <span className="info-icon"><InfoIcon size={12} /></span>
                  <span className="metric-label">{t('metrics.maxLoss')}</span>
                  <span className="metric-value loss">-{premiumValue.toFixed(2)} EUR</span>
                </div>
              </>
            )}
            
            {params.productType === 'knockout' && (
              <div className="metric-card clickable" onClick={() => showInfo(t('metrics.maxLoss'), t('info.maxLoss'))}>
                <span className="info-icon"><InfoIcon size={12} /></span>
                <span className="metric-label">{t('metrics.maxLoss')}</span>
                <span className="metric-value loss">-100%</span>
              </div>
            )}
          </div>
        </div>

        {params.productType !== 'factor' && (
          <div className="chart-container">
            <h2>{t('charts.payoffAtMaturity')}</h2>
            {summaryLoading ? (
              <div className="chart-loader">
                <div className="loader-spinner"></div>
                <span>{t('loading', 'Loading...')}</span>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {params.productType !== 'factor' && (
          <div className="chart-container mc-block">
            <h2>{params.productType === 'warrant' ? t('charts.returnDistribution') : t('charts.returnDistributionMC')}</h2>
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

        {params.productType !== 'factor' && (
          <div className="chart-container surface-block">
            <h2>{assetPredictions ? t('charts.quantilePayoffs', 'Quantile Payoff Scenarios') : t('charts.returnHeatmap')}</h2>
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
              quantileReturns={assetPredictions?.quantileReturns}
              forecastPeriod={forecastPeriod}
            />
          </div>
        )}

        {params.productType === 'factor' && (
          <div className="chart-container path-container">
            <h2>{t('charts.pathDependency')}</h2>
            <PathDependencyChart
              factor={params.factor}
              direction={params.direction}
              adjustmentThreshold={params.adjustmentThreshold}
              impliedVolPct={params.impliedVol}
              riskFreePct={params.riskFreePct}
              timeHorizonDays={params.maturityDays}
              quantileReturns={assetPredictions?.quantileReturns}
              forecastPeriod={forecastPeriod}
            />
          </div>
        )}

        <div className="explanation">
          <h3>{productLabels[params.productType]} - {params.direction === 'call' ? (params.productType === 'factor' ? t('product.long') : t('product.call')) : (params.productType === 'factor' ? t('product.short') : t('product.put'))}</h3>
          {params.productType === 'warrant' && params.direction === 'call' && (
            <p>{t('explanation.warrantCall', { strike: params.strikePrice.toFixed(2), breakeven: metrics.breakeven.toFixed(2) })}</p>
          )}
          {params.productType === 'warrant' && params.direction === 'put' && (
            <p>{t('explanation.warrantPut', { strike: params.strikePrice.toFixed(2), breakeven: metrics.breakeven.toFixed(2) })}</p>
          )}
          {params.productType === 'knockout' && params.direction === 'call' && (
            <p>
              <strong>{t('explanation.knockoutCall')}</strong>
              <span className="warning"> {t('explanation.knockoutCallWarning', { barrier: params.knockoutBarrier.toFixed(2) })}</span> {t('explanation.knockoutCallDistance')} <strong>{metrics.knockoutDistance.toFixed(1)}%</strong>.
            </p>
          )}
          {params.productType === 'knockout' && params.direction === 'put' && (
            <p>
              <strong>{t('explanation.knockoutPut')}</strong>
              <span className="warning"> {t('explanation.knockoutPutWarning', { barrier: params.knockoutBarrier.toFixed(2) })}</span> {t('explanation.knockoutCallDistance')} <strong>{metrics.knockoutDistance.toFixed(1)}%</strong>.
            </p>
          )}
          {params.productType === 'knockout' && (
            <p className="info-note">{t('explanation.knockoutBarrierType')}</p>
          )}
          {params.productType === 'factor' && (
            <p>
              <strong>{t('explanation.factor', { factor: params.factor, direction: params.direction === 'call' ? t('product.long') : t('product.short') })}</strong>
              {' '}{params.direction === 'call' ? t('explanation.factorCallExample', { factor: params.factor }) : t('explanation.factorPutExample', { factor: params.factor })}
              <span className="warning"> {t('explanation.factorWarning')}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
