# PRD: Universal Ticket Layer ↔ Airtable Two-Way Sync

> **Version**: 1.0
> **Status**: Draft
> **Created**: 2024-12-19
> **Author**: Claude Code

---

## Executive Summary

Enable bidirectional synchronization between the Universal Ticket Layer (Supabase) and Airtable, allowing teams to manage tickets in either system while maintaining a single source of truth. This integration leverages the Airtable MCP for real-time operations and Supabase webhooks for event-driven sync.

---

## Configuration

### Airtable Credentials

| Property | Value |
|----------|-------|
| Base URL | https://airtable.com/apppH8Loitcb1dwpJ/tblQcExUHhBTbOJX7/viwmReIzbf6Tly57N |
| Base ID | `apppH8Loitcb1dwpJ` |
| Table ID | `tblQcExUHhBTbOJX7` |
| View ID | `viwmReIzbf6Tly57N` |
| Base Name | universal-ticket-layer |
| API Token | `<AIRTABLE_PAT>.c1ae34300ff572e29e2276d9aa24b1153202c208cc024e95bb5ba9b58efaac83` |

### Airtable MCP

| Property | Value |
|----------|-------|
| Location | `/Users/rashid/Desktop/airtable-mcp-main` |
| Version | 3.2.6 |
| Protocol | MCP 2024-11-05 |

