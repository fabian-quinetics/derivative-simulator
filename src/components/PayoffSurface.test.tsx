import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PayoffSurface from './PayoffSurface'

vi.mock('../api', () => ({
  fetchPayoffSurface: vi.fn().mockResolvedValue({
    rows: [[{ delta: 0, days: 30, mean: 10.0 }]],
    min: -50,
    max: 100,
    deltas: [-20, 0, 20],
    horizons: [30],
  }),
  fetchQuantilePayoff: vi.fn().mockResolvedValue({
    data: [{ quantile: 50, underlyingReturn: 5, payoff: 0 }],
    forecastPeriod: 100,
  }),
}))

describe('PayoffSurface', () => {
  const defaultProps = {
    productType: 'warrant' as const,
    direction: 'call' as const,
    currentPrice: 100,
    strikePrice: 100,
    premium: 5,
    ratio: 0.1,
    knockoutBarrier: 80,
    factor: 2,
    adjustmentThreshold: 0,
    impliedVol: 20,
    driftPct: 5,
    riskFreePct: 1,
    maturityDays: 90,
  }

  it('renders loading state initially', () => {
    render(<PayoffSurface {...defaultProps} />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('renders heatmap after loading', async () => {
    render(<PayoffSurface {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('heatmap.title')).toBeInTheDocument()
    })
  })
})
