import { describe, expect, it } from 'vitest'
import { NorteError, type ErrorCode } from '../error'

describe('NorteError', () => {
  describe('constructor', () => {
    it('should create error with NOT_FOUND code', () => {
      const error = new NorteError('NOT_FOUND', 'Resource not found')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(NorteError)
      expect(error.name).toBe('NorteError')
      expect(error.code).toBe('NOT_FOUND')
      expect(error.message).toBe('Resource not found')
      expect(error.statusCode).toBe(404)
      expect(error.details).toBeUndefined()
    })

    it('should create error with INVALID_INPUT code', () => {
      const error = new NorteError('INVALID_INPUT', 'Invalid data provided')
      
      expect(error.code).toBe('INVALID_INPUT')
      expect(error.statusCode).toBe(400)
    })

    it('should create error with UNAUTHORIZED code', () => {
      const error = new NorteError('UNAUTHORIZED', 'Authentication required')
      
      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.statusCode).toBe(401)
    })

    it('should create error with FORBIDDEN code', () => {
      const error = new NorteError('FORBIDDEN', 'Access denied')
      
      expect(error.code).toBe('FORBIDDEN')
      expect(error.statusCode).toBe(403)
    })

    it('should create error with CONFLICT code', () => {
      const error = new NorteError('CONFLICT', 'Resource conflict')
      
      expect(error.code).toBe('CONFLICT')
      expect(error.statusCode).toBe(409)
    })

    it('should create error with INTERNAL_SERVER_ERROR code', () => {
      const error = new NorteError('INTERNAL_SERVER_ERROR', 'Something went wrong')
      
      expect(error.code).toBe('INTERNAL_SERVER_ERROR')
      expect(error.statusCode).toBe(500)
    })

    it('should create error with details', () => {
      const details = { field: 'email', issue: 'invalid format' }
      const error = new NorteError('INVALID_INPUT', 'Validation failed', details)
      
      expect(error.details).toEqual(details)
    })

    it('should have correct error message inheritance', () => {
      const error = new NorteError('NOT_FOUND', 'Custom message')
      
      expect(error.message).toBe('Custom message')
      expect(error.toString()).toContain('Custom message')
    })
  })

  describe('status code mapping', () => {
    it('should correctly map all error codes to status codes', () => {
      const testCases: Array<[ErrorCode, number]> = [
        ['NOT_FOUND', 404],
        ['INVALID_INPUT', 400],
        ['UNAUTHORIZED', 401],
        ['FORBIDDEN', 403],
        ['CONFLICT', 409],
        ['INTERNAL_SERVER_ERROR', 500],
      ]

      testCases.forEach(([code, expectedStatus]) => {
        const error = new NorteError(code, 'Test message')
        expect(error.statusCode).toBe(expectedStatus)
      })
    })
  })

  describe('error properties', () => {
    it('should be throwable', () => {
      expect(() => {
        throw new NorteError('NOT_FOUND', 'Test error')
      }).toThrow(NorteError)
    })

    it('should preserve stack trace', () => {
      const error = new NorteError('INTERNAL_SERVER_ERROR', 'Test error')
      expect(error.stack).toBeDefined()
    })
  })
})