### Claude Desktop MCP Configuration

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/Users/rashid/Desktop/airtable-mcp-main/dist/index.js"],
      "env": {
        "AIRTABLE_TOKEN": "<AIRTABLE_PAT>.c1ae34300ff572e29e2276d9aa24b1153202c208cc024e95bb5ba9b58efaac83",
        "AIRTABLE_BASE_ID": "apppH8Loitcb1dwpJ"
      }
    }
  }
}
```

---

## Problem Statement

Currently, tickets exist only in Supabase and sync to GitHub Issues. However:

1. **Non-technical stakeholders** prefer Airtable's familiar spreadsheet interface
2. **Project managers** want Airtable's views, filters, and reporting
3. **Cross-team visibility** requires tickets accessible outside the developer ecosystem
4. **Automation workflows** in Airtable (Automations, Zapier) should trigger on ticket changes

---

## Goals

| Goal | Metric |
|------|--------|
| Real-time sync | < 5 second latency for changes |
| Conflict resolution | Zero data loss during concurrent edits |
| Schema parity | 100% field mapping between systems |
| Operational visibility | Full audit trail in both systems |

---

## Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TWO-WAY SYNC ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                           ┌──────────────────┐        │
│  │    SUPABASE      │                           │    AIRTABLE      │        │
│  │  (Source of      │                           │  (User-friendly  │        │
│  │   Truth)         │                           │   Interface)     │        │
│  ├──────────────────┤                           ├──────────────────┤        │
│  │                  │                           │                  │        │
│  │  tickets table   │◄─────── SYNC ───────────►│  Tickets table   │        │
│  │                  │                           │                  │        │
│  │  • id            │         ┌───────┐         │  • Record ID     │        │
│  │  • source        │◄───────►│ Edge  │◄───────►│  • Source        │        │
│  │  • type          │         │ Func  │         │  • Type          │        │
│  │  • title         │         └───────┘         │  • Title         │        │
│  │  • description   │              │            │  • Description   │        │
│  │  • priority      │              │            │  • Priority      │        │
│  │  • status        │              ▼            │  • Status        │        │
│  │  • external_refs │         Conflict         │  • GitHub Link   │        │
│  │  • created_at    │         Resolution       │  • Created       │        │
│  │  • updated_at    │                           │  • Modified      │        │
│  │                  │                           │                  │        │
│  └──────────────────┘                           └──────────────────┘        │
│           │                                              │                  │
│           ▼                                              ▼                  │
│  ┌──────────────────┐                           ┌──────────────────┐        │
│  │  Database        │                           │  Airtable        │        │
│  │  Webhook         │                           │  Webhook         │        │
│  │  (on INSERT/     │                           │  (on record      │        │
│  │   UPDATE)        │                           │   change)        │        │
│  └────────┬─────────┘                           └────────┬─────────┘        │
│           │                                              │                  │
│           ▼                                              ▼                  │
│  ┌──────────────────┐                           ┌──────────────────┐        │
│  │ sync-to-airtable │                           │ airtable-webhook │        │
│  │ Edge Function    │                           │ Edge Function    │        │
│  └──────────────────┘                           └──────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sync Direction Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                      SYNC DECISION TREE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  New Ticket Created in Supabase?                                 │
│  └── YES → Create record in Airtable                            │
│       └── Store Airtable Record ID in external_refs             │
│                                                                  │
│  New Record Created in Airtable?                                 │
│  └── YES → Create ticket in Supabase                            │
│       └── Set source = 'airtable'                               │
│       └── Store Supabase ID in Airtable field                   │
│                                                                  │
│  Ticket Updated in Supabase?                                     │
│  └── Has Airtable ref? → Update Airtable record                 │
│  └── No ref? → Create in Airtable (late sync)                   │
│                                                                  │
│  Record Updated in Airtable?                                     │
│  └── Has Supabase ID? → Update Supabase ticket                  │
│  └── No ID? → Create in Supabase (late sync)                    │
│                                                                  │
│  CONFLICT (both updated within 5s)?                              │
│  └── Supabase wins (source of truth)                            │
│  └── Log conflict for review                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schema Mapping

### Field Mapping: Supabase → Airtable

| Supabase Field | Type | Airtable Field | Type | Notes |
|----------------|------|----------------|------|-------|
| `id` | UUID | `Supabase ID` | Single line text | Primary link key |
| `source` | TEXT | `Source` | Single select | bug_reporter, email, slack, api, airtable |
| `type` | TEXT | `Type` | Single select | bug, feature, support, task, question |
| `title` | TEXT | `Title` | Single line text | Primary field |
| `description` | TEXT | `Description` | Long text | Rich text enabled |
| `priority` | TEXT | `Priority` | Single select | low, medium, high, critical |
| `status` | TEXT | `Status` | Single select | submitted, triaged, in_progress, resolved, closed, wont_fix |
| `assignee_id` | UUID | `Assignee` | Collaborator | Maps to Airtable user |
| `page_url` | TEXT | `Page URL` | URL | Where bug was reported |
| `environment` | JSONB | `Environment` | Long text | JSON string |
| `payload` | JSONB | `Payload` | Long text | JSON string |
| `external_refs[github]` | JSONB | `GitHub Issue` | URL | Extracted from refs |
| `created_at` | TIMESTAMP | `Created` | Created time | Auto-populated |
| `updated_at` | TIMESTAMP | `Modified` | Last modified | Auto-populated |
| — | — | `Airtable Record ID` | Formula | RECORD_ID() |

### Airtable Table Schema

```javascript
// Create via Airtable MCP: create_table tool
{
  "name": "Tickets",
  "description": "Universal Ticket Layer - Synced from Supabase",
  "fields": [
    {
      "name": "Title",
      "type": "singleLineText",
      "description": "Ticket title"
    },
    {
      "name": "Description",
      "type": "multilineText",
      "description": "Full ticket description"
    },
    {
      "name": "Type",
      "type": "singleSelect",
      "options": {
        "choices": [
          { "name": "bug", "color": "redLight2" },
          { "name": "feature", "color": "greenLight2" },
          { "name": "support", "color": "blueLight2" },
          { "name": "task", "color": "yellowLight2" },
          { "name": "question", "color": "purpleLight2" }
        ]
      }
    },
    {
      "name": "Priority",
      "type": "singleSelect",
      "options": {
        "choices": [
          { "name": "critical", "color": "redDark1" },
          { "name": "high", "color": "orangeDark1" },
          { "name": "medium", "color": "yellowDark1" },
          { "name": "low", "color": "grayLight2" }
        ]
      }
    },
    {
      "name": "Status",
      "type": "singleSelect",
      "options": {
        "choices": [
          { "name": "submitted", "color": "grayLight2" },
          { "name": "triaged", "color": "blueLight2" },
          { "name": "in_progress", "color": "yellowLight2" },
          { "name": "resolved", "color": "greenLight2" },
          { "name": "closed", "color": "grayDark1" },
          { "name": "wont_fix", "color": "redLight2" }
        ]
      }
    },
    {
      "name": "Source",
      "type": "singleSelect",
      "options": {
        "choices": [
          { "name": "bug_reporter", "color": "purpleLight2" },
          { "name": "email", "color": "blueLight2" },
          { "name": "slack", "color": "pinkLight2" },
          { "name": "api", "color": "cyanLight2" },
          { "name": "airtable", "color": "orangeLight2" },
          { "name": "manual", "color": "grayLight2" }
        ]
      }
    },
    {
      "name": "Supabase ID",
      "type": "singleLineText",
      "description": "UUID from Supabase tickets table"
    },
    {
      "name": "GitHub Issue",
      "type": "url",
      "description": "Link to GitHub issue"
    },
    {
      "name": "Page URL",
      "type": "url",
      "description": "URL where bug was reported"
    },
    {
      "name": "Environment",
      "type": "multilineText",
      "description": "Browser/OS environment JSON"
    },
    {
      "name": "Payload",
      "type": "multilineText",
      "description": "Additional diagnostic data JSON"
    }
  ]
}
```

---

## Implementation

### Phase 1: Supabase → Airtable (One-way)

#### 1.1 Create Edge Function: `sync-to-airtable`

```typescript
// supabase/functions/sync-to-airtable/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const AIRTABLE_TOKEN = Deno.env.get("AIRTABLE_TOKEN");
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID");
const AIRTABLE_TABLE_NAME = "Tickets";

