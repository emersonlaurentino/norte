import { describe, expect, it } from 'vitest'
import * as index from '../index'

describe('index exports', () => {
  it('should export z from @hono/zod-openapi', () => {
    expect(index.z).toBeDefined()
    expect(typeof index.z.object).toBe('function')
    expect(typeof index.z.string).toBe('function')
    expect(typeof index.z.number).toBe('function')
  })

  it('should export NorteError from error module', () => {
    expect(index.NorteError).toBeDefined()
    expect(typeof index.NorteError).toBe('function')

    const error = new index.NorteError('NOT_FOUND', 'Test error')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('should export Norte class from norte module', () => {
    expect(index.Norte).toBeDefined()
    expect(typeof index.Norte).toBe('function')
  })

  it('should export Router class from router module', () => {
    expect(index.Router).toBeDefined()
    expect(typeof index.Router).toBe('function')
  })

  it('should export ErrorCode type from error module', () => {
    // Type exports can't be tested at runtime, but we can verify
    // that the error codes work with NorteError
    const validCodes = [
      'NOT_FOUND',
      'INVALID_INPUT',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'CONFLICT',
      'INTERNAL_SERVER_ERROR',
    ] as const

    validCodes.forEach((code) => {
      const error = new index.NorteError(code, 'Test message')
      expect(error.code).toBe(code)
    })
  })

  it('should have all expected exports', () => {
    const expectedExports = ['z', 'NorteError', 'Norte', 'Router']

    expectedExports.forEach((exportName) => {
      expect(index).toHaveProperty(exportName)
    })
  })
})
