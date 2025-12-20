import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PathDependencyChart from './PathDependencyChart'

describe('PathDependencyChart', () => {
  const defaultProps = {
    factor: 2,
    direction: 'call' as const,
    adjustmentThreshold: 0,
    impliedVolPct: 20,
    riskFreePct: 1,
    timeHorizonDays: 60,
  }

  it('renders loading state initially', () => {
    render(<PathDependencyChart {...defaultProps} />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('renders chart container after loading', async () => {
    const { container } = render(<PathDependencyChart {...defaultProps} />)
    await waitFor(() => {
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })
  })

  it('renders scenario buttons', async () => {
    render(<PathDependencyChart {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('pathDependency.manualSideways')).toBeInTheDocument()
    })
  })
})
