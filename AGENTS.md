Todo o framework deve seguir os principios do [manifesto](./manifest.md)

## Regras de Desenvolvimento

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