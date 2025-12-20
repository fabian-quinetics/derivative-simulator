import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InfoIcon from './InfoIcon'

describe('InfoIcon', () => {
  it('renders an svg icon', () => {
    render(<InfoIcon />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders with custom size', () => {
    render(<InfoIcon size={24} />)
    const svg = document.querySelector('svg')
    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('height', '24')
  })
})
