# Testing Guide - Norte Framework

## 🧪 Configuração de Testes

O Norte utiliza [Vitest](https://vitest.dev/) como framework de testes, oferecendo uma experiência rápida e moderna.

## 📦 Dependências

```json
{
  "devDependencies": {
    "vitest": "^4.0.4",
    "@vitest/ui": "^4.0.4",
    "@vitest/coverage-v8": "^4.0.4"
  }
}
```

## 🚀 Comandos Disponíveis

### Executar todos os testes
```bash
bun run test
```

### Executar testes em modo watch
```bash
bun run test -- --watch
```

### Executar testes com UI interativa
```bash
bun run test:ui
```

### Executar testes com cobertura
```bash
bun run test:coverage
```

### Executar um arquivo de teste específico
```bash
bun run test src/radix-tree.test.ts
```

## 📊 Cobertura de Testes

### RadixTree (src/radix-tree.ts)
- **Cobertura**: 98.14%
- **Branches**: 93.54%
- **Functions**: 100%
- **Lines**: 98.11%

### Casos de Teste Cobertos

#### 1. Rotas Estáticas
- ✅ Inserção e busca de rotas simples
- ✅ Rotas aninhadas
- ✅ Múltiplos métodos HTTP no mesmo path
- ✅ Retorno null para rotas inexistentes

#### 2. Rotas Dinâmicas
- ✅ Parâmetros dinâmicos únicos (`:id`)
- ✅ Múltiplos parâmetros dinâmicos
- ✅ Priorização de rotas estáticas sobre dinâmicas
- ✅ Caracteres especiais em parâmetros

#### 3. Rotas Wildcard
- ✅ Inserção e busca de wildcards (`*`)
- ✅ Priorização correta (static > dynamic > wildcard)

#### 4. Rotas Versionadas
- ✅ Suporte a versionamento de API (`/v1/`, `/v2/`)
- ✅ Parâmetros dinâmicos em rotas versionadas

#### 5. Recursos Aninhados
- ✅ Rotas profundamente aninhadas
- ✅ Múltiplos níveis de aninhamento
- ✅ Extração correta de parâmetros em hierarquias

#### 6. Edge Cases
- ✅ Segmentos de path vazios
- ✅ Path raiz (`/`)
- ✅ Paths com barras iniciais
- ✅ Matches parciais (devem retornar null)

#### 7. Funcionalidades Auxiliares
- ✅ `getAllRoutes()` - retorna todas as rotas inseridas
- ✅ Suporte a múltiplos métodos HTTP
- ✅ Estruturas de dados corretas

#### 8. Performance e Escalabilidade
- ✅ Inserção e busca de 1000+ rotas
- ✅ Estruturas complexas e aninhadas

## 📝 Exemplo de Teste

```typescript
import { describe, expect, it } from 'vitest'
import { RadixTree } from './radix-tree'

describe('RadixTree', () => {
  it('should insert and find a simple static route', () => {
    const tree = new RadixTree()
    const route = createMockRoute('/users', 'GET')
    
    tree.insert('GET', '/users', route)
    
    const result = tree.find('GET', '/users')
    expect(result).not.toBeNull()
    expect(result?.route).toBe(route)
    expect(result?.params).toEqual({})
  })
})
```

## 🎯 Boas Práticas

1. **Nomenclatura**: Use nomes descritivos que expliquem o que está sendo testado
2. **Arrange-Act-Assert**: Organize os testes em três seções claras
3. **Isolamento**: Cada teste deve ser independente
4. **Cobertura**: Busque pelo menos 80% de cobertura de código
5. **Edge Cases**: Sempre teste casos extremos e situações inesperadas

## 🔧 Configuração (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/types.ts',
      ],
    },
  },
})
```

## 📚 Recursos

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🐛 Debugging

### Executar testes em modo debug
```bash
bun run test -- --inspect-brk
```

### Ver apenas testes que falharam
```bash
bun run test -- --reporter=verbose --bail=1
```

### Executar testes relacionados a arquivos modificados
```bash
bun run test -- --changed
```

## 📈 Próximos Passos

- [ ] Adicionar testes para `router.ts`
- [ ] Adicionar testes para `norte.ts`
- [ ] Adicionar testes para `validator.ts`
- [ ] Adicionar testes para `lifecycle.ts`
- [ ] Adicionar testes de integração end-to-end
- [ ] Configurar CI/CD para executar testes automaticamente



