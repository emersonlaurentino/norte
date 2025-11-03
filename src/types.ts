import type { TSchema } from '@sinclair/typebox'
import type { ValidateFunction } from 'ajv'

// Core
export type NorteStore = Store
export type NorteSchema = TSchema

// Store - can be extended via module augmentation
export interface Store extends Record<string, unknown> {}

// Env - can be extended via module augmentation
export interface Env extends Record<string, unknown> {}

// HTTP Method with autocomplete
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | '*'
  | (string & {})

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
export type BaseContext = {
  store: Store
  log: NorteLogger
  env: Env
}

export type BeforeHookContext = BaseContext & {
  request: Request
  headers: Headers
  param: Record<string, string>
  query: Record<string, string>
  error: (code: string, msg: string) => Error
}

export type AfterHookContext = BaseContext & {
  result: unknown
  response: { status?: number }
  headers: Headers
}

export type HandlerContext = BaseContext & {
  body: unknown
  param: Record<string, unknown>
  query: Record<string, unknown>
  request: Request
}

export type PaginationContext = {
  page: number
  limit: number
  offset: number
}

export type BeforeHook = (ctx: BeforeHookContext) => Store | Promise<Store>

export type AfterHook = (ctx: AfterHookContext) => void | Promise<void>

export type Handler = (ctx: HandlerContext) => unknown | Promise<unknown>

export type ListHandler = (
  ctx: HandlerContext & { pagination: PaginationContext },
) => unknown | Promise<unknown>

// Raw Route (without store)
export type RawHandlerContext = {
  log: NorteLogger
  body: unknown
  param: Record<string, unknown>
  query: Record<string, unknown>
  request: Request
  env: Env
}

export type RawHandler = (
  env: Env,
) =>
  | ((ctx: RawHandlerContext) => Response | Promise<Response>)
  | Promise<(ctx: RawHandlerContext) => Response | Promise<Response>>

// Router
export type RouterOptions = {
  schema?: NorteSchema
  version?: number
  beforeHandler?: BeforeHook[]
  afterHandler?: AfterHook[]
}

export type RouteOptions = {
  body?: NorteSchema
  query?: NorteSchema
  param?: NorteSchema
  beforeHandler?: BeforeHook[]
  afterHandler?: AfterHook[]
}

// Norte
export type OpenAPIServerConfig = {
  url: string
  description?: string
}

export type OpenAPISource = {
  url: string
  label?: string
}

export type NorteOptions = {
  logger?: LoggerOptions
  telemetry?: TelemetryOptions
  openapi?: {
    title?: string
    version?: string
    description?: string
    servers?: OpenAPIServerConfig[]
    ui?: boolean
    sources?: OpenAPISource[]
  }
}

// Services
export type CompiledRoute = {
  pathPattern: string
  routeParts: string[]
  paramNames: string[]
  defaultStatus: number
  execute: (
    req: Request,
    params: Record<string, string>,
    cloudflareEnv?: Env,
  ) => Promise<Response>
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