interface TicketPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    source: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    page_url?: string;
    environment?: object;
    payload?: object;
    external_refs?: Array<{ system: string; url: string }>;
    created_at: string;
    updated_at: string;
  };
  old_record?: object;
}

Deno.serve(async (req: Request) => {
  try {
    const payload: TicketPayload = await req.json();
    const { type, record } = payload;

    // Extract GitHub URL from external_refs
    const githubRef = record.external_refs?.find(r => r.system === "github");
    const githubUrl = githubRef?.url || null;

    // Check if record already has Airtable ref
    const airtableRef = record.external_refs?.find(r => r.system === "airtable");

    if (type === "INSERT" || (type === "UPDATE" && !airtableRef)) {
      // Create new record in Airtable
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              Title: record.title || `[${record.type}] ${record.id.slice(0, 8)}`,
              Description: record.description,
              Type: record.type,
              Priority: record.priority || "medium",
              Status: record.status || "submitted",
              Source: record.source,
              "Supabase ID": record.id,
              "GitHub Issue": githubUrl,
              "Page URL": record.page_url,
              Environment: record.environment ? JSON.stringify(record.environment, null, 2) : null,
              Payload: record.payload ? JSON.stringify(record.payload, null, 2) : null,
            },
          }),
        }
      );

      const airtableRecord = await response.json();

      // Update Supabase with Airtable ref
      if (airtableRecord.id) {
        // Store Airtable Record ID back in Supabase external_refs
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const newRef = {
          system: "airtable",
          id: airtableRecord.id,
          url: `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${airtableRecord.id}`,
          synced_at: new Date().toISOString(),
        };

        const existingRefs = record.external_refs || [];
        await supabase
          .from("tickets")
          .update({ external_refs: [...existingRefs, newRef] })
          .eq("id", record.id);
      }

      return new Response(JSON.stringify({ success: true, airtable_id: airtableRecord.id }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (type === "UPDATE" && airtableRef) {
      // Update existing Airtable record
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${airtableRef.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              Title: record.title,
              Description: record.description,
              Type: record.type,
              Priority: record.priority,
              Status: record.status,
              "GitHub Issue": githubUrl,
            },
          }),
        }
      );

      return new Response(JSON.stringify({ success: true, updated: airtableRef.id }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (type === "DELETE" && airtableRef) {
      // Delete from Airtable
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${airtableRef.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          },
        }
      );

      return new Response(JSON.stringify({ success: true, deleted: airtableRef.id }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, action: "none" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

#### 1.2 Database Webhook Configuration

| Setting | Value |
|---------|-------|
| Name | `sync-to-airtable` |
| Table | `tickets` |
| Events | `INSERT`, `UPDATE`, `DELETE` |
| URL | `https://uhwiegwpaagzulolmruz.supabase.co/functions/v1/sync-to-airtable` |
| Headers | `Authorization: Bearer <service_role_key>` |

---

### Phase 2: Airtable → Supabase (Bi-directional)

#### 2.1 Create Edge Function: `airtable-webhook`

```typescript
// supabase/functions/airtable-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WEBHOOK_SECRET = Deno.env.get("AIRTABLE_WEBHOOK_SECRET");

interface AirtableWebhookPayload {
  base: { id: string };
  webhook: { id: string };
  timestamp: string;
  payloads: Array<{
    changedTablesById: {
      [tableId: string]: {
        createdRecordsById?: { [recordId: string]: { cellValuesByFieldId: object } };
        changedRecordsById?: { [recordId: string]: { current: { cellValuesByFieldId: object } } };
        destroyedRecordIds?: string[];
      };
    };
  }>;
}

Deno.serve(async (req: Request) => {
  // Verify webhook signature (Airtable uses HMAC-SHA256)
  const signature = req.headers.get("x-airtable-content-mac");
  // TODO: Implement signature verification

  const payload: AirtableWebhookPayload = await req.json();

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  for (const change of payload.payloads) {
    for (const [tableId, tableChanges] of Object.entries(change.changedTablesById)) {
      // Handle created records
      if (tableChanges.createdRecordsById) {
        for (const [recordId, recordData] of Object.entries(tableChanges.createdRecordsById)) {
          // Map Airtable fields to Supabase columns
          const fields = recordData.cellValuesByFieldId;

          // Check if this record was created from Supabase (has Supabase ID)
          const supabaseId = fields["Supabase ID"];
          if (supabaseId) {
            // This is a sync from Supabase, skip to avoid loop
            continue;
          }

          // Create new ticket in Supabase
          const { data, error } = await supabase.from("tickets").insert({
            source: "airtable",
            type: fields["Type"] || "task",
            title: fields["Title"] || "Untitled",
            description: fields["Description"] || "",
            priority: fields["Priority"] || "medium",
            status: fields["Status"] || "submitted",
            external_refs: [
              {
                system: "airtable",
                id: recordId,
                url: `https://airtable.com/${payload.base.id}/${tableId}/${recordId}`,
                synced_at: new Date().toISOString(),
              },
            ],
          }).select().single();

          if (data) {
            // Update Airtable record with Supabase ID
            await fetch(
              `https://api.airtable.com/v0/${payload.base.id}/${tableId}/${recordId}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${Deno.env.get("AIRTABLE_TOKEN")}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  fields: { "Supabase ID": data.id },
                }),
              }
            );
          }
        }
      }

      // Handle updated records
      if (tableChanges.changedRecordsById) {
        for (const [recordId, recordData] of Object.entries(tableChanges.changedRecordsById)) {
          const fields = recordData.current.cellValuesByFieldId;
          const supabaseId = fields["Supabase ID"];

          if (!supabaseId) continue;

          // Check for conflict (updated in last 5 seconds in Supabase)
          const { data: existing } = await supabase
            .from("tickets")
            .select("updated_at")
            .eq("id", supabaseId)
            .single();

          if (existing) {
            const timeDiff = Date.now() - new Date(existing.updated_at).getTime();
            if (timeDiff < 5000) {
              // Conflict detected - Supabase wins, log for review
              console.warn(`Conflict detected for ticket ${supabaseId}, Supabase wins`);
              continue;
            }
          }

          // Update Supabase ticket
          await supabase.from("tickets").update({
            title: fields["Title"],
            description: fields["Description"],
            type: fields["Type"],
            priority: fields["Priority"],
            status: fields["Status"],
          }).eq("id", supabaseId);
        }
      }

      // Handle deleted records
      if (tableChanges.destroyedRecordIds) {
        for (const recordId of tableChanges.destroyedRecordIds) {
          // Find and optionally delete the Supabase ticket
          // Or mark as deleted/closed based on business rules
          await supabase
            .from("tickets")
            .update({ status: "closed" })
            .contains("external_refs", [{ system: "airtable", id: recordId }]);
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

#### 2.2 Airtable Webhook Setup

Use the Airtable MCP to create a webhook:

```
Tool: create_webhook
Parameters:
  - notificationUrl: https://uhwiegwpaagzulolmruz.supabase.co/functions/v1/airtable-webhook
  - specification: {
      "options": {
        "filters": {
          "dataTypes": ["tableData"],
          "recordChangeScope": "tblQcExUHhBTbOJX7"
        }
      }
    }
```

---

### Phase 3: Initial Sync (Backfill)

#### 3.1 Sync Existing Supabase Tickets to Airtable

```typescript
// scripts/backfill-airtable.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function backfill() {
  // Get all tickets without Airtable refs
  const { data: tickets } = await supabase
    .from("tickets")
    .select("*")
    .not("external_refs", "cs", '[{"system":"airtable"}]');

  console.log(`Found ${tickets?.length || 0} tickets to sync`);

  // Batch create in Airtable (10 at a time)
  for (let i = 0; i < (tickets?.length || 0); i += 10) {
    const batch = tickets!.slice(i, i + 10);

    const records = batch.map(ticket => ({
      fields: {
        Title: ticket.title || `[${ticket.type}] ${ticket.id.slice(0, 8)}`,
        Description: ticket.description,
        Type: ticket.type,
        Priority: ticket.priority,
        Status: ticket.status,
        Source: ticket.source,
        "Supabase ID": ticket.id,
        "GitHub Issue": ticket.external_refs?.find((r: any) => r.system === "github")?.url,
      },
    }));

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Tickets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records }),
      }
    );

    const result = await response.json();

    // Update Supabase with Airtable refs
    for (let j = 0; j < result.records.length; j++) {
      const ticket = batch[j];
      const airtableRecord = result.records[j];

      const newRef = {
        system: "airtable",
        id: airtableRecord.id,
        url: `https://airtable.com/${AIRTABLE_BASE_ID}/Tickets/${airtableRecord.id}`,
        synced_at: new Date().toISOString(),
      };

      await supabase
        .from("tickets")
        .update({ external_refs: [...(ticket.external_refs || []), newRef] })
        .eq("id", ticket.id);
    }

    console.log(`Synced batch ${i / 10 + 1}`);
  }

  console.log("Backfill complete!");
}

