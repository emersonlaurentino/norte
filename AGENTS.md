Todo o framework deve seguir os principios do [manifesto](./manifest.md)

## Regras de Desenvolvimento

### Estrutura de Testes

- **SEMPRE** coloque os testes dentro da pasta `src/__tests__/` na raiz
- **NUNCA** crie subpastas como `e2e/`, `integration/` ou `unit/` dentro de `__tests__/`
- **Organize** por funcionalidade através de nomes de arquivos descritivos (ex: `versioning.test.ts`, `hooks.test.ts`, `nested-routing.test.ts`)
- **Motivo**: Simplicidade e consistência. Todos os testes ficam no mesmo nível hierárquico, facilitando descoberta e manutenção

**Exemplo de estrutura correta:**

```
src/
  __tests__/
    basic-crud.test.ts
    versioning.test.ts
    hooks.test.ts
    nested-routing.test.ts
    error-handling.test.ts
    ❌ NÃO: e2e/
    ❌ NÃO: integration/
    ❌ NÃO: unit/
```

### Campos Privados

- **SEMPRE** use campos privados JavaScript (`#`) ao invés de `private` do TypeScript
- **Motivo**: `private` do TypeScript só funciona em tempo de compilação e os membros ainda são visíveis em runtime via reflection (`Object.getOwnPropertyNames()`)
- **Benefício**: Campos privados JavaScript (`#`) são verdadeiramente privados e invisíveis em runtime, garantindo uma API pública limpa e controlada

**Exemplo:**

```typescript
// ❌ Evite
class MyClass {
  private myMethod() { }
  private myField: string
}

// ✅ Prefira
class MyClass {
  #myMethod() { }
  #myField: string
}
```

### Observabilidade

- **Logger**: O framework usa Pino para logging estruturado
- **requestId**: Gerado automaticamente para cada request (ou extraído do header `X-Request-ID`)
- **Telemetria**: Suporte opcional a OpenTelemetry via configuração
- **trace_id**: Quando telemetria está habilitada, o `trace_id` é extraído do header `traceparent` (W3C Trace Context)
- Todos os logs incluem `requestId` automaticamente
- Hooks e handlers têm acesso ao mesmo logger com contexto compartilhado