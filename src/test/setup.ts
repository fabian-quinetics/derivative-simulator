import '@testing-library/jest-dom'
import { vi } from 'vitest'

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}))

vi.mock('../api', () => ({
  fetchMonteCarlo: vi.fn().mockResolvedValue({ paths: [], finalPrices: [], stats: { mean: 100, percentile5: 90, percentile95: 110 } }),
  fetchPayoffSurface: vi.fn().mockResolvedValue({ rows: [], min: -100, max: 100 }),
  fetchPathDependency: vi.fn().mockResolvedValue({ data: [], baseReturn: 0, certReturn: 0, optReturn: 0, expectedReturn: 0, volatilityDrag: 0 }),
  fetchQuantilePayoff: vi.fn().mockResolvedValue({ data: [], forecastPeriod: 30 }),
  fetchSummary: vi.fn().mockResolvedValue([]),
  fetchAssets: vi.fn().mockResolvedValue({ assets: [] }),
  fetchAssetPredictions: vi.fn().mockResolvedValue(null),
}))
