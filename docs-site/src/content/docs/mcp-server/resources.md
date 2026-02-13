---
title: "Resources Reference"
description: "Reference for the 5 MCP resources exposed by @mentu/mcp for reading commitments, memories, and pipeline status."
---

MCP resources are read-only data endpoints that your AI agent can access to understand the current state of the Mentu ledger. Unlike tools (which perform actions), resources provide data that agents can reference during their reasoning.

The `@mentu/mcp` server exposes 5 resources.

## mentu://commitments

**URI:** `mentu://commitments`

Returns all commitments in the workspace, ordered by creation time (newest first).

**What it returns:**

A list of all commitments with their current state, tags, timestamps, and source information. This is the full ledger view -- use it when your agent needs to survey all known work.

**Example usage:**

```json
{
  "method": "resources/read",
  "params": {
    "uri": "mentu://commitments"
  }
}
```

**Example response shape:**

```json
{
  "contents": [
    {
      "uri": "mentu://commitments",
      "mimeType": "application/json",
      "text": "[{\"id\":\"c_9f3a2b1e\",\"body\":\"Fix login redirect loop on mobile Safari\",\"state\":\"claimed\",\"source\":\"agent:claude\",\"tags\":[\"bug\",\"auth\"],\"created_at\":\"2025-06-15T10:30:00Z\",\"claimed_at\":\"2025-06-15T10:32:00Z\"},{\"id\":\"c_7d4e1a2f\",\"body\":\"Add dark mode to settings page\",\"state\":\"committed\",\"source\":\"human:rashid\",\"tags\":[\"feature\",\"ui\"],\"created_at\":\"2025-06-14T09:00:00Z\"}]"
    }
  ]
}
```

**Notes:**
- The response is JSON-encoded inside the `text` field, as per the MCP resource protocol.
- For large workspaces, prefer using the `mentu_list_commitments` tool with filters instead of reading the full resource.

---

## mentu://commitments/{id}

**URI:** `mentu://commitments/{id}` (e.g., `mentu://commitments/c_9f3a2b1e`)

Returns a single commitment with its full history -- every state transition, evidence attachment, and annotation.

**What it returns:**

The commitment object plus a `history` array containing every event in chronological order. This gives you the complete audit trail for a single piece of work.

**Example usage:**

```json
{
  "method": "resources/read",
  "params": {
    "uri": "mentu://commitments/c_9f3a2b1e"
  }
}
```

**Example response shape:**

```json
{
  "contents": [
    {
      "uri": "mentu://commitments/c_9f3a2b1e",
      "mimeType": "application/json",
      "text": "{\"id\":\"c_9f3a2b1e\",\"body\":\"Fix login redirect loop on mobile Safari\",\"state\":\"submitted\",\"source\":\"agent:claude\",\"tags\":[\"bug\",\"auth\"],\"created_at\":\"2025-06-15T10:30:00Z\",\"history\":[{\"op\":\"commit\",\"at\":\"2025-06-15T10:30:00Z\",\"by\":\"agent:claude\"},{\"op\":\"claim\",\"at\":\"2025-06-15T10:32:00Z\",\"by\":\"agent:claude\"},{\"op\":\"submit\",\"at\":\"2025-06-15T11:00:00Z\",\"by\":\"agent:claude\",\"evidence\":[{\"type\":\"build\",\"pass\":true},{\"type\":\"test\",\"pass\":true}]}],\"annotations\":[{\"id\":\"ann_x1y2z3\",\"body\":\"Also affects forgot-password flow\",\"kind\":\"note\"}]}"
    }
  ]
}
```

**Notes:**
- The `history` array is append-only and ordered chronologically -- it shows every state transition with who did it, when, and what evidence was attached.
- Annotations made via `mentu_annotate` appear in the `annotations` array.
- Use this resource when you need full context on a specific commitment before taking action.

---

## mentu://memories

**URI:** `mentu://memories`

