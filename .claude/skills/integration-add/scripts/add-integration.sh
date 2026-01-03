#!/bin/bash
# Generate boilerplate for a new integration
# Usage: ./add-integration.sh <service-name>

set -e

SERVICE="$1"

if [[ -z "$SERVICE" ]]; then
  echo "Usage: $0 <service-name>"
  echo "Example: $0 slack"
  exit 1
fi

# Normalize names
SERVICE_LOWER=$(echo "$SERVICE" | tr '[:upper:]' '[:lower:]')
SERVICE_UPPER=$(echo "$SERVICE" | tr '[:lower:]' '[:upper:]')
SERVICE_PASCAL=$(echo "$SERVICE" | sed 's/.*/\u&/')

WORKSPACES="/Users/rashid/Desktop/Workspaces"
PROXY_DIR="$WORKSPACES/mentu-proxy"
MENTU_DIR="$WORKSPACES/mentu-ai"

echo "=== Integration Boilerplate Generator ==="
echo "Service: $SERVICE_LOWER"
echo ""

# Check directories exist
if [[ ! -d "$PROXY_DIR" ]]; then
  echo "Error: mentu-proxy not found at $PROXY_DIR"
  exit 1
fi

if [[ ! -d "$MENTU_DIR" ]]; then
  echo "Error: mentu-ai not found at $MENTU_DIR"
  exit 1
fi

# 1. Create signal handler template
SIGNAL_FILE="$PROXY_DIR/src/${SERVICE_LOWER}-signals.ts"
if [[ -f "$SIGNAL_FILE" ]]; then
  echo "Warning: $SIGNAL_FILE already exists, skipping..."
else
  cat > "$SIGNAL_FILE" << 'SIGNAL_TEMPLATE'
// ${SERVICE_PASCAL} webhook signal handling for mentu-proxy

interface Env {
  ${SERVICE_UPPER}_WEBHOOK_SECRET: string;
  MENTU_API_KEY: string;
  MENTU_ENDPOINT: string;
  WORKSPACE_ID: string;
}

interface ${SERVICE_PASCAL}Event {
  type: string;
  // Add service-specific fields
  id?: string;
  timestamp?: string;
}

// Event transforms
const ${SERVICE_UPPER}_TRANSFORMS: Record<string, {
  kind: string;
  body: (e: ${SERVICE_PASCAL}Event) => string;
  meta: (e: ${SERVICE_PASCAL}Event) => object;
}> = {
  // Add event transforms here
  // 'event.type': {
  //   kind: '${SERVICE_LOWER}_event',
  //   body: (e) => `Description: ${e.id}`,
  //   meta: (e) => ({ id: e.id }),
  // },
};

/**
 * Verify ${SERVICE_PASCAL} webhook signature
 */
