import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Global test setup.
 *
 * Two things need stubbing for the component tests to run outside a browser:
 *  - `matchMedia`, which Tailwind-driven responsive hooks query;
 *  - `IntersectionObserver`, used by nothing yet but imported by some
 *    headless-UI primitives we may add.
 *
 * `next/navigation` is mocked per-test-file rather than here, so each test can
 * assert on the specific navigation calls it cares about.
 */

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn().mockReturnValue([])
  root = null
  rootMargin = ''
  thresholds: number[] = []
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})
