# 🧪 Testing, Quality Assurance & AI-Augmented Verification (2026 Edition)

> Skills for ensuring correctness, reliability, and confidence in code at every level.

## Testing Pyramid (2026)

```
         ╱ E2E Tests ╲          ← Few, critical user flows (Playwright)
        ╱ Integration  ╲        ← Service boundaries, DB, APIs, queues
       ╱  Unit Tests    ╲       ← Many, fast, isolated, deterministic
      ╱  Static Analysis ╲      ← TypeScript strict + ESLint/Biome
```

- **Don't invert the pyramid**: heavy E2E suites are slow, flaky, and expensive to maintain.
- **Contract tests** belong between unit and integration — often neglected, extremely valuable.
- **Mutation testing** validates the tests themselves, not just coverage numbers.

---

## Unit Testing

- **Framework**: Vitest (ESM-native, fast, Vite-compatible) or Jest for legacy Node projects.
- **Arrange-Act-Assert (AAA)**: Structure every test with clear setup, action, and assertion.
- **Test behavior, not implementation**: Test what the function does, not the internal mechanics.
- **Descriptive names**: `should return empty array when no items match filter` — reads like a spec.
- **One behavior per test** — a test that checks three things gives you less signal when it fails.
- **Mock at boundaries**: Mock external services (HTTP, DB, filesystem), not internal modules.
- **Snapshot testing**: Use sparingly and only for stable, meaningful output. Prefer explicit assertions.

```typescript
// ✅ Good unit test
describe('filterByCategory', () => {
  it('returns empty array when no items match the category', () => {
    const items = [{ name: 'a', category: 'x' }];
    const result = filterByCategory(items, 'y');
    expect(result).toEqual([]);
  });

  it('returns all matching items without mutating the original array', () => {
    const items = [
      { name: 'a', category: 'x' },
      { name: 'b', category: 'x' },
    ];
    const result = filterByCategory(items, 'x');
    expect(result).toHaveLength(2);
    expect(items).toHaveLength(2); // original unchanged
  });
});
```

---

## Integration Testing

- **Test real interactions**: DB queries, HTTP calls, message queue operations — no mocks.
- **Test containers**: Docker-based ephemeral databases (Testcontainers) — reproducible, isolated.
- **Contract testing**: Pact for API consumer/provider contracts — prevents breaking changes across teams.
- **Seed data factories**: Use `faker.js` + factory functions. Never static fixtures.
- **DB reset between tests**: Wrap tests in transactions and rollback, or truncate tables in `afterEach`.

---

## E2E Testing

- **Playwright** (2026 default): Multi-browser, fast, reliable, excellent debugging tools.
- **Test critical paths only**: Login, checkout, core data creation flows, key user journeys.
- **Page Object Model**: Abstract UI interactions into reusable classes — not raw selectors everywhere.
- **Visual regression**: Screenshot comparison for design system consistency (Playwright + Percy/Argos).
- **Accessibility testing**: `@axe-core/playwright` in E2E catches real accessibility bugs.

---

## AI-Augmented Testing (2026)

### AI-Generated Test Cases
- Use AI to **generate edge cases** from function signatures and docstrings — it finds boundary conditions humans miss.
- AI can **write the test boilerplate** — you review and approve the scenarios.
- Feed AI a **failing bug report** and ask it to generate a regression test before writing the fix.

### Property-Based Testing
```typescript
import { fc, test } from '@fast-check/vitest';

// Property: serializing then deserializing always produces the original
test.prop([fc.record({ id: fc.uuid(), name: fc.string() })])(
  'serialize/deserialize is a round trip',
  (user) => {
    expect(deserialize(serialize(user))).toEqual(user);
  }
);
```
- **fast-check** or **proptest**: Generate thousands of random inputs automatically.
- Properties express **invariants** — "the output should always be sorted", "length should never decrease".
- Finds edge cases no human would think to test.

### Contract Testing for AI Outputs
- Define **output schemas** with Zod for every AI response your code depends on.
- **Validate before acting**: Never directly use AI-generated JSON without schema validation.
- **Golden file tests**: Save representative AI outputs as golden files — alert if model behavior shifts.

---

## TDD Workflow

1. **Red**: Write a failing test that describes desired behavior (spec-first)
2. **Green**: Write the minimum code to make it pass (no extras)
3. **Refactor**: Clean up while keeping all tests green
4. **Repeat**: Next behavior, next red test

---

## Coverage Strategy

- **80%+ coverage** as a target baseline, not a religion — 100% with useless tests is worse than 60% with great ones.
- **Focus coverage on critical paths**: Auth, payments, data mutations, state machines.
- **Branch coverage** over line coverage — tests that exercise every `if`/`else` are more meaningful.
- **Mutation testing**: Stryker or Cosmic Hamster — validates tests actually fail when code breaks.

---

## Static Analysis (2026)

- **Biome**: Fast all-in-one linter + formatter replacing ESLint + Prettier for many teams.
- **TypeScript strict mode**: The best static analysis available — catches errors before runtime.
- **ESLint**: Still valuable for custom rules, accessibility linting, and import ordering.
- **Security linting**: `eslint-plugin-security`, `semgrep` for common vulnerability patterns.

---

## CI Integration

```yaml
# Standard quality gate (GitHub Actions)
test:
  steps:
    - run: pnpm type-check
    - run: pnpm lint
    - run: pnpm test --coverage
    - run: pnpm test:e2e
  coverage:
    min-threshold: 80
```

- Run tests on every PR — never merge red builds.
- Separate fast tests (unit) from slow tests (E2E) — run E2E only on main/staging.
- **Flaky test quarantine**: Track flaky tests, quarantine them, fix or delete.

---

## When to Use

Activate when the user asks to:
- Write, fix, or improve tests at any level
- Set up testing frameworks or CI test pipelines
- Implement TDD workflow or improve test quality
- Debug failing or flaky tests
- Set up contract testing or property-based testing
- Validate AI model outputs or agent behavior