Returns all memories in the workspace, including both active and dismissed ones.

**What it returns:**

A list of all captured memories with their kind, body, dismissal status, and creation timestamp.

**Example usage:**

```json
{
  "method": "resources/read",
  "params": {
    "uri": "mentu://memories"
  }
}
```

**Example response shape:**

```json
{
  "contents": [
    {
      "uri": "mentu://memories",
      "mimeType": "application/json",
      "text": "[{\"id\":\"m_a1b2c3d4\",\"body\":\"useClients hook does not sanitize search input before passing to .ilike()\",\"kind\":\"bug\",\"dismissed\":false,\"created_at\":\"2025-06-15T10:00:00Z\"},{\"id\":\"m_e5f6g7h8\",\"body\":\"Consider adding batch delete to GestionIngresos\",\"kind\":\"idea\",\"dismissed\":true,\"dismissed_at\":\"2025-06-15T12:00:00Z\",\"reason\":\"Out of scope for current sprint\",\"created_at\":\"2025-06-10T08:00:00Z\"}]"
    }
  ]
}
```

**Notes:**
- Both active and dismissed memories are included. Check the `dismissed` field to distinguish them.
- For filtered views, use the `mentu_list_memories` tool instead.

---

## mentu://memories/{id}

**URI:** `mentu://memories/{id}` (e.g., `mentu://memories/m_a1b2c3d4`)

Returns a single memory with its full detail, including all annotations.

**What it returns:**

The memory object with its body, kind, metadata, references, dismissal status, and all annotations attached to it.

**Example usage:**

```json
{
  "method": "resources/read",
  "params": {
    "uri": "mentu://memories/m_a1b2c3d4"
  }
}
```

**Example response shape:**

```json
{
  "contents": [
    {
      "uri": "mentu://memories/m_a1b2c3d4",
      "mimeType": "application/json",
      "text": "{\"id\":\"m_a1b2c3d4\",\"body\":\"useClients hook does not sanitize search input before passing to .ilike()\",\"kind\":\"bug\",\"refs\":[\"src/hooks/useClients.ts\"],\"meta\":{\"severity\":\"medium\",\"line\":47},\"dismissed\":false,\"created_at\":\"2025-06-15T10:00:00Z\",\"annotations\":[{\"id\":\"ann_p4q5r6\",\"body\":\"Same pattern exists in useProducts and useSuppliers\",\"kind\":\"note\",\"created_at\":\"2025-06-15T10:15:00Z\"}]}"
    }
  ]
}
```

**Notes:**
- Use this resource to get full context on a memory before deciding whether to commit to fixing it or dismiss it.
- The `refs` array contains file paths, URLs, or entity IDs that were provided when the memory was captured.
- Annotations provide additional context added after the initial capture.

---

## mentu://status

**URI:** `mentu://status`

Returns a high-level summary of pipeline health -- commitment counts by state, memory counts by kind, and the timestamp of the last activity.

**What it returns:**

An aggregate view of the workspace state. This is the same data returned by the `mentu_get_status` tool, exposed as a resource for agents that prefer to read resources rather than call tools.

**Example usage:**

```json
{
  "method": "resources/read",
  "params": {
    "uri": "mentu://status"
  }
}
```

**Example response shape:**

```json
{
  "contents": [
    {
      "uri": "mentu://status",
      "mimeType": "application/json",
      "text": "{\"commitments\":{\"committed\":3,\"claimed\":2,\"submitted\":1,\"approved\":12,\"closed\":5},\"memories\":{\"total\":47,\"undismissed\":8,\"by_kind\":{\"bug\":5,\"idea\":2,\"observation\":1}},\"last_activity\":\"2025-06-15T14:00:00Z\"}"
    }
  ]
}
```

**Notes:**
- This is the lightest-weight way to understand pipeline state -- one read gives you the full picture.
- Agents can read this resource at session start to decide what to work on.
- The `undismissed` count tells you how many memories still need triage.