backfill();
```

---

## Environment Variables

### Supabase Secrets (set via CLI)

```bash
supabase secrets set AIRTABLE_TOKEN=<AIRTABLE_PAT>.c1ae34300ff572e29e2276d9aa24b1153202c208cc024e95bb5ba9b58efaac83
supabase secrets set AIRTABLE_BASE_ID=apppH8Loitcb1dwpJ
supabase secrets set AIRTABLE_WEBHOOK_SECRET=<generated-secret>
```

---

## Testing Plan

### Test Cases

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | Create ticket via Bug Reporter | Appears in Airtable within 5s |
| 2 | Create record in Airtable | Appears in Supabase with source="airtable" |
| 3 | Update ticket status in Supabase | Airtable status updates |
| 4 | Update priority in Airtable | Supabase priority updates |
| 5 | Close GitHub issue | Status syncs to both systems |
| 6 | Delete record in Airtable | Ticket marked closed in Supabase |
| 7 | Concurrent edit (within 5s) | Supabase wins, conflict logged |

### Verification Commands

```bash
# Check Supabase tickets
curl 'https://uhwiegwpaagzulolmruz.supabase.co/functions/v1/tickets-api?limit=5' \
  -H 'x-api-key: YOUR_KEY'

# Check Airtable records via MCP
# Use: list_records tool with table="Tickets"
```

---

## Rollout Plan

| Phase | Duration | Scope |
|-------|----------|-------|
| Phase 1 | Week 1 | Supabase → Airtable (one-way) |
| Phase 2 | Week 2 | Add Airtable → Supabase webhook |
| Phase 3 | Week 3 | Backfill existing tickets |
| Phase 4 | Week 4 | Monitor, tune conflict resolution |

---

## Monitoring & Observability

### Metrics to Track

- Sync latency (target: < 5s)
- Sync failures (target: < 0.1%)
- Conflict rate (expect: < 1%)
- Records in sync (target: 100%)

### Alerting

- Slack notification on sync failure
- Daily sync health report
- Conflict log review (weekly)

---

## Future Enhancements

1. **Attachments sync** - Sync screenshots/videos to Airtable attachments
2. **Comments sync** - Bidirectional comment threading
3. **Custom fields** - Support for org-specific fields
4. **Filtered sync** - Only sync certain ticket types to Airtable
5. **Airtable Automations** - Trigger workflows on ticket changes

---

## Appendix: Airtable MCP Tools Reference

| Tool | Use Case |
|------|----------|
| `list_tables` | Verify Tickets table exists |
| `create_table` | Initial setup of Tickets table |
| `list_records` | Query synced tickets |
| `create_record` | Manual ticket creation |
| `update_record` | Status/priority updates |
| `batch_create_records` | Backfill operations |
| `batch_update_records` | Bulk status changes |
| `create_webhook` | Set up Airtable → Supabase sync |
| `list_webhooks` | Monitor webhook health |
| `get_webhook_payloads` | Debug sync issues |
