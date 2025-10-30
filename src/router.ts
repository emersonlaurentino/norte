import type {
  AfterHook,
  BeforeHook,
  Handler,
  ListHandler,
  NorteSchema,
  NorteStore,
  RouteOptions,
  RouterOptions,
} from './types'

export class NorteError extends Error {
  public code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export type RouteDefinition<TStore extends NorteStore = NorteStore> = {
  method: string
  path: string
  handler: Handler<TStore>
  options: RouteOptions<TStore>
  router: Router<TStore>
}

export class Router<TStore extends NorteStore = NorteStore> {
  readonly #domain: string
  readonly #parent: Router<TStore> | null
  readonly #options: RouterOptions<TStore>
  readonly #definitions: RouteDefinition<TStore>[] = []

  constructor(domain: string, options: RouterOptions<TStore>)
  constructor(
    parent: Router<TStore>,
    domain: string,
    options: RouterOptions<TStore>,
  )
  constructor(
    parentOrDomain: Router<TStore> | string,
    domainOrOptions: string | RouterOptions<TStore>,
    options?: RouterOptions<TStore>,
  ) {
    if (typeof parentOrDomain === 'string') {
      this.#domain = parentOrDomain
      this.#parent = null
      this.#options = domainOrOptions as RouterOptions<TStore>
    } else {
      this.#parent = parentOrDomain
      this.#domain = domainOrOptions as string
      if (!options) {
        throw new Error('RouterOptions with schema is required.')
      }
      this.#options = options
    }

    if (!this.#domain) {
      throw new Error('The domain of the Router cannot be empty.')
    }
  }

  public list(
    options: RouteOptions<TStore>,
    handler: ListHandler<TStore>,
  ): this {
    return this.#addDefinition('GET', '', options, handler)
  }

  public create(options: RouteOptions<TStore>, handler: Handler<TStore>): this {
    return this.#addDefinition('POST', '', options, handler)
  }

  public read(options: RouteOptions<TStore>, handler: Handler<TStore>): this {
    return this.#addDefinition(
      'GET',
      `/:${this.#getDomainId()}`,
      options,
      handler,
    )
  }

  public update(options: RouteOptions<TStore>, handler: Handler<TStore>): this {
    return this.#addDefinition(
      'PATCH',
      `/:${this.#getDomainId()}`,
      options,
      handler,
    )
  }

  public delete(options: RouteOptions<TStore>, handler: Handler<TStore>): this {
    return this.#addDefinition(
      'DELETE',
      `/:${this.#getDomainId()}`,
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
    return this.#addDefinition(method, path, options, handler)
  }

  #addDefinition(
    method: string,
    path: string,
    options: RouteOptions<TStore>,
    handler: Handler<TStore> | ListHandler<TStore>,
  ): this {
    this.#definitions.push({
      method,
      path,
      options,
      handler: handler as Handler<TStore>,
      router: this,
    })
    return this
  }

  #getDomainId(): string {
    return this.#domain.endsWith('s')
      ? `${this.#domain.slice(0, -1)}Id`
      : `${this.#domain}Id`
  }

  public static getInternals<TStore extends NorteStore = NorteStore>(
    router: Router<TStore>,
  ): {
    domain: string
    parent: Router<TStore> | null
    options: RouterOptions<TStore>
    definitions: RouteDefinition<TStore>[]
  } {
    return {
      domain: router.#domain,
      parent: router.#parent,
      options: router.#options,
      definitions: router.#definitions,
    }
  }
}
