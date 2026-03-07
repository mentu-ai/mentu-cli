/**
 * Paperworkflows Redirect Worker
 *
 * Handles branded redirects with custom OG meta tags for social sharing.
 * Simple redirects (301/302) don't work for custom OG images because
 * social media crawlers don't follow redirects when extracting meta tags.
 */

interface RedirectConfig {
  path: string;
  targetUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

// Redirect configurations
const REDIRECTS: RedirectConfig[] = [
  {
    path: '/prepa-anahuac-inscripciones-2026',
    targetUrl: 'https://forms.fillout.com/t/3aUCi6fbWQus',
    ogTitle: 'Inscripciones Prepa Anáhuac 2026',
    ogDescription: 'Inicia tu proceso de inscripción para el ciclo 2026',
    ogImage: 'https://paperworkflows.com/og-prepa-anahuac.jpg',
  },
  {
    path: '/prepa-anahuac-becas-liderazgo-2026',
    targetUrl: 'https://forms.fillout.com/t/oZUhaGWji9us',
    ogTitle: 'Solicitud de Becas de Liderazgo',
    ogDescription: 'Prepa Anáhuac Campus San Agustín',
    ogImage: 'https://paperworkflows.com/og-prepa-anahuac.jpg',
  },
];

function generateRedirectHtml(config: RedirectConfig, requestUrl: string): string {
  const ogUrl = requestUrl;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${config.ogTitle}</title>
  <meta name="title" content="${config.ogTitle}">
  <meta name="description" content="${config.ogDescription}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${ogUrl}">
  <meta property="og:title" content="${config.ogTitle}">
  <meta property="og:description" content="${config.ogDescription}">
  <meta property="og:image" content="${config.ogImage}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${ogUrl}">
  <meta property="twitter:title" content="${config.ogTitle}">
  <meta property="twitter:description" content="${config.ogDescription}">
  <meta property="twitter:image" content="${config.ogImage}">

  <!-- Redirect after 0 seconds (crawlers read meta tags before redirect) -->
  <meta http-equiv="refresh" content="0;url=${config.targetUrl}">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .loading {
      text-align: center;
      padding: 2rem;
    }
    .loading h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    .loading p {
      opacity: 0.9;
    }
    .loading a {
      color: white;
      text-decoration: underline;
    }
    .spinner {
      width: 40px;
      height: 40px;
      margin: 0 auto 1rem;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <h1>${config.ogTitle}</h1>
    <p>Redirigiendo al formulario de inscripción...</p>
    <p><a href="${config.targetUrl}">Haz clic aquí si no eres redirigido automáticamente</a></p>
  </div>
  <script>
    // Immediate JavaScript redirect as backup
    window.location.href = '${config.targetUrl}';
  </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Find matching redirect config
    const config = REDIRECTS.find(r => r.path === url.pathname);

    if (!config) {
      // No matching redirect - return 404 or pass through
      return new Response('Not Found', { status: 404 });
    }

    const html = generateRedirectHtml(config, request.url);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  },
};
