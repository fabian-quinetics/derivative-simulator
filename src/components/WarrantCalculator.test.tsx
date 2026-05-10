import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { fetchAssets } from '../api'
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

  it('shows paid access notice when real assets are forbidden', async () => {
    vi.mocked(fetchAssets).mockRejectedValueOnce({ status: 403 })

    render(<WarrantCalculator />)
    fireEvent.click(screen.getByText('inputs.realAssets'))

    await waitFor(() => {
      expect(screen.getByText('notes.realAssetsPaidRequired')).toBeInTheDocument()
    })
    expect(screen.getByText('inputs.simulation').closest('button')).toHaveClass('active')
  })
})
