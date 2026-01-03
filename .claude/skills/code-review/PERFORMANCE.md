# Performance Review Checklist

## Algorithmic Complexity

### Time Complexity
- [ ] No O(n²) or worse in hot paths
- [ ] Nested loops justified and bounded
- [ ] Recursive functions have termination
- [ ] Search operations use appropriate data structures

```typescript
// BAD - O(n²)
users.forEach(user => {
  const order = orders.find(o => o.userId === user.id)
})

// GOOD - O(n)
const orderMap = new Map(orders.map(o => [o.userId, o]))
users.forEach(user => {
  const order = orderMap.get(user.id)
})
```

### Space Complexity
- [ ] No unbounded array growth
- [ ] Large objects not duplicated unnecessarily
- [ ] Streams used for large data
- [ ] Memory cleaned up in long-running processes

---

## Database Operations

### Query Optimization
- [ ] N+1 queries eliminated
- [ ] Indexes exist for filtered columns
- [ ] JOINs used instead of multiple queries
- [ ] Pagination implemented for large datasets

```typescript
// BAD - N+1 queries
const users = await db.query('SELECT * FROM users')
for (const user of users) {
  user.orders = await db.query('SELECT * FROM orders WHERE user_id = ?', [user.id])
}

// GOOD - Single query with JOIN
const users = await db.query(`
  SELECT u.*, o.*
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
`)
```

### Connection Management
- [ ] Connection pooling configured
- [ ] Connections released after use
- [ ] Transactions scoped appropriately
- [ ] Prepared statements cached

---

## I/O Operations

### File System
- [ ] Async file operations used
- [ ] Streams for large files
- [ ] Buffering appropriate for use case
- [ ] File handles closed

```typescript
// BAD - Blocks event loop
const content = fs.readFileSync('large-file.txt')

// GOOD - Non-blocking
const content = await fs.promises.readFile('large-file.txt')

// BETTER - Streaming for very large files
const stream = fs.createReadStream('huge-file.txt')
```

### Network
- [ ] HTTP keep-alive enabled
- [ ] Connection reuse for repeated calls
- [ ] Timeouts configured
- [ ] Retries with backoff

---

## Caching

### Application Cache
- [ ] Expensive computations cached
- [ ] Cache invalidation strategy defined
- [ ] TTL set appropriately
- [ ] Cache size bounded

```typescript
// Simple memoization
const cache = new Map()
function expensiveOperation(key) {
  if (cache.has(key)) return cache.get(key)
  const result = /* compute */
  cache.set(key, result)
  return result
}
```

### HTTP Caching
- [ ] Cache-Control headers set
- [ ] ETags used for conditional requests
- [ ] Static assets have long cache times
- [ ] API responses have appropriate caching

---

## Concurrency

### Async Patterns
- [ ] `Promise.all` for independent operations
- [ ] No await in loops (batch instead)
- [ ] Worker threads for CPU-intensive tasks
- [ ] Proper error handling in async code

```typescript
// BAD - Sequential
for (const id of ids) {
  await fetchData(id)
}

// GOOD - Parallel
await Promise.all(ids.map(id => fetchData(id)))

// BETTER - Controlled parallelism
import pLimit from 'p-limit'
const limit = pLimit(10)
await Promise.all(ids.map(id => limit(() => fetchData(id))))
```

### Resource Limits
- [ ] Concurrent connection limits
- [ ] Request queue bounds
- [ ] Memory limits for buffers
- [ ] CPU-bound work offloaded

---

## Rendering (Frontend)

### React/Vue Optimization
- [ ] `useMemo`/`computed` for expensive derivations
- [ ] `useCallback` for stable function references
- [ ] Lists have stable keys
- [ ] Large lists virtualized

```typescript
// BAD - Recalculates every render
const sorted = items.sort((a, b) => a.name.localeCompare(b.name))

// GOOD - Memoized
const sorted = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
)
```

### Bundle Size
- [ ] Code splitting implemented
- [ ] Tree shaking working
- [ ] No duplicate dependencies
- [ ] Images optimized

---

## Monitoring Points

### Metrics to Track
- [ ] Response time (p50, p95, p99)
- [ ] Memory usage over time
- [ ] Database query duration
- [ ] Cache hit rate
- [ ] Error rate

---

## Severity Reference

| Finding | Severity |
|---------|----------|
| O(n²) in API endpoint | High |
| N+1 database queries | High |
| Sync file operations | High |
| Memory leak | High |
| Missing pagination | Medium |
| No caching strategy | Medium |
| Await in loop | Medium |
| Missing indexes | Medium |
| No connection pooling | Medium |
| Large bundle size | Low |
