import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PayoffChart from './PayoffChart'

describe('PayoffChart', () => {
  const defaultData = [
    { price: 80, payoff: -100, zero: 0 },
    { price: 100, payoff: -50, zero: 0 },
    { price: 120, payoff: 100, zero: 0 },
  ]

  it('renders without crashing', () => {
    const { container } = render(
      <PayoffChart
        data={defaultData}
        type="call"
        breakeven={105}
        productType="warrant"
      />
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders for put type', () => {
    const { container } = render(
      <PayoffChart
        data={defaultData}
        type="put"
        breakeven={95}
        productType="warrant"
      />
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders with strike price', () => {
    const { container } = render(
      <PayoffChart
        data={defaultData}
        type="call"
        breakeven={105}
        productType="warrant"
        strikePrice={100}
      />
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })
})
