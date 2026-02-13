# Cloudflare CDN Caching for Bug Screenshots

## Overview

Bug screenshots from Supabase Storage are automatically cached at Cloudflare's edge network, reducing latency and bandwidth costs.

## Cache Headers

The `bug-screenshot` handler includes these headers:

```
Cache-Control: public, max-age=3600, immutable
```

| Directive | Meaning |
|-----------|---------|
| `public` | Response can be cached by CDN and browsers |
| `max-age=3600` | Cache for 1 hour (3600 seconds) |
| `immutable` | Content never changes (safe for aggressive caching) |

## Why Immutable?

Screenshots are stored with unique filenames (`{timestamp}.webp`). Once uploaded, they never change. This makes them ideal for `immutable` caching.

## Cache Behavior

```
First Request:
User → Cloudflare Edge → Supabase Storage → Download (cache MISS)
       ↓ (cache)

Subsequent Requests (within 1 hour):
User → Cloudflare Edge → Return cached copy (cache HIT)
```

## Cache Invalidation

Screenshots auto-delete after 30 days via Supabase lifecycle policy. Cache entries expire naturally after 1 hour.

**No manual purging needed.**

## Verification

Check cache status in response headers:

```bash
curl -I https://nwhtjzgcbjuewuhapjua.supabase.co/storage/v1/object/public/bug-attachments/{workspace}/{bug}/{timestamp}.webp

# Look for:
# CF-Cache-Status: HIT (cached)
# CF-Cache-Status: MISS (not cached yet)
# CF-Cache-Status: EXPIRED (cache expired, refetching)
```

## Performance Impact

- **Latency**: ~200ms (Supabase US) → ~20ms (Cloudflare edge)
- **Bandwidth**: 90%+ reduction (most requests served from cache)
- **Origin Load**: 90%+ reduction (Supabase serves ~10% of requests)

## Configuration

No additional Cloudflare configuration required. Caching is automatic based on `Cache-Control` headers.
