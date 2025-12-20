import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MonteCarloSimulator from './MonteCarloSimulator'

vi.mock('../api', () => ({
  fetchMonteCarlo: vi.fn().mockResolvedValue({
    histogram: [{ bucket: '-100%', count: 10 }],
    mean: 15.5,
    p5: -80.0,
    p50: 10.0,
    p95: 150.0,
    probITM: 0.65,
    probProfit: 0.55,
    maxLoss: -100.0,
  }),
}))

describe('MonteCarloSimulator', () => {
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
    volatilityPct: 20,
    driftPct: 5,
    riskFreePct: 1,
    days: 90,
    sims: 1000,
  }

  it('renders loading state initially', () => {
    render(<MonteCarloSimulator {...defaultProps} />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('renders statistics after loading', async () => {
    render(<MonteCarloSimulator {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('monteCarlo.mean')).toBeInTheDocument()
    })
  })
})
