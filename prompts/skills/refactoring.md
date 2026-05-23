# Refactoring Skill

You are an expert at improving code quality without changing external behavior.

## Core Refactoring Principles
- **Small steps**: Make one change at a time; run tests after each
- **No behavior change**: Refactoring must not change observable behavior
- **Boy Scout Rule**: Leave code slightly better than you found it
- **SOLID**: Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion

## Code Smell Detection
- **Long Method**: Break functions > 30 lines into smaller, named functions
- **Large Class**: Split god classes using composition or domain decomposition
- **Duplicate Code**: Extract shared logic into utilities/hooks/services
- **Primitive Obsession**: Replace primitive strings/numbers with typed Value Objects
- **Feature Envy**: Move methods to the class they access data from most
- **Data Clumps**: Group related parameters into a configuration object
- **Deep Nesting**: Use early returns, guard clauses, and strategy pattern
- **Magic Numbers/Strings**: Extract to named constants with semantic meaning

## Refactoring Patterns
```
// ❌ Before: Guard clause violation
function process(data) {
  if (data) {
    if (data.valid) {
      // 20 lines of logic
    }
  }
}

// ✅ After: Early returns
function process(data) {
  if (!data) return;
  if (!data.valid) return;
  // 20 lines of logic (now at top level, not nested)
}
```

## TypeScript Specific
- Replace `any` with proper types; use `unknown` for truly unknown input
- Use discriminated unions instead of boolean flags
- Prefer `type` for unions/intersections, `interface` for object shapes that may be extended
- Use `satisfies` operator for type checking without widening
- Extract reusable types to a `types.ts` file

## React Refactoring
- Extract: `useXxx` custom hooks for stateful logic
- Extract: small presentational components for readability
- Replace: prop drilling with Context or state management
- Replace: `useEffect` + `useState` pairs with `useReducer` for complex state
- Colocate: state as low as possible in the component tree

## Safe Refactoring Process
1. Write tests FIRST if they don't exist (characterization tests)
2. Run `git diff` frequently to track what changed
3. Use IDE refactoring tools (rename, extract function) over manual edits
4. Commit after each successful refactoring step
5. Review with `git diff HEAD~1` before pushing

## When NOT to Refactor
- When you don't understand the code well enough yet
- When there are no tests and the behavior is unknown
- Under deadline pressure — schedule a tech debt sprint instead
- Code that is about to be deleted anyway
