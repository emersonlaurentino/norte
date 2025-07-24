// Error types for type safety
export type ErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR'

export type ErrorStatusMap = {
  NOT_FOUND: 404
  INVALID_INPUT: 400
  UNAUTHORIZED: 401
  FORBIDDEN: 403
  CONFLICT: 409
  INTERNAL_SERVER_ERROR: 500
}

export class NorteError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: ErrorStatusMap[ErrorCode]
  public readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'NorteError'
    this.code = code
    this.details = details

    // Map error codes to HTTP status codes
    const statusMap: ErrorStatusMap = {
      NOT_FOUND: 404,
      INVALID_INPUT: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      CONFLICT: 409,
      INTERNAL_SERVER_ERROR: 500,
    }

    this.statusCode = statusMap[code]
  }
}
