# Correctness Review Checklist

## Logic Errors

### Boundary Conditions
- [ ] Off-by-one errors checked
- [ ] Empty input handled
- [ ] Single element handled
- [ ] Maximum size handled

```typescript
// BAD - Off by one
for (let i = 0; i <= items.length; i++) {  // Should be <
  process(items[i])  // Undefined on last iteration
}

// BAD - Empty not handled
function first(items) {
  return items[0]  // Undefined if empty
}

// GOOD
function first(items) {
  if (items.length === 0) return null
  return items[0]
}
```

### Null/Undefined Handling
- [ ] Optional chaining used appropriately
- [ ] Nullish coalescing for defaults
- [ ] Null checks before property access
- [ ] Array methods on possibly-undefined arrays

```typescript
// BAD
const name = user.profile.name  // Crashes if profile undefined

// GOOD
const name = user.profile?.name ?? 'Unknown'
```

### Type Coercion
- [ ] Strict equality (`===`) used
- [ ] Explicit type conversion
- [ ] Boolean coercion intentional
- [ ] Number parsing validated

```typescript
// BAD
if (id == '123') { ... }  // Type coercion
const num = parseInt(input)  // NaN not handled

// GOOD
if (id === '123') { ... }
const num = parseInt(input, 10)
if (Number.isNaN(num)) throw new Error('Invalid number')
```

---

## State Management

### Mutation
- [ ] Immutable operations where expected
- [ ] No accidental state mutation
- [ ] Spread operators preserve originals
- [ ] Array methods return new arrays

```typescript
// BAD - Mutates original
function addItem(list, item) {
  list.push(item)  // Modifies input
  return list
}

// GOOD - Returns new array
function addItem(list, item) {
  return [...list, item]
}
```

### Race Conditions
- [ ] Shared state protected
- [ ] Async operations sequenced correctly
- [ ] No stale closure values
- [ ] Updates atomic where needed

```typescript
// BAD - Race condition
let count = 0
async function increment() {
  const current = count
  await doSomething()
  count = current + 1  // May overwrite concurrent update
}

// GOOD - Atomic or locked
import { Mutex } from 'async-mutex'
const mutex = new Mutex()
async function increment() {
  await mutex.runExclusive(() => {
    count++
  })
}
```

---

## Error States

### Expected Failures
- [ ] Network errors handled
- [ ] Parse errors caught
- [ ] Timeout behavior defined
- [ ] Retry logic appropriate

```typescript
// BAD - No error handling
const data = await fetch(url).then(r => r.json())

// GOOD
try {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const data = await response.json()
} catch (error) {
  if (error instanceof SyntaxError) {
    throw new Error('Invalid JSON response')
  }
  throw error
}
```

### Recovery
- [ ] Graceful degradation implemented
- [ ] Partial failures handled
- [ ] Cleanup on error (transactions, resources)
- [ ] User feedback on failure

---

## Data Integrity

### Validation
- [ ] Input validated at boundaries
- [ ] Schema validation for external data
- [ ] Constraints enforced in code
- [ ] Invariants maintained

```typescript
// BAD - Trusts external data
function processOrder(order) {
  ship(order.items)  // What if items is undefined?
}

// GOOD
function processOrder(order) {
  if (!order.items?.length) {
    throw new ValidationError('Order must have items')
  }
  ship(order.items)
}
```

### Consistency
- [ ] Related updates atomic
- [ ] Rollback on partial failure
- [ ] No orphaned records
- [ ] Foreign key integrity

```typescript
// BAD - Partial update possible
await db.updateUser(userId, { name })
await db.updateProfile(userId, { bio })  // User updated, profile fails?

// GOOD - Transaction
await db.transaction(async (tx) => {
  await tx.updateUser(userId, { name })
  await tx.updateProfile(userId, { bio })
})
```

---

## Async Correctness

### Promise Handling
- [ ] All promises awaited or handled
- [ ] No floating promises
- [ ] Promise.all errors handled
- [ ] Async iterators terminated

```typescript
// BAD - Floating promise
function saveAndNotify(data) {
  save(data)  // Promise not awaited
  notify()
}

// GOOD
async function saveAndNotify(data) {
  await save(data)
  await notify()
}
```

### Order of Operations
- [ ] Dependencies awaited before use
- [ ] Parallel operations intentional
- [ ] Sequential operations when required
- [ ] Initialization complete before use

---

## Edge Cases

### Common Scenarios
- [ ] Empty string vs null vs undefined
- [ ] Zero vs null vs undefined
- [ ] Empty array vs null
- [ ] Negative numbers
- [ ] Very large numbers
- [ ] Unicode/emoji in strings
- [ ] Timezone handling

```typescript
// Often forgotten edge cases
- user.age === 0  // Valid age!
- order.items.length === 0  // Valid empty order?
- name.trim() === ''  // Whitespace-only name
- date.getTimezoneOffset()  // Different results by location
```

### Platform Differences
- [ ] Path separators (Windows vs Unix)
- [ ] Line endings (CRLF vs LF)
- [ ] Locale-specific formatting
- [ ] Case sensitivity (filesystem)

---

## Contract Compliance

### API Contracts
- [ ] Response matches documented schema
- [ ] Error responses standardized
- [ ] Status codes appropriate
- [ ] Headers correct

### Function Contracts
- [ ] Return type matches declaration
- [ ] Side effects documented
- [ ] Preconditions validated
- [ ] Postconditions guaranteed

---

## Severity Reference

| Finding | Severity |
|---------|----------|
| Unhandled null/undefined | High |
| Race condition | High |
| Data corruption possible | Critical |
| Off-by-one error | High |
| Floating promise | High |
| Missing validation | Medium |
| Type coercion issues | Medium |
| Edge case not handled | Medium |
| Inconsistent error handling | Medium |
| Missing boundary check | Medium |