async function verify${SERVICE_PASCAL}Signature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (signature.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle ${SERVICE_PASCAL} webhook
 */
export async function handle${SERVICE_PASCAL}Signal(
  request: Request,
  body: string,
  env: Env
): Promise<Response> {
  // 1. Verify signature
  const signature = request.headers.get('X-${SERVICE_PASCAL}-Signature');
  if (!signature || !(await verify${SERVICE_PASCAL}Signature(body, signature, env.${SERVICE_UPPER}_WEBHOOK_SECRET))) {
    return jsonResponse(
      { error: 'unauthorized', message: 'Invalid or missing signature' },
      401
    );
  }

  // 2. Parse event
  let event: ${SERVICE_PASCAL}Event;
  try {
    event = JSON.parse(body);
  } catch {
    return jsonResponse(
      { error: 'bad_request', message: 'Invalid JSON payload' },
      400
    );
  }

  // 3. Check for verification request (if service uses this pattern)
  if (event.type === 'verification' || event.type === 'url_verification') {
    return jsonResponse({ status: 'verified' });
  }

  // 4. Get transform
  const transform = ${SERVICE_UPPER}_TRANSFORMS[event.type];
  if (!transform) {
    return jsonResponse({
      status: 'ignored',
      message: `Unsupported event type: ${event.type}`,
    });
  }

  // 5. Generate idempotency key
  const requestId = request.headers.get('X-Request-ID') || event.id || Date.now().toString();
  const sourceKey = `${SERVICE_LOWER}:${requestId}`;

  // 6. Build capture payload
  const capturePayload = {
    op: 'capture',
    body: transform.body(event),
    kind: transform.kind,
    source_key: sourceKey,
    actor: 'signal:${SERVICE_LOWER}',
    meta: {
      ...transform.meta(event),
      event_type: event.type,
      event_timestamp: event.timestamp,
    },
  };

  // 7. Forward to Mentu API
  try {
    const response = await fetch(`${env.MENTU_ENDPOINT}/ops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.MENTU_API_KEY,
        'X-Workspace-Id': env.WORKSPACE_ID,
      },
      body: JSON.stringify(capturePayload),
    });

    if (!response.ok) {
      const error = await response.text();

      if (response.status === 409) {
        return jsonResponse(
          { status: 'duplicate', source_key: sourceKey },
          200
        );
      }

      return jsonResponse(
        { error: 'capture_failed', message: error },
        502
      );
    }

    const result = await response.json();
    return jsonResponse({
      status: 'captured',
      memory_id: (result as { id: string }).id,
      source_key: sourceKey,
    });
  } catch (error) {
    return jsonResponse(
      { error: 'internal', message: String(error) },
      500
    );
  }
}
SIGNAL_TEMPLATE

  # Replace template variables
  sed -i '' "s/\${SERVICE_PASCAL}/$SERVICE_PASCAL/g" "$SIGNAL_FILE"
  sed -i '' "s/\${SERVICE_UPPER}/$SERVICE_UPPER/g" "$SIGNAL_FILE"
  sed -i '' "s/\${SERVICE_LOWER}/$SERVICE_LOWER/g" "$SIGNAL_FILE"

  echo "Created: $SIGNAL_FILE"
fi

# 2. Show what to add to index.ts
echo ""
echo "=== Add to mentu-proxy/src/index.ts ==="
echo ""
echo "// Add import:"
echo "import { handle${SERVICE_PASCAL}Signal } from './${SERVICE_LOWER}-signals.js';"
echo ""
echo "// Add to Env interface:"
echo "  ${SERVICE_UPPER}_WEBHOOK_SECRET: string;"
echo ""
echo "// Add route (in /signals/ section):"
echo "if (source === '${SERVICE_LOWER}') {"
echo "  return handle${SERVICE_PASCAL}Signal(request, body, env);"
echo "}"

# 3. Show what to add to .env
echo ""
echo "=== Add to /Workspaces/.env ==="
echo ""
echo "# ${SERVICE_PASCAL} Integration"
echo "${SERVICE_UPPER}_WORKSPACE_ID=xxx"
echo "${SERVICE_UPPER}_INTEGRATION_TOKEN=xxx"
echo "# Webhook URL: https://mentu-proxy.affihub.workers.dev/signals/${SERVICE_LOWER}"
echo "# ${SERVICE_UPPER}_WEBHOOK_SECRET=<set via wrangler>"

# 4. Show genesis.key entry
echo ""
echo "=== Add to mentu-ai/.mentu/genesis.key ==="
echo ""
echo "\"signal:${SERVICE_LOWER}\":"
echo "  role: \"service\""
echo "  operations: [capture, annotate]"

# 5. Show wrangler command
echo ""
echo "=== Deploy Steps ==="
echo ""
echo "cd $PROXY_DIR"
echo "wrangler secret put ${SERVICE_UPPER}_WEBHOOK_SECRET"
echo "wrangler deploy"

echo ""
echo "=== Done ==="
echo "Review the generated file and complete the manual steps above."
