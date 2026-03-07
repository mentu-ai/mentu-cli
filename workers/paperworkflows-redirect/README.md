# Paperworkflows Redirect Worker

Cloudflare Worker for branded redirects with custom OG meta tags.

## Why This Exists

Simple redirects (301/302) don't work for custom OG images because social media crawlers don't follow redirects when extracting meta tags. This Worker serves HTML with OG tags first, then redirects the browser.

## Current Redirects

| Path | Destination | OG Title |
|------|-------------|----------|
| `/prepa-anahuac-inscripciones-2026` | Fillout form | Inscripciones Prepa Anáhuac 2026 |

## Setup Instructions

### 1. Add Domain to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click "Add a site" → Enter `paperworkflows.com`
3. Select **Free** plan
4. Copy the two nameservers provided

### 2. Update GoDaddy Nameservers

1. Log into [GoDaddy](https://dcc.godaddy.com)
2. Find `paperworkflows.com` → DNS settings
3. Change Nameservers → Custom
4. Enter the Cloudflare nameservers
5. Wait 15-60 minutes for propagation

### 3. Deploy Worker

```bash
cd mentu-ai/workers/paperworkflows-redirect
npm install
wrangler login  # If not logged in
wrangler deploy
```

### 4. Add Route

1. Go to Cloudflare Dashboard → Workers & Pages
2. Find `paperworkflows-redirect`
3. Settings → Triggers → Add Route
4. Route: `paperworkflows.com/prepa-anahuac-inscripciones-2026`
5. Zone: `paperworkflows.com`

Or uncomment and update the `routes` section in `wrangler.toml`.

## Adding New Redirects

Edit `src/index.ts` and add to the `REDIRECTS` array:

```typescript
{
  path: '/new-path',
  targetUrl: 'https://destination.com',
  ogTitle: 'Title for social sharing',
  ogDescription: 'Description for social sharing',
  ogImage: 'https://paperworkflows.com/og-new-image.jpg',
}
```

Then redeploy: `wrangler deploy`

## Testing

1. **Test redirect**: Visit the URL in browser
2. **Test OG tags**: Use [Facebook Debugger](https://developers.facebook.com/tools/debug/)
3. **Test Twitter**: Use [Twitter Card Validator](https://cards-dev.twitter.com/validator)

## Local Development

```bash
npm run dev
# Opens at http://localhost:8787
```

## OG Image Recommendations

- Size: 1200x630 pixels
- Format: JPG or PNG
- Host on: Cloudflare R2, or same domain
