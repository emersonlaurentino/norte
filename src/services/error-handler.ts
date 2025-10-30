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

  public handle(err: unknown): Response {
    if (err instanceof NorteError) {
      const statusCode = this.#getStatusCode(err.code)
      return new Response(
        JSON.stringify({
          error: err.code,
          message: err.message,
        }),
        {
          status: statusCode,
          headers: { 'content-type': 'application/json' },
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
        headers: { 'content-type': 'application/json' },
      },
    )
  }

  #getStatusCode(code: string): number {
    return this.#errorCodeToStatusMap[code] || 500
  }

  public createNotFoundResponse(): Response {
    return new Response(
      JSON.stringify({
        error: 'NOT_FOUND',
        message: 'Route not found',
      }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      },
    )
  }
}
