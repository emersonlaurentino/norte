import { Router } from './router'
import { ErrorHandler } from './services/error-handler'
import { Logger } from './services/logger'
import { OpenAPIGenerator } from './services/openapi-generator'
import { PathBuilder } from './services/path-builder'
import { RouteCompiler } from './services/route-compiler'
import { RouteMatcher } from './services/route-matcher'
import { Validator } from './services/validator'
import type {
  CompiledRoute,
  Env,
  HttpMethod,
  NorteOptions,
  RawHandler,
  RawHandlerContext,
} from './types'

export class Norte {
  #compiledRoutes: Map<string, CompiledRoute[]> = new Map()
  #rawRoutes: Map<string, CompiledRoute[]> = new Map()

  #logger: Logger
  #validator: Validator
  #routeMatcher: RouteMatcher
  #pathBuilder: PathBuilder
  #openApiGenerator: OpenAPIGenerator
  #errorHandler: ErrorHandler
  #routeCompiler: RouteCompiler
  #scalarEnabled: boolean
  #scalarSources: string

  constructor(options: NorteOptions = {}) {
    this.#logger = new Logger(options.logger, options.telemetry)
    this.#validator = new Validator()
    this.#routeMatcher = new RouteMatcher()
    this.#pathBuilder = new PathBuilder()
    this.#openApiGenerator = new OpenAPIGenerator(options.openapi)
    this.#errorHandler = new ErrorHandler()
    this.#scalarEnabled = options.openapi?.ui !== false
    this.#scalarSources = this.#buildScalarSources(options.openapi?.sources)
    this.#routeCompiler = new RouteCompiler(
      this.#validator,
      this.#pathBuilder,
      this.#routeMatcher,
      this.#logger,
      this.#errorHandler,
    )
  }

  #buildScalarSources(
    sources?: {
      url: string
      title?: string
    }[],
  ): string {
    const norteSource = { url: '/openapi.json', title: 'API', default: true }
    const allSources = [norteSource, ...(sources || [])]
    return `"sources":${JSON.stringify(allSources)}`
  }

  public register(router: Router) {
    const { definitions } = Router.getInternals(router)

    for (const definition of definitions) {
      const compiledRoute = this.#routeCompiler.compile(definition)
      const method = definition.method.toUpperCase()

      if (!this.#compiledRoutes.has(method)) {
        this.#compiledRoutes.set(method, [])
      }
      const routes = this.#compiledRoutes.get(method)
      if (routes) {
        routes.push(compiledRoute)
      }

      this.#openApiGenerator.addRouteMetadata(
        definition,
        compiledRoute.pathPattern,
      )
    }
  }

  #getEnv(cloudflareEnv?: Env): Env {
    // If Cloudflare Workers env is provided, use it
    if (cloudflareEnv) {
      return cloudflareEnv
    }

    // For Node.js/Bun, use process.env
    if (typeof process !== 'undefined' && process.env) {
      return process.env as Env
    }

    // Fallback to empty object
    return {} as Env
  }

  public raw(
    method: HttpMethod | HttpMethod[] | '*',
    path: string | '*',
    handler: RawHandler,
  ): this {
    const normalizedPath = path === '*' ? '/*' : path
    const { routeParts, paramNames } =
      this.#routeMatcher.splitPath(normalizedPath)

    // Cache para o handler inicializado (lazy initialization)
    let initializedHandler:
      | ((ctx: RawHandlerContext) => Response | Promise<Response>)
      | undefined
    // Promise para garantir single initialization (proteção contra race condition)
    let initPromise: Promise<void> | undefined

    const compiledRoute: CompiledRoute = {
      pathPattern: normalizedPath,
      routeParts,
      paramNames,
      defaultStatus: 200,
      execute: async (
        req: Request,
        params: Record<string, string>,
        cloudflareEnv?: Env,
      ) => {
        const log = this.#logger.createLogger(req)
        try {
          log.debug({ method, path: normalizedPath }, 'Raw route executed')

          const url = new URL(req.url)
          const query = Object.fromEntries(url.searchParams.entries())

          let body: unknown = null
          const contentType = req.headers.get('content-type')
          if (contentType?.includes('application/json') && req.body) {
            body = await req.json()
          }

          const env = this.#getEnv(cloudflareEnv)

          if (!initializedHandler && !initPromise) {
            initPromise = Promise.resolve(handler(env)).then((h) => {
              initializedHandler = h
            })
          }

          if (initPromise) {
            await initPromise
            initPromise = undefined
          }

          if (!initializedHandler) {
            throw new Error('Handler not initialized')
          }

          const result = initializedHandler({
            log,
            body,
            param: params,
            query,
            request: req,
            env,
          })

          const response = await Promise.resolve(result)
          const requestId = Logger.getRequestId(log, req)
          if (requestId && response instanceof Response && !response.headers.has('X-Request-ID')) {
            const customHeaders = new Headers(response.headers)
            customHeaders.set('X-Request-ID', requestId)
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: customHeaders,
            })
          }

          return response
        } catch (err) {
          const requestId = Logger.getRequestId(log, req)
          return this.#errorHandler.handle(err, requestId)
        }
      },
    }

    const methods =
      method === '*'
        ? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
        : Array.isArray(method)
          ? method
          : [method]

    for (const m of methods) {
      const upperMethod = m.toUpperCase()
      if (!this.#rawRoutes.has(upperMethod)) {
        this.#rawRoutes.set(upperMethod, [])
      }
      this.#rawRoutes.get(upperMethod)?.push(compiledRoute)
    }

    return this
  }

  public fetch = async (
    req: Request,
    cloudflareEnv?: Env,
  ): Promise<Response> => {
    const method = req.method.toUpperCase()
    const url = new URL(req.url)
    const pathname = url.pathname

    if (method === 'GET' && pathname === '/openapi.json') {
      const log = this.#logger.createLogger(req)
      const requestId = Logger.getRequestId(log, req)
      const openApiDoc = this.#openApiGenerator.generateDocument(req)
      const hasCustomServers = this.#openApiGenerator.hasCustomServers()
      const cacheControl = hasCustomServers
        ? 'public, max-age=3600'
        : 'no-store, no-cache, must-revalidate'

      return new Response(JSON.stringify(openApiDoc, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': cacheControl,
          'X-Request-ID': requestId,
        },
      })
    }

    if (method === 'GET' && pathname === '/' && this.#scalarEnabled) {
      const log = this.#logger.createLogger(req)
      const requestId = Logger.getRequestId(log, req)
      const html = `<!doctype html>
<html>
  <head>
    <title>${this.#openApiGenerator.getTitle()}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="scalar-api-reference"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      const apiReferenceElement = document.getElementById('scalar-api-reference')
      Scalar.createApiReference(
        apiReferenceElement,
        {
          showToolbar: 'never',
          ${this.#scalarSources}
        }
      )
    </script>
  </body>
</html>`

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Request-ID': requestId,
        },
      })
    }

    const pathParts = this.#routeMatcher.splitPathname(pathname)

    const rawRoutes = this.#rawRoutes.get(method)
    if (rawRoutes) {
      for (const route of rawRoutes) {
        const params = this.#routeMatcher.match(
          route.routeParts,
          pathParts,
          route.paramNames,
        )
        if (params !== null) {
          return await route.execute(req, params, cloudflareEnv)
        }
      }
    }

    const routes = this.#compiledRoutes.get(method)
    if (routes) {
      for (const route of routes) {
        const params = this.#routeMatcher.match(
          route.routeParts,
          pathParts,
          route.paramNames,
        )
        if (params !== null) {
          return await route.execute(req, params, cloudflareEnv)
        }
      }
    }

    const log = this.#logger.createLogger(req)
    const requestId = Logger.getRequestId(log, req)
    return this.#errorHandler.createNotFoundResponse(requestId)
  }
}
