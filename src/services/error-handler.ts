import { NorteError } from '../router'

export class ErrorHandler {
  #errorCodeToStatusMap: Record<string, number> = {
    INVALID_INPUT: 400,
    INVALID_OUTPUT: 500,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
  }

  public handle(err: unknown, requestId?: string): Response {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (requestId) {
      headers.set('X-Request-ID', requestId)
    }

    if (err instanceof NorteError) {
      const statusCode = this.#getStatusCode(err.code)
      return new Response(
        JSON.stringify({
          error: err.code,
          message: err.message,
        }),
        {
          status: statusCode,
          headers,
        },
      )
    }

    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers,
      },
    )
  }

  #getStatusCode(code: string): number {
    return this.#errorCodeToStatusMap[code] || 500
  }

  public createNotFoundResponse(requestId?: string): Response {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (requestId) {
      headers.set('X-Request-ID', requestId)
    }
    return new Response(
      JSON.stringify({
        error: 'NOT_FOUND',
        message: 'Route not found',
      }),
      {
        status: 404,
        headers,
      },
    )
  }
}
