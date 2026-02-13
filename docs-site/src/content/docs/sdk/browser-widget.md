---
title: "Browser Widget"
description: "Embed a bug reporter widget in any web application with a script tag or React component. Captures screenshots, console errors, and user context automatically."
---

The Mentu browser widget provides a ready-made UI for capturing bug reports from end users. It can be embedded in any web application with a single script tag or used as a React component. The widget captures screenshots, console errors, page URLs, and user descriptions, then sends everything to the Mentu ledger via the BugReporter SDK.

## Vanilla JS Widget

### Script Tag Installation

Add the widget to any HTML page:

```html
<script src="https://cdn.mentu.ai/widget.js"></script>
<script>
  Mentu.init({
    apiUrl: 'https://mentu-proxy.affihub.workers.dev/ops',
    apiToken: 'your-api-token',
    workspaceId: 'your-workspace-id',
  });
</script>
```

This injects a floating action button into the page. When clicked, it opens a bug report form that captures context automatically.

### Configuration

```js
Mentu.init({
  // Required
  apiUrl: 'https://mentu-proxy.affihub.workers.dev/ops',
  apiToken: 'your-api-token',
  workspaceId: 'your-workspace-id',

  // Optional: positioning
  position: 'bottom-right',      // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

  // Optional: theme
  theme: 'auto',                 // 'light' | 'dark' | 'auto' (follows prefers-color-scheme)

  // Optional: branding
  branding: {
    primaryColor: '#6366f1',     // Accent color for buttons and highlights
    logo: '/your-logo.svg',      // Logo shown in the widget header
    title: 'Report a Bug',       // Widget header title
    placeholder: 'Describe what went wrong...', // Textarea placeholder
  },

  // Optional: hooks
  onOpen: () => {},              // Called when the widget opens
  onClose: () => {},             // Called when the widget closes
  onSubmit: (memory) => {},      // Called after successful submission
  onError: (error) => {},        // Called on submission failure
});
```

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiUrl` | `string` | Required | Mentu proxy API endpoint. |
| `apiToken` | `string` | Required | Workspace API token. |
| `workspaceId` | `string` | Required | Workspace UUID. |
| `position` | `string` | `'bottom-right'` | Widget button position on screen. |
| `theme` | `string` | `'auto'` | Color theme. `'auto'` follows the system preference. |
| `branding.primaryColor` | `string` | `'#6366f1'` | Accent color for interactive elements. |
| `branding.logo` | `string` | Mentu logo | Logo image URL for the widget header. |
| `branding.title` | `string` | `'Report a Bug'` | Text displayed in the widget header. |
| `branding.placeholder` | `string` | `'Describe what went wrong...'` | Placeholder text for the description field. |
| `onOpen` | `function` | `undefined` | Callback when the widget opens. |
| `onClose` | `function` | `undefined` | Callback when the widget closes. |
| `onSubmit` | `function` | `undefined` | Callback after a successful report. Receives the created memory object. |
| `onError` | `function` | `undefined` | Callback on submission error. Receives the error object. |

### Programmatic Control

After initialization, you can control the widget programmatically:

```js
Mentu.open();    // Open the bug report form
Mentu.close();   // Close the form
Mentu.destroy(); // Remove the widget from the DOM entirely
```

## React Component

For React applications, use the `MentuBugReporter` component:

```tsx
import { MentuBugReporter } from 'mentu/react';

function App() {
  return (
    <>
      <YourApp />
      <MentuBugReporter
        apiUrl={import.meta.env.VITE_MENTU_API_URL}
        apiToken={import.meta.env.VITE_MENTU_API_TOKEN}
        workspaceId={import.meta.env.VITE_MENTU_WORKSPACE_ID}
        position="bottom-right"
        theme="auto"
        branding={{
          primaryColor: '#6366f1',
          title: 'Report a Bug',
        }}
        onSubmit={(memory) => {
          console.log('Bug reported:', memory.id);
        }}
      />
    </>
  );
}
```

The React component accepts all the same props as the vanilla JS configuration object.

### Controlled Mode

You can control the widget's open/closed state externally:

```tsx
import { MentuBugReporter } from 'mentu/react';
import { useState } from 'react';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Report Bug</button>
      <MentuBugReporter
        apiUrl={import.meta.env.VITE_MENTU_API_URL}
        apiToken={import.meta.env.VITE_MENTU_API_TOKEN}
        workspaceId={import.meta.env.VITE_MENTU_WORKSPACE_ID}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        showButton={false}  // Hide the default FAB
      />
    </>
  );
}
```

## What Gets Captured

When a user submits a bug report through the widget, the following data is collected and sent as a Mentu memory:

### User-Provided

| Field | Source | Description |
|---|---|---|
| Description | Text input | The user's description of the bug. |
| Severity | Dropdown | Optional severity selection (low, medium, high, critical). |

### Auto-Captured

| Field | Source | Description |
|---|---|---|
| Screenshot | `html2canvas` | A screenshot of the visible viewport at the time the widget was opened. |
| URL | `window.location.href` | The full URL including path, query params, and hash. |
| Console errors | `console.error` interceptor | The last 10 `console.error` calls captured before the report was opened. |
| Browser info | `navigator.userAgent` | Browser name, version, and platform. |
| Viewport | `window.innerWidth/Height` | Current viewport dimensions. |
| Timestamp | `Date.now()` | When the report was submitted. |

All auto-captured data is included in the memory's `meta` field and is used by the triage garbage filter to improve scoring and relevance.

### Screenshot Behavior

The widget uses `html2canvas` to capture a screenshot of the current page. A few notes:

- The screenshot is taken when the widget **opens**, not when the user clicks submit. This captures the state of the page at the moment the user noticed the bug.
- Cross-origin images and iframes may appear blank in the screenshot due to browser security restrictions.
- The screenshot is base64-encoded and included in the `meta.screenshot` field.
- If `html2canvas` fails (e.g., due to CSP restrictions), the report is still submitted without a screenshot.

## Customization

### Custom Fields

Add custom fields to the report form:

```js
Mentu.init({
  // ...credentials
  customFields: [
    {
      name: 'affected_feature',
      label: 'Affected Feature',
      type: 'select',
      options: ['Dashboard', 'Reports', 'Settings', 'Other'],
    },
    {
      name: 'frequency',
      label: 'How often does this happen?',
      type: 'select',
      options: ['Every time', 'Sometimes', 'Once'],
    },
  ],
});
```

Custom field values are included in the memory's `meta` object under the field name.

### Submission Hooks

Use the `onBeforeSubmit` hook to enrich reports with additional context before they are sent:

```js
Mentu.init({
  // ...credentials
  onBeforeSubmit: (report) => {
    // Add current user info
    report.meta.userId = getCurrentUser().id;
    report.meta.userRole = getCurrentUser().role;
    report.meta.sessionId = getSessionId();

    // Add app-specific context
    report.meta.featureFlags = getActiveFeatureFlags();
    report.meta.appVersion = __APP_VERSION__;

    return report; // Return the modified report
  },
});
```

If `onBeforeSubmit` returns `null` or `undefined`, the submission is cancelled.

### Styling

The widget is rendered in a Shadow DOM to prevent style conflicts with your application. To customize its appearance beyond the `branding` options, you can inject CSS into the shadow root:

```js
Mentu.init({
  // ...credentials
  injectCSS: `
    .mentu-widget-button {
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .mentu-widget-panel {
      max-width: 420px;
    }
  `,
});
```
