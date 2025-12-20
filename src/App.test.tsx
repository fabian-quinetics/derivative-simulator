import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the header title', () => {
    render(<App />)
    expect(screen.getByText('header.title')).toBeInTheDocument()
  })

  it('renders the language toggle button', () => {
    const { container } = render(<App />)
    expect(container.querySelector('.lang-toggle')).toBeInTheDocument()
  })

  it('renders the logo', () => {
    render(<App />)
    const logo = screen.getByAltText('QUINETICS')
    expect(logo).toBeInTheDocument()
  })
})
