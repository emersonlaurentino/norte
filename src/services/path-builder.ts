import { Router } from '../router'

export class PathBuilder {
  public buildFullPath(router: Router, path: string): string {
    const parts: string[] = []

    let currentRouter: Router | null = router
    let version: number | undefined

    while (currentRouter) {
      const internals = Router.getInternals(currentRouter)
      const { domain, parent, options } = internals

      if (!parent && options.version !== undefined) {
        version = options.version
      }

      parts.unshift(domain)

      if (parent) {
        const parentDomain = Router.getInternals(parent).domain
        const parentDomainId = parentDomain.endsWith('s')
          ? `${parentDomain.slice(0, -1)}Id`
          : `${parentDomain}Id`
        parts.unshift(`:${parentDomainId}`)
      }

      currentRouter = parent as Router | null
    }

    const versionPrefix = `v${version ?? 1}`
    parts.unshift(versionPrefix)

    let fullPath = `/${parts.join('/')}`

    if (path) {
      fullPath += path
    }

    return fullPath
  }
}
