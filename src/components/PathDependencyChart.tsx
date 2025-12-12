import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

interface PathDependencyChartProps {
  factor: number
  direction: 'call' | 'put'
  adjustmentThreshold: number
}

type Scenario = 'linear_up' | 'linear_down' | 'volatile_sideways' | 'volatile_up' | 'crash_recovery'

const scenarioLabels: Record<Scenario, string> = {
  linear_up: 'Stetig steigend',
  linear_down: 'Stetig fallend',
  volatile_sideways: 'Volatil seitwärts',
  volatile_up: 'Volatil steigend',
  crash_recovery: 'Crash & Erholung'
}

export default function PathDependencyChart({ factor, direction, adjustmentThreshold }: PathDependencyChartProps) {
  const [scenario, setScenario] = useState<Scenario>('volatile_sideways')
  const [volatility, setVolatility] = useState(3)
  const [days, setDays] = useState(60)

  const data = useMemo(() => {
    const result = []
    let baseValue = 100
    let certValue = 100
    
    const dirMultiplier = direction === 'call' ? 1 : -1

    for (let day = 0; day <= days; day++) {
      result.push({
        day,
        base: Math.round(baseValue * 100) / 100,
        cert: Math.round(certValue * 100) / 100,
        difference: Math.round((certValue - baseValue) * 100) / 100
      })

      if (day < days) {
        let dailyChange = 0
        
        switch (scenario) {
          case 'linear_up':
            dailyChange = 0.3
            break
          case 'linear_down':
            dailyChange = -0.3
            break
          case 'volatile_sideways':
            dailyChange = (Math.random() - 0.5) * volatility * 2
            break
          case 'volatile_up':
            dailyChange = 0.15 + (Math.random() - 0.5) * volatility * 2
            break
          case 'crash_recovery':
            if (day < days * 0.3) {
              dailyChange = -1.5 + (Math.random() - 0.5) * 2
            } else if (day < days * 0.5) {
              dailyChange = (Math.random() - 0.5) * volatility
            } else {
              dailyChange = 1.2 + (Math.random() - 0.5) * 2
            }
            break
        }

        const baseReturn = dailyChange / 100
        const capped = Math.abs(dailyChange) > adjustmentThreshold ? Math.sign(dailyChange) * adjustmentThreshold : dailyChange
        const certReturn = (capped * factor * dirMultiplier) / 100

        baseValue = baseValue * (1 + baseReturn)
        certValue = certValue * (1 + certReturn)
        
        if (certValue < 0.01) certValue = 0.01
      }
    }

    return result
  }, [scenario, factor, direction, volatility, days])

  const finalBase = data[data.length - 1]?.base || 100
  const finalCert = data[data.length - 1]?.cert || 100
  const baseReturn = ((finalBase - 100) / 100) * 100
  const certReturn = ((finalCert - 100) / 100) * 100
  const expectedReturn = baseReturn * factor * (direction === 'call' ? 1 : -1)
  const volatilityDrag = certReturn - expectedReturn

  return (
    <div className="path-dependency">
      <div className="path-controls">
        <div className="scenario-select">
          <label>Szenario</label>
          <div className="scenario-buttons">
            {(Object.keys(scenarioLabels) as Scenario[]).map(s => (
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

        <div className="path-params">
          <div className="param">
            <label>Volatilität: {volatility}%</label>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={volatility}
              onChange={e => setVolatility(parseFloat(e.target.value))}
            />
          </div>
          <div className="param">
            <label>Tage: {days}</label>
            <input
              type="range"
              min="20"
              max="250"
              step="10"
              value={days}
              onChange={e => setDays(parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="path-chart">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
            <XAxis 
              dataKey="day" 
              label={{ value: 'Handelstage', position: 'bottom', fill: '#aaa' }}
              tick={{ fill: '#888' }}
            />
            <YAxis 
              domain={['auto', 'auto']}
              label={{ value: 'Wert (%)', angle: -90, position: 'insideLeft', fill: '#aaa' }}
              tick={{ fill: '#888' }}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181f', border: '1px solid #2a2a32', borderRadius: '6px' }}
              labelStyle={{ color: '#f1f1f1' }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(2)}%`,
                name === 'base' ? 'Basiswert' : 'Zertifikat'
              ]}
              labelFormatter={(label) => `Tag ${label}`}
            />
            <Legend 
              formatter={(value) => value === 'base' ? 'Basiswert' : `Faktor ${factor}x ${direction === 'call' ? 'Long' : 'Short'}`}
            />
            <ReferenceLine y={100} stroke="#666" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="base" stroke="#ffab00" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cert" stroke={direction === 'call' ? '#00e676' : '#ff5252'} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="path-results">
        <div className="result-card">
          <span className="result-label">Basiswert</span>
          <span className={`result-value ${baseReturn >= 0 ? 'profit' : 'loss'}`}>
            {baseReturn >= 0 ? '+' : ''}{baseReturn.toFixed(2)}%
          </span>
        </div>
        <div className="result-card">
          <span className="result-label">Zertifikat</span>
          <span className={`result-value ${certReturn >= 0 ? 'profit' : 'loss'}`}>
            {certReturn >= 0 ? '+' : ''}{certReturn.toFixed(2)}%
          </span>
        </div>
        <div className="result-card">
          <span className="result-label">Erwartete Rendite</span>
          <span className="result-value expected">
            {expectedReturn >= 0 ? '+' : ''}{expectedReturn.toFixed(2)}%
          </span>
        </div>
        <div className="result-card highlight">
          <span className="result-label">Volatility Drag</span>
          <span className={`result-value ${volatilityDrag >= 0 ? 'profit' : 'loss'}`}>
            {volatilityDrag >= 0 ? '+' : ''}{volatilityDrag.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="path-explanation">
        <p>
          <strong>Pfadabhängigkeit:</strong> Das Zertifikat reagiert auf <em>tägliche</em> Veränderungen. 
          Bei {baseReturn >= 0 ? 'einem Anstieg' : 'einem Rückgang'} des Basiswerts um {Math.abs(baseReturn).toFixed(1)}% 
          wäre eine {factor}x-gehebelte Rendite von {Math.abs(expectedReturn).toFixed(1)}% zu erwarten gewesen.
          {Math.abs(volatilityDrag) > 1 && (
            <span className="drag-warning">
              {' '}Der <strong>Volatility Drag</strong> von {volatilityDrag.toFixed(1)}% zeigt die Auswirkung der Pfadabhängigkeit.
              {volatilityDrag < -5 && ' Bei hoher Volatilität kann dies zu erheblichen Verlusten führen!'}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

