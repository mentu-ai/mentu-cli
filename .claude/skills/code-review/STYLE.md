# Style Review Checklist

## Naming Conventions

### Variables & Functions
- [ ] Descriptive names (no single letters except loops)
- [ ] camelCase for variables and functions
- [ ] PascalCase for classes and types
- [ ] UPPER_SNAKE for constants
- [ ] Boolean variables prefixed: `is`, `has`, `should`, `can`

```typescript
// BAD
const d = new Date()
const x = users.filter(u => u.a)
function proc(d) { ... }

// GOOD
const createdAt = new Date()
const activeUsers = users.filter(user => user.isActive)
function processOrder(order) { ... }
```

### Files & Modules
- [ ] Filename matches primary export
- [ ] kebab-case or PascalCase for files (consistent)
- [ ] Index files only re-export
- [ ] Test files co-located or in `__tests__`

---

## Code Organization

### File Structure
- [ ] Imports grouped and ordered
- [ ] Types/interfaces near top
- [ ] Constants before functions
- [ ] Exports at bottom or inline

```typescript
// Order: external, internal, types, relative
import { Router } from 'express'
import { validate } from '@/utils/validation'
import type { User } from '@/types'
import { UserService } from './user-service'
```

### Function Length
- [ ] Functions < 50 lines
- [ ] Single responsibility
- [ ] Early returns for guard clauses
- [ ] Complex logic extracted to helpers

```typescript
// BAD - Nested conditions
function processUser(user) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        // actual logic
      }
    }
  }
}

// GOOD - Early returns
function processUser(user) {
  if (!user) return
  if (!user.isActive) return
  if (!user.hasPermission) return
  // actual logic
}
```

---

## TypeScript Patterns

### Type Safety
- [ ] No `any` without justification
- [ ] Strict null checks respected
- [ ] Type assertions minimal and documented
- [ ] Generics used for reusable code

```typescript
// BAD
function parse(data: any): any {
  return JSON.parse(data)
}

// GOOD
function parse<T>(data: string): T {
  return JSON.parse(data) as T
}
```

### Type Definitions
- [ ] Interfaces for object shapes
- [ ] Type aliases for unions/complex types
- [ ] No duplicate type definitions
- [ ] Types exported from central location

---

## Error Handling

### Error Patterns
- [ ] Errors have descriptive messages
- [ ] Error types differentiated
- [ ] Async errors caught
- [ ] No empty catch blocks

```typescript
// BAD
catch (e) {
  // silently swallow
}

// GOOD
catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', { error })
    return res.status(400).json({ error: error.message })
  }
  logger.error('Unexpected error', { error })
  throw error
}
```

---

## Documentation

### Comments
- [ ] Complex logic explained
- [ ] No obvious comments
- [ ] TODO/FIXME have issue references
- [ ] JSDoc for public APIs

```typescript
// BAD - Obvious
// Increment counter
counter++

// GOOD - Explains why
// Skip first element as it's the header row
data.slice(1).forEach(...)
```

### README/Docs
- [ ] Setup instructions complete
- [ ] API documented
- [ ] Examples provided
- [ ] Architecture explained

---

## Consistency

### Formatting
- [ ] Consistent indentation (spaces/tabs)
- [ ] Consistent quotes (single/double)
- [ ] Trailing commas in multiline
- [ ] Semicolons consistent

### Patterns
- [ ] Same pattern for similar operations
- [ ] Consistent error handling approach
- [ ] Consistent async style (callbacks/promises/async-await)
- [ ] Consistent import style

---

## Code Smells

### DRY Violations
- [ ] No copy-pasted code blocks
- [ ] Magic numbers extracted to constants
- [ ] Repeated patterns abstracted

```typescript
// BAD - Magic number
if (items.length > 100) { ... }

// GOOD
const MAX_ITEMS = 100
if (items.length > MAX_ITEMS) { ... }
```

### Dead Code
- [ ] No commented-out code
- [ ] No unused imports
- [ ] No unreachable code
- [ ] No unused variables

### Complexity
- [ ] No deeply nested conditionals (> 3 levels)
- [ ] No functions with > 5 parameters
- [ ] No classes with > 10 public methods
- [ ] Cyclomatic complexity reasonable

---

## Testing Style

### Test Organization
- [ ] Descriptive test names
- [ ] Arrange-Act-Assert pattern
- [ ] One assertion focus per test
- [ ] Setup/teardown in hooks

```typescript
// BAD
test('user', () => {
  const u = new User('test')
  expect(u.name).toBe('test')
  expect(u.isActive).toBe(true)
  expect(u.validate()).toBe(true)
})

// GOOD
describe('User', () => {
  describe('constructor', () => {
    it('sets the name from argument', () => {
      const user = new User('Alice')
      expect(user.name).toBe('Alice')
    })

    it('defaults to active status', () => {
      const user = new User('Alice')
      expect(user.isActive).toBe(true)
    })
  })
})
```

---

## Severity Reference

| Finding | Severity |
|---------|----------|
| `any` type widespread | Medium |
| Dead code/unused imports | Low |
| Inconsistent naming | Low |
| Missing documentation | Low |
| Copy-pasted code | Medium |
| Magic numbers | Low |
| Deeply nested code | Medium |
| Empty catch blocks | Medium |
