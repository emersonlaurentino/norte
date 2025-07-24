import { afterAll, afterEach, beforeAll, vi } from 'vitest'

// Global test setup
beforeAll(() => {
  // Setup any global test configuration here
})

afterAll(() => {
  // Cleanup after all tests
})

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks()
})
