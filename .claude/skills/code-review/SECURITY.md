# Security Review Checklist

## Injection Vulnerabilities

### SQL Injection
- [ ] All database queries use parameterized statements
- [ ] No string concatenation in SQL queries
- [ ] ORM methods used correctly (no raw SQL without sanitization)

```typescript
// BAD
db.query(`SELECT * FROM users WHERE id = ${userId}`)

// GOOD
db.query('SELECT * FROM users WHERE id = ?', [userId])
```

### Command Injection
- [ ] No `child_process.exec()` with user input
- [ ] `execFile()` or `spawn()` used with argument arrays
- [ ] Shell metacharacters escaped if shell required

```typescript
// BAD
exec(`git clone ${repoUrl}`)

// GOOD
execFile('git', ['clone', repoUrl])
```

### XSS (Cross-Site Scripting)
- [ ] User input escaped before rendering
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] Content-Security-Policy headers set

### Path Traversal
- [ ] File paths validated against base directory
- [ ] No direct use of user input in `fs.readFile()`
- [ ] `path.resolve()` used with validation

```typescript
// BAD
fs.readFile(userPath)

// GOOD
const safePath = path.resolve(baseDir, userPath)
if (!safePath.startsWith(baseDir)) throw new Error('Invalid path')
```

---

## Authentication & Authorization

### Authentication
- [ ] Passwords hashed with bcrypt/argon2 (not MD5/SHA1)
- [ ] Session tokens are cryptographically random
- [ ] Token expiration implemented
- [ ] Rate limiting on login attempts

### Authorization
- [ ] Every endpoint checks user permissions
- [ ] No direct object references without ownership check
- [ ] Admin routes protected
- [ ] Principle of least privilege applied

```typescript
// BAD - IDOR vulnerability
app.get('/users/:id', (req, res) => {
  return db.getUser(req.params.id)  // Anyone can access any user
})

// GOOD
app.get('/users/:id', (req, res) => {
  if (req.params.id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).send('Forbidden')
  }
  return db.getUser(req.params.id)
})
```

---

## Secrets & Credentials

### Hardcoded Secrets
- [ ] No API keys in source code
- [ ] No passwords in configuration files
- [ ] No private keys committed
- [ ] `.env` files in `.gitignore`

**Patterns to grep:**
```bash
# Check for potential secrets
grep -rn "password\s*=" --include="*.ts" --include="*.js"
grep -rn "api_key\s*=" --include="*.ts" --include="*.js"
grep -rn "secret\s*=" --include="*.ts" --include="*.js"
grep -rn "Bearer\s" --include="*.ts" --include="*.js"
```

### Environment Variables
- [ ] Secrets loaded from environment
- [ ] No fallback defaults for secrets
- [ ] Secrets not logged

```typescript
// BAD
const API_KEY = process.env.API_KEY || 'default-key-12345'

// GOOD
const API_KEY = process.env.API_KEY
if (!API_KEY) throw new Error('API_KEY required')
```

---

## Data Validation

### Input Validation
- [ ] All user input validated before use
- [ ] Type coercion handled explicitly
- [ ] Array/object inputs validated for structure
- [ ] Size limits on string/array inputs

### Output Encoding
- [ ] JSON responses use proper serialization
- [ ] HTML output escaped
- [ ] Filenames sanitized before use

---

## Cryptography

### Encryption
- [ ] AES-256-GCM for symmetric encryption
- [ ] RSA-OAEP or ECDH for asymmetric
- [ ] No custom crypto implementations
- [ ] Unique IVs/nonces for each encryption

### Hashing
- [ ] SHA-256 or SHA-3 for integrity
- [ ] bcrypt/argon2 for passwords
- [ ] No MD5 or SHA1 for security purposes

---

## Network Security

### HTTPS
- [ ] All external calls use HTTPS
- [ ] Certificate validation enabled
- [ ] No `rejectUnauthorized: false` in production

### CORS
- [ ] CORS origins explicitly whitelisted
- [ ] No `Access-Control-Allow-Origin: *` with credentials
- [ ] Preflight requests handled

---

## Error Handling

### Information Disclosure
- [ ] Stack traces not exposed to users
- [ ] Internal paths not revealed
- [ ] Database errors sanitized
- [ ] Consistent error format

```typescript
// BAD
catch (err) {
  res.status(500).json({ error: err.stack })
}

// GOOD
catch (err) {
  logger.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
```

---

## Severity Reference

| Finding | Severity |
|---------|----------|
| SQL/Command injection | Critical |
| Hardcoded secrets | Critical |
| Missing auth check | High |
| XSS vulnerability | High |
| Weak password hashing | High |
| Path traversal | High |
| CORS misconfiguration | Medium |
| Missing rate limiting | Medium |
| Stack trace exposure | Medium |
| Verbose error messages | Low |
