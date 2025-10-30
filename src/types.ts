export type NorteStore = Record<string, unknown>

export interface NorteLogger {
  info(obj: object, msg?: string): void
  warn(obj: object, msg?: string): void
  error(obj: object, msg?: string): void
  debug(obj: object, msg?: string): void
  child(bindings: object): NorteLogger
  bindings(): Record<string, unknown>
  level: string
}

export type LoggerOptions =
  | boolean
  | {
      level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'
      name?: string
      [key: string]: unknown
    }

export type TelemetryOptions = {
  enabled: boolean
  serviceName?: string
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number }
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit)
    }
  }
}
