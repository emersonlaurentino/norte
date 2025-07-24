# Norte Tests

This directory contains comprehensive test suites for the Norte framework using Vitest.

## Test Structure

### Unit Tests

- **`error.test.ts`** - Tests for the `NorteError` class
  - Error code mapping
  - Status code validation
  - Error properties and inheritance
  - All error types (NOT_FOUND, INVALID_INPUT, UNAUTHORIZED, etc.)

- **`router.test.ts`** - Tests for the `Router` class
  - Constructor overloads (root and nested routers)
  - CRUD operations (list, create, read, update, delete)
  - Method chaining
  - Path generation
  - Error handling in handlers
  - Public/private route configurations

- **`norte.test.ts`** - Tests for the main `Norte` class
  - Configuration handling
  - Middleware registration
  - Router registration
  - Authentication setup
  - Documentation setup
  - Health check endpoint
  - Fetch proxy functionality

- **`index.test.ts`** - Tests for the main entry point
  - Export validation
  - Type checking
  - Module structure verification

### Integration Tests

- **`integration.test.ts`** - End-to-end integration tests
  - Norte + Router integration
  - Multiple router handling
  - Nested router support
  - Error handling across components
  - Configuration scenarios
  - CRUD operation chains

### Test Setup

- **`setup.ts`** - Global test configuration
  - Mock cleanup
  - Global setup/teardown

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests once
bun test:run

# Run with coverage
bun test:coverage
```

## Test Coverage

The test suite covers:

- ✅ All error types and status codes
- ✅ Router CRUD operations
- ✅ Method chaining patterns
- ✅ Nested router configurations
- ✅ Norte class initialization and setup
- ✅ Middleware registration
- ✅ Authentication integration
- ✅ Documentation generation
- ✅ Export validation
- ✅ Integration scenarios

## Mocking Strategy

The tests use comprehensive mocking for external dependencies:

- **Hono OpenAPI** - Mocked to avoid external HTTP dependencies
- **Better Auth** - Mocked authentication flow
- **Scalar** - Mocked documentation generation
- **Hono middlewares** - Mocked logger and pretty-JSON

Internal modules (Norte, Router, NorteError) are tested with real implementations to ensure proper integration.

## Test Philosophy

1. **Unit tests** focus on individual component behavior
2. **Integration tests** verify components work together
3. **Mocks** are used only for external dependencies
4. **Real implementations** are used for internal logic
5. **Type safety** is maintained throughout tests
6. **Error scenarios** are comprehensively covered

## Adding New Tests

When adding new features:

1. Add unit tests for the new functionality
2. Update integration tests if components interact
3. Ensure error scenarios are covered
4. Maintain type safety in test code
5. Follow the existing naming and structure patterns
