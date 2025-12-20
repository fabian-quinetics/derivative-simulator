import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WarrantCalculator from './WarrantCalculator'

describe('WarrantCalculator', () => {
  it('renders product type selector', () => {
    render(<WarrantCalculator />)
    expect(screen.getByText('product.warrant')).toBeInTheDocument()
    expect(screen.getByText('product.knockout')).toBeInTheDocument()
    expect(screen.getByText('product.factor')).toBeInTheDocument()
  })

  it('renders direction selector', () => {
    render(<WarrantCalculator />)
    expect(screen.getByText('product.call')).toBeInTheDocument()
    expect(screen.getByText('product.put')).toBeInTheDocument()
  })

  it('renders data mode toggle', () => {
    render(<WarrantCalculator />)
    expect(screen.getByText('inputs.simulation')).toBeInTheDocument()
    expect(screen.getByText('inputs.realAssets')).toBeInTheDocument()
  })

  it('switches product type when clicked', () => {
    render(<WarrantCalculator />)
    const knockoutBtn = screen.getByText('product.knockout')
    fireEvent.click(knockoutBtn)
    expect(knockoutBtn.closest('button')).toHaveClass('active')
  })
})
