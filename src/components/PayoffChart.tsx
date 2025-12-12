import { useTranslation } from 'react-i18next'
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, ComposedChart, Bar } from 'recharts'

interface PayoffChartProps {
  data: Array<{ price: number; payoff: number; zero: number }>
  type: 'call' | 'put'
  breakeven: number
  productType: 'warrant' | 'knockout' | 'factor'
  knockoutBarrier?: number
  histogram?: Array<{ bucket: number; count: number }>
  currentPrice?: number
  strikePrice?: number
}

export default function PayoffChart({ data, type, breakeven, productType, knockoutBarrier, histogram, currentPrice, strikePrice }: PayoffChartProps) {
  const { t } = useTranslation()

  if (productType === 'factor' && histogram && histogram.length > 0) {
    const maxCount = Math.max(...histogram.map(h => h.count))
    return (
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={histogram} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
          <XAxis
            dataKey="bucket"
            label={{ value: t('payoffChart.certPerformance'), position: 'bottom', fill: '#666' }}
            tick={{ fill: '#888' }}
            axisLine={{ stroke: '#2a2a32' }}
          />
          <YAxis
            domain={[0, Math.ceil(maxCount + maxCount * 0.1)]}
            label={{ value: t('payoffChart.frequency'), angle: -90, position: 'insideLeft', fill: '#666' }}
            tick={{ fill: '#888' }}
            axisLine={{ stroke: '#2a2a32' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181f',
              border: '1px solid #2a2a32',
              borderRadius: '6px'
            }}
            labelStyle={{ color: '#f1f1f1' }}
            formatter={(value: number, name: string) => [`${value}`, name === 'count' ? t('payoffChart.frequency') : '']}
            labelFormatter={label => `${label}%`}
          />
          <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
          <Bar dataKey="count" fill="#ffab00" />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  const minPayoff = Math.min(...data.map(d => d.payoff))
  const maxPayoff = Math.max(...data.map(d => d.payoff))
  const ySpan = Math.max(1, maxPayoff - minPayoff)
  const yPad = Math.max(5, ySpan * 0.05)
  const yDomain = [Math.floor(minPayoff - yPad), Math.ceil(maxPayoff + yPad)]

  const xLabel = productType === 'factor' 
    ? t('payoffChart.dailyChange')
    : t('payoffChart.priceAtMaturity')
  
  const yLabel = t('payoffChart.return')

  const pricesRaw = data.map(d => d.price)
  if (productType !== 'factor') {
    if (Number.isFinite(currentPrice)) pricesRaw.push(currentPrice as number)
    if (Number.isFinite(strikePrice)) pricesRaw.push(strikePrice as number)
    if (Number.isFinite(breakeven)) pricesRaw.push(breakeven)
    if (Number.isFinite(knockoutBarrier)) pricesRaw.push(knockoutBarrier as number)
  }
  const prices = pricesRaw.filter(v => Number.isFinite(v))
  const baseMin = prices.length ? Math.min(...prices) : 0
  const baseMax = prices.length ? Math.max(...prices) : 1
  const span = Math.max(1, baseMax - baseMin)
  const pad = span * 0.1
  const xMin = baseMin - pad
  const xMax = baseMax + pad

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
        <XAxis 
          type="number"
          dataKey="price" 
          domain={[Math.floor(xMin), Math.ceil(xMax)]}
          allowDataOverflow
          tickCount={6}
          allowDecimals={false}
          tickFormatter={(v: number) => Math.round(v).toString()}
          label={{ value: xLabel, position: 'bottom', fill: '#666' }}
          tick={{ fill: '#888' }}
          axisLine={{ stroke: '#2a2a32' }}
        />
        <YAxis 
          domain={yDomain}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#666' }}
          tick={{ fill: '#888' }}
          axisLine={{ stroke: '#2a2a32' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#18181f', 
            border: '1px solid #2a2a32',
            borderRadius: '6px'
          }}
          labelStyle={{ color: '#f1f1f1' }}
          formatter={(value: number) => [`${value.toFixed(1)}%`, t('payoffChart.return').replace(' (%)', '')]}
          labelFormatter={(label) => productType === 'factor' 
            ? `${t('payoffChart.underlying')}: ${label > 0 ? '+' : ''}${label}%` 
            : `${t('payoffChart.price')}: ${label} EUR`
          }
        />
        <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
        
        {productType === 'warrant' && (
          <ReferenceLine 
            x={breakeven} 
            stroke="#ffab00" 
            strokeDasharray="5 5" 
            label={{ value: t('payoffChart.breakeven'), fill: '#ffab00', position: 'insideTop', dy: 10 }}
          />
        )}
        
        {productType === 'knockout' && knockoutBarrier && (
          <ReferenceLine 
            x={knockoutBarrier} 
            stroke="#ff1744" 
            strokeWidth={2}
            label={{ value: t('payoffChart.knockout'), fill: '#ff1744', position: 'insideTop', dy: 26, fontWeight: 'bold' as any }}
          />
        )}
        
        {productType !== 'factor' && (
          <ReferenceLine 
            x={strikePrice} 
            stroke="#00b0ff" 
            strokeDasharray="4 4" 
            label={{ value: t('payoffChart.strike'), fill: '#00b0ff', position: 'insideTop', dy: 42 }}
          />
        )}
        {productType !== 'factor' && (
          <ReferenceLine 
            x={currentPrice} 
            stroke="#8bc34a" 
            strokeDasharray="4 4" 
            label={{ value: t('payoffChart.spot'), fill: '#8bc34a', position: 'insideTop', dy: 58 }}
          />
        )}
        
        {productType === 'factor' && (
          <ReferenceLine 
            x={0} 
            stroke="#666" 
            strokeDasharray="3 3"
          />
        )}
        
        <Line 
          type="monotone" 
          dataKey="payoff" 
          stroke={type === 'call' ? '#00e676' : '#ff5252'}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6, fill: type === 'call' ? '#00e676' : '#ff5252' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
