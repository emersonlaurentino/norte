import type { TSchema } from '@sinclair/typebox'
import type { ValidateFunction } from 'ajv'

// Core
export type NorteStore = Record<string, unknown>
export type NorteSchema = TSchema

// Logger
export interface NorteLogger {
  info(obj: object, msg?: string): void
  warn(obj: object, msg?: string): void
  error(obj: object, msg?: string): void
  debug(obj: object, msg?: string): void
  child(bindings: object): NorteLogger
  bindings(): Record<string, unknown>
  level: string
}

export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'silent'

export type LoggerOptions =
  | boolean
  | {
      level?: LogLevel
      name?: string
      [key: string]: unknown
    }

export type TelemetryOptions = {
  enabled: boolean
  serviceName?: string
}

// Hooks & Handlers
export type BaseContext<TStore extends NorteStore = NorteStore> = {
  store: TStore
  log: NorteLogger
}

export type BeforeHookContext<TStore extends NorteStore = NorteStore> =
  BaseContext<TStore> & {
    request: Request
    headers: Headers
    param: Record<string, string>
    query: Record<string, string>
    error: (code: string, msg: string) => Error
  }

export type AfterHookContext<TStore extends NorteStore = NorteStore> =
  BaseContext<TStore> & {
    result: unknown
    response: { status?: number }
    headers: Headers
  }

export type HandlerContext<TStore extends NorteStore = NorteStore> =
  BaseContext<TStore> & {
    body: unknown
    param: Record<string, unknown>
    query: Record<string, unknown>
    request?: Request
  }

export type PaginationContext = {
  page: number
  limit: number
  offset: number
}

export type BeforeHook<T extends NorteStore = NorteStore> = (
  ctx: BeforeHookContext<T>,
) => T | Promise<T>

export type AfterHook<T extends NorteStore = NorteStore> = (
  ctx: AfterHookContext<T>,
) => void | Promise<void>

export type Handler<T extends NorteStore = NorteStore> = (
  ctx: HandlerContext<T>,
) => unknown | Promise<unknown>

export type ListHandler<T extends NorteStore = NorteStore> = (
  ctx: HandlerContext<T> & { pagination: PaginationContext },
) => unknown | Promise<unknown>

// Router
export type RouterOptions<T extends NorteStore = NorteStore> = {
  schema: NorteSchema
  version?: number
  beforeHandler?: BeforeHook<T>[]
  afterHandler?: AfterHook<T>[]
}

export type RouteOptions<T extends NorteStore = NorteStore> = {
  body?: NorteSchema
  query?: NorteSchema
  param?: NorteSchema
  beforeHandler?: BeforeHook<T>[]
  afterHandler?: AfterHook<T>[]
}

// Norte
export type OpenAPIServerConfig = {
  url: string
  description?: string
}

export type NorteOptions = {
  logger?: LoggerOptions
  telemetry?: TelemetryOptions
  openapi?: {
    title?: string
    version?: string
    description?: string
    servers?: OpenAPIServerConfig[]
  }
}

// Services
export type CompiledRoute = {
  pathPattern: string
  routeParts: string[]
  paramNames: string[]
  defaultStatus: number
  execute: (req: Request, params: Record<string, string>) => Promise<Response>
}

export type OpenAPIRouteMetadata = {
  method: string
  path: string
  summary?: string
  description?: string
  tags: string[]
  operationId: string
  requestBody?: Record<string, unknown>
  parameters?: Record<string, unknown>[]
  responses: Record<string, Record<string, unknown>>
  'x-norte-invalidates'?: string[]
  'x-norte-domain': string
  'x-norte-version': number
}

export interface IValidator {
  compile(schema: NorteSchema): ValidateFunction
  validate(validator: ValidateFunction, data: unknown): void
  getErrorText(validator: ValidateFunction): string
}

// Pagination
export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: PaginationMeta
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: Omit<PaginationMeta, 'totalPages'>,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  }
}
