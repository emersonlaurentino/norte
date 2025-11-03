export class RouteMatcher {
  public splitPath(path: string): {
    routeParts: string[]
    paramNames: string[]
  } {
    const paramNames: string[] = []
    const routeParts = path.split('/').filter(Boolean)

    for (const part of routeParts) {
      if (part.charCodeAt(0) === 58) {
        paramNames.push(part.slice(1))
      }
    }

    return { routeParts, paramNames }
  }

  public match(
    routeParts: string[],
    pathParts: string[],
    paramNames: string[],
  ): Record<string, string> | null {
    // Check for wildcard catch-all pattern (last part is '*')
    const hasWildcard = routeParts[routeParts.length - 1] === '*'

    if (hasWildcard) {
      // For wildcard, we need at least as many path parts as route parts (minus the wildcard)
      const minParts = routeParts.length - 1
      if (pathParts.length < minParts) {
        return null
      }

      // Match only the prefix before the wildcard
      const params: Record<string, string> = {}
      let paramIdx = 0

      for (let i = 0; i < minParts; i++) {
        const routePart = routeParts[i]
        const pathPart = pathParts[i]

        if (!routePart || !pathPart) {
          return null
        }

        if (routePart.charCodeAt(0) === 58) {
          const paramName = paramNames[paramIdx++]
          if (paramName) {
            params[paramName] = pathPart
          }
        } else if (routePart !== pathPart) {
          return null
        }
      }

      return params
    }

    // Normal matching (exact length)
    if (routeParts.length !== pathParts.length) {
      return null
    }

    const params: Record<string, string> = {}
    let paramIdx = 0

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i]
      const pathPart = pathParts[i]

      if (!routePart || !pathPart) {
        return null
      }

      if (routePart.charCodeAt(0) === 58) {
        const paramName = paramNames[paramIdx++]
        if (paramName) {
          params[paramName] = pathPart
        }
      } else if (routePart !== pathPart) {
        return null
      }
    }

    return params
  }

  public splitPathname(pathname: string): string[] {
    return pathname.split('/').filter(Boolean)
  }
}
