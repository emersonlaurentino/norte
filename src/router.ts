import type {
  Handler,
  ListHandler,
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

export type RouteDefinition = {
  method: string
  path: string
  handler: Handler
  options: RouteOptions
  router: Router
}

export class Router {
  readonly #domain: string
  readonly #parent: Router | null
  readonly #options: RouterOptions
  readonly #definitions: RouteDefinition[] = []

  constructor(domain: string, options: RouterOptions)
  constructor(parent: Router, domain: string, options: RouterOptions)
  constructor(
    parentOrDomain: Router | string,
    domainOrOptions: string | RouterOptions,
    options?: RouterOptions,
  ) {
    if (typeof parentOrDomain === 'string') {
      this.#domain = parentOrDomain
      this.#parent = null
      this.#options = domainOrOptions as RouterOptions
    } else {
      this.#parent = parentOrDomain
      this.#domain = domainOrOptions as string
      if (!options) {
        throw new Error('RouterOptions is required for nested routers.')
      }
      if (!options.schema) {
        throw new Error('Schema is required for nested routers.')
      }
      this.#options = options
    }

    if (!this.#domain) {
      throw new Error('The domain of the Router cannot be empty.')
    }
  }

  public list(options: RouteOptions, handler: ListHandler): this {
    return this.#addDefinition('GET', '', options, handler)
  }

  public create(options: RouteOptions, handler: Handler): this {
    return this.#addDefinition('POST', '', options, handler)
  }

  public read(options: RouteOptions, handler: Handler): this {
    return this.#addDefinition(
      'GET',
      `/:${this.#getDomainId()}`,
      options,
      handler,
    )
  }

  public update(options: RouteOptions, handler: Handler): this {
    return this.#addDefinition(
      'PATCH',
      `/:${this.#getDomainId()}`,
      options,
      handler,
    )
  }

  public delete(options: RouteOptions, handler: Handler): this {
    return this.#addDefinition(
      'DELETE',
      `/:${this.#getDomainId()}`,
      options,
      handler,
    )
  }

  #addDefinition(
    method: string,
    path: string,
    options: RouteOptions,
    handler: Handler | ListHandler,
  ): this {
    this.#definitions.push({
      method,
      path,
      options,
      handler: handler as Handler,
      router: this,
    })
    return this
  }

  #getDomainId(): string {
    return this.#domain.endsWith('s')
      ? `${this.#domain.slice(0, -1)}Id`
      : `${this.#domain}Id`
  }

  public static getInternals(router: Router): {
    domain: string
    parent: Router | null
    options: RouterOptions
    definitions: RouteDefinition[]
  } {
    return {
      domain: router.#domain,
      parent: router.#parent,
      options: router.#options,
      definitions: router.#definitions,
    }
  }
}
