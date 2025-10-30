import { Router } from '../router'
import type { NorteStore } from '../types'

export class PathBuilder {
  public buildFullPath<TStore extends NorteStore>(
    router: Router<TStore>,
    path: string,
  ): string {
    const parts: string[] = []

    let currentRouter: Router<TStore> | null = router
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

      currentRouter = parent as Router<TStore> | null
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
