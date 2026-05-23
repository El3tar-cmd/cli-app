# 🧪 Testing & Quality Assurance (2026 Edition)

> Skills for ensuring code correctness, reliability, and confidence in changes.

## Testing Pyramid (2026)

```
         ╱ E2E Tests ╲        ← Few, critical user flows
        ╱ Integration  ╲       ← Service boundaries, DB, APIs
       ╱  Unit Tests    ╲      ← Many, fast, isolated
      ╱  Static Analysis ╲     ← TypeScript, ESLint, Biome
```

## Unit Testing

- **Framework**: Vitest (modern, fast, ESM-native) or Jest
- **Arrange-Act-Assert (AAA)**: Structure every test clearly
- **Test behavior, not implementation**: Test what the function does, not how
- **Descriptive names**: `should return empty array when no items match filter`
- **One assertion per test** (ideal) — or tightly related assertions
- **Mock at boundaries**: Mock external services, not internal modules
- **Snapshot testing**: Use sparingly. Prefer explicit assertions.

## Integration Testing

- **Test real interactions**: DB queries, HTTP calls, message queue operations
- **Use test containers**: Docker-based ephemeral databases (Testcontainers)
- **Contract testing**: Pact for API consumer/provider contracts
- **Seed data**: Use factories (faker.js) instead of static fixtures
- **Clean up**: Reset DB state between tests

## E2E Testing

- **Playwright** (preferred 2026): Fast, reliable, multi-browser
- **Test critical paths only**: Login, checkout, data creation flows
- **Page Object Model**: Abstract UI interactions into reusable objects
- **Visual regression**: Screenshot comparison for UI consistency
- **Accessibility testing**: Integrate `axe-core` in E2E pipeline

## TDD Workflow

1. **Red**: Write a failing test that describes desired behavior
2. **Green**: Write minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green
4. **Repeat**: Continue with the next behavior

## Coverage Strategy

- **80%+ coverage** as a target, not a religion
- **Focus on critical paths**: Auth, payments, data mutations
- **Branch coverage**: More meaningful than line coverage
- **Mutation testing**: Verify tests actually catch bugs (Stryker)

## Static Analysis (2026)

- **Biome**: Fast all-in-one linter + formatter (replacing ESLint + Prettier for many teams)
- **ESLint**: Still strong for custom rules, plugin ecosystem
- **TypeScript strict mode**: Best static analysis tool — catches errors before runtime
- **Security linting**: `eslint-plugin-security`, `semgrep`

## When to Use

Activate these skills when the user asks to:
- Write, fix, or improve tests at any level
- Set up testing frameworks or CI test pipelines
- Implement TDD workflow
- Improve test coverage or quality
- Debug failing tests or flaky tests
