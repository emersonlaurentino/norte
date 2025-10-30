import type { TSchema } from '@sinclair/typebox'
import type { NorteLogger, NorteStore } from './types'

export type NorteSchema = TSchema

export class NorteError extends Error {
  public code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export type BeforeHookContext<TStore extends NorteStore = NorteStore> = {
  req: Request
  headers: Headers
  param: Record<string, string> // Params *brutos* (strings)
  query: Record<string, string> // Query *bruta* (strings)
  store: TStore // O "saco" para preencher
  log: NorteLogger
  error: (code: string, msg: string) => NorteError
}

/** Contexto injetado no 'afterHandler' (Camada de Protocolo) */
export type AfterHookContext<TStore extends NorteStore = NorteStore> = {
  result: unknown // O que o handler retornou ou lançou
  response: { status?: number } // O estado da resposta para mutar
  headers: Headers // Headers da resposta para mutar
  store: TStore
  log: NorteLogger
}

/** Contexto injetado no 'handler' (Camada de Negócio Pura) */
export type HandlerContext<TStore extends NorteStore = NorteStore> = {
  body: unknown
  param: Record<string, unknown>
  query: Record<string, unknown>
  store: TStore
  log: NorteLogger
}

/** Contexto de paginação injetado nos 'handlers' .list() */
export type PaginationContext = {
  page: number
  limit: number
  offset: number
}

export type BeforeHook<TStore extends NorteStore = NorteStore> = (
  ctx: BeforeHookContext<TStore>,
) => TStore | Promise<TStore>

export type AfterHook<TStore extends NorteStore = NorteStore> = (
  ctx: AfterHookContext<TStore>,
) => Promise<void> | void

export type Handler<TStore extends NorteStore = NorteStore> = (
  ctx: HandlerContext<TStore>,
) => Promise<unknown> | unknown

export type ListHandler<TStore extends NorteStore = NorteStore> =
  Handler<TStore> & {
    pagination: PaginationContext
  }

export type RouterOptions<TStore extends NorteStore = NorteStore> = {
  beforeHandler?: BeforeHook<TStore>[]
  afterHandler?: AfterHook<TStore>[]
}

export type RouteOptions<TStore extends NorteStore = NorteStore> = {
  body?: NorteSchema
  query?: NorteSchema
  param?: NorteSchema
  beforeHandler?: BeforeHook<TStore>[]
  afterHandler?: AfterHook<TStore>[]
}

export type RouteDefinition<TStore extends NorteStore = NorteStore> = {
  method: string
  path: string
  handler: Handler<TStore>
  options: RouteOptions<TStore>
  router: Router<TStore>
}

export class Router<TStore extends NorteStore = NorteStore> {
  private readonly domain: string
  private readonly parent: Router<TStore> | null
  private readonly options: RouterOptions<TStore>
  private readonly definitions: RouteDefinition<TStore>[] = []

  constructor(domain: string, options?: RouterOptions<TStore>)
  constructor(
    parent: Router<TStore>,
    domain: string,
    options?: RouterOptions<TStore>,
  )
  constructor(
    parentOrDomain: Router<TStore> | string,
    domainOrOptions?: string | RouterOptions<TStore>,
    options?: RouterOptions<TStore>,
  ) {
    if (typeof parentOrDomain === 'string') {
      this.domain = parentOrDomain
      this.parent = null
      this.options = (domainOrOptions as RouterOptions<TStore>) ?? {}
    } else {
      this.parent = parentOrDomain
      this.domain = domainOrOptions as string
      this.options = options ?? {}
    }

    if (!this.domain) {
      throw new Error('The domain of the Router cannot be empty.')
    }
  }

  public list(
    options: RouteOptions<TStore>,
    handler: ListHandler<TStore>,
  ): this {
    return this.addDefinition('GET', '', options, handler)
  }

  public create(options: RouteOptions<TStore>, handler: Handler<TStore>): this {
    return this.addDefinition('POST', '', options, handler)
  }

  public read(options: RouteOptions<TStore>, handler: Handler<TStore>): this {
    return this.addDefinition(
      'GET',
      `/:${this.getDomainId()}`,
      options,
      handler,
    )
  }

  public update(options: RouteOptions<TStore>, handler: Handler<TStore>): this {
    return this.addDefinition(
      'PATCH',
      `/:${this.getDomainId()}`,
      options,
      handler,
    )
  }

  public delete(options: RouteOptions<TStore>, handler: Handler<TStore>): this {
    return this.addDefinition(
      'DELETE',
      `/:${this.getDomainId()}`,
      options,
      handler,
    )
  }

  public custom(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string,
    path: string,
    options: RouteOptions<TStore>,
    handler: Handler<TStore>,
  ): this {
    return this.addDefinition(method, path, options, handler)
  }

  private addDefinition(
    method: string,
    path: string,
    options: RouteOptions<TStore>,
    handler: Handler<TStore>,
  ): this {
    this.definitions.push({ method, path, options, handler, router: this })
    return this
  }

  private getDomainId(): string {
    return this.domain.endsWith('s')
      ? `${this.domain.slice(0, -1)}Id`
      : `${this.domain}Id`
  }

  // Acesso interno: protegido por token via método estático
  public static getInternals<TStore extends NorteStore = NorteStore>(
    router: Router<TStore>,
  ): {
    domain: string
    parent: Router<TStore> | null
    options: RouterOptions<TStore>
    definitions: RouteDefinition<TStore>[]
  } {
    return {
      domain: router.domain,
      parent: router.parent,
      options: router.options,
      definitions: router.definitions,
    }
  }
}
