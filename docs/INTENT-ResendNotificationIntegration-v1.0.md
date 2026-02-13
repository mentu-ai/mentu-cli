---
# ============================================================
# CANONICAL YAML FRONT MATTER
# ============================================================
id: INTENT-ResendNotificationIntegration-v1.0
path: docs/INTENT-ResendNotificationIntegration-v1.0.md
type: intent
intent: reference
version: "1.0"
created: 2026-01-15
last_updated: 2026-01-15

architect:
  actor: agent:claude-architect
  session: inline-substitute-bug-reporter-ux
  context: Bug reporter thank you page enhancement - user subscription for updates

tier_hint: T2

mentu:
  commitment: pending
  status: awaiting_audit

# Related documents
related:
  - INTENT-BugReporterIntegration-v1.0
  - src/server/routes/bug-callback.ts
---

# Strategic Intent: Resend Email Notification for Bug Report Closure

> **Mode**: Architect
>
> You lack local filesystem access. Produce strategic intent only.
> State what and why. Do not specify file paths, schemas, or code.
> A local Leading Agent will audit and implement.

---

## What

Build a Resend email notification system that:

1. **Allows subscribers** - When submitting a bug report, users can opt-in to receive email updates
2. **Stores subscriptions** - Subscriber email addresses are securely stored with the ticket/memory
3. **Sends on closure** - When a Mentu commitment is marked complete (evidence closed), Resend sends an email
4. **Email content includes**:
   - Original issue description the user submitted
   - Notification that their report has been resolved
   - The Evidence ID / Commitment ID for reference
   - A note that if they notice something wrong, they can submit a new ticket and reference this memory ID

---

## Why

The Bug Reporter now has an improved "Thank You" page that shows:
- Mentu Evidence ID
- Summary of what was submitted
- Beautiful animations

But there's no way for users to know when their bug has been addressed. Without notifications:
- Users must manually check status (poor UX)
- No feedback loop when engineering fixes the issue
- Users don't feel heard or valued

With Resend notifications:
- Users get closure when their bug is fixed
- Builds trust in the bug reporting system
- Creates accountability evidence (email sent = proof of notification)
- Users can reference their evidence ID in future reports

---

## Constraints

- **Resend is the email provider** - Already used in WarrantyOS for transactional emails
- **Privacy-first** - Email addresses stored securely, used only for this notification
- **Opt-in only** - Users explicitly check a box to subscribe
- **Extends existing callback** - Uses the bug-callback infrastructure, adds email delivery channel
- **Single notification** - One email on closure, no spam

---

## Expected Outcome

### For Bug Reporter UI (WarrantyOS)

A checkbox appears on the bug report form:
```
[ ] Notify me when this is resolved
    Email: [_________________]
```

If checked, the email is included in the ticket payload.

### For Mentu Callback System

When a commitment with a subscriber email closes:

1. Existing callback fires (as it does today)
2. **New**: If `subscriber_email` exists in payload, Resend email is sent
3. Email is sent via Supabase Edge Function calling Resend API

### Email Content

Subject: `Your bug report has been resolved - #{evidence_id}`

Body:
```
Your bug report has been resolved!

Reference ID: {evidence_id}

Original Report:
"{original_description}"

Status: Resolved

---

If you notice the issue persists or something new is wrong,
please submit a new report and reference this Evidence ID: {evidence_id}

Thank you for helping us improve.

— The WarrantyOS Team
```

### For Ledger Integrity

The subscriber email is stored in the memory payload:
```json
{
  "kind": "bug_report",
  "source": "bug_reporter",
  "body": "User's description...",
  "subscriber_email": "user@example.com",
  "notify_on_close": true
}
```

On closure, an annotation records the notification:
```
"Email notification sent to user@example.com for closure of cmt_xxx"
```

---

## Open Questions

1. **Unsubscribe link?** - Should the email include an unsubscribe link, or is one-time notification sufficient?
2. **Multiple emails per ticket?** - If a ticket is reopened and closed again, send another email?
3. **Email validation** - Validate email format before storing? Send verification email?
4. **Rate limiting** - Prevent abuse of email sending?

---

## Context

### Existing Infrastructure

| Component | Status | Purpose |
|-----------|--------|---------|
| `bug-callback.ts` | ✅ Implemented | Delivers completion notifications via webhook |
| Resend in WarrantyOS | ✅ Implemented | Used for quote notifications, platform emails |
| Ticket payload storage | ✅ Exists | Can store subscriber_email in payload |

### What This Intent Adds

| Component | New | Purpose |
|-----------|-----|---------|
| Subscriber checkbox | ✅ | UI opt-in for email notifications |
| Email storage | ✅ | Secure storage of subscriber email in payload |
| Resend integration | ✅ | Email delivery via Resend API |
| Closure notification | ✅ | Triggered when commitment closes |
| Audit annotation | ✅ | Records that notification was sent |

### Integration Points

| System | Integration |
|--------|-------------|
| Bug Reporter UI | Add checkbox + email field |
| bugReporterStore | Store subscriber email in payload |
| bugReporterService | Send email with ticket submission |
| bug-callback.ts | Check for subscriber, call Resend |
| Supabase Edge Function | `send-closure-notification/index.ts` |

---

## Routing Hints

```yaml
priority: medium

tags:
  - notifications
  - resend
  - bug-reporter
  - email

target_repo: mentu-ai  # Primary integration in bug-callback

related_repos:
  - vin-to-value-main  # Bug reporter UI updates

ci_integration:
  github_actions: false
  auto_pr: false
```

---

## For the Leading Agent

When you receive this INTENT document:

1. **Establish checkpoint** (git + Mentu)
2. **Audit** using `/craft--architect` protocol
3. **Capture evidence** of your audit findings
4. **Decide**: APPROVE / REJECT / REQUEST_CLARIFICATION
5. **If approved**: Execute `/craft ResendNotificationIntegration-v1.0` to create full chain

### Implementation Locations

| Task | Location |
|------|----------|
| Add subscriber checkbox | `vin-to-value-main/src/features/bug-reporter/components/BugReporterModal.tsx` |
| Update ticket payload | `vin-to-value-main/src/features/bug-reporter/services/bugReporterService.ts` |
| Send Resend email | `mentu-ai/src/server/routes/bug-callback.ts` OR new Edge Function |
| Email template | Resend transactional email template |

---

## Visual Reference

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  RESEND NOTIFICATION FLOW                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  BUG REPORTER                      MENTU                       USER INBOX        │
│  ────────────                      ─────                       ──────────        │
│                                                                                  │
│  ┌──────────────┐                                                                │
│  │ Bug Form     │                                                                │
│  │              │                                                                │
│  │ Description: │                                                                │
│  │ [__________] │                                                                │
│  │              │                                                                │
│  │ [✓] Notify   │                   ┌──────────────┐                             │
│  │     me when  │─── POST ─────────▶│ Create Ticket│                             │
│  │     resolved │                   │ + Memory     │                             │
│  │              │                   │ + subscriber │                             │
│  │ Email:       │                   │   _email     │                             │
│  │ [user@...]   │                   └──────┬───────┘                             │
│  │              │                          │                                     │
│  │ [Submit]     │                          │                                     │
│  └──────────────┘                          │                                     │
│                                            │                                     │
│  ┌──────────────┐                   ┌──────▼───────┐                             │
│  │ Thank You!   │                   │   Workflow   │                             │
│  │              │                   │   Processes  │                             │
│  │ Evidence ID: │                   │   Bug...     │                             │
│  │ evd_abc123   │                   │              │                             │
│  │              │                   └──────┬───────┘                             │
│  │ "We'll email │                          │                                     │
│  │  you when    │                          │ commitment.close()                  │
│  │  resolved!"  │                          │                                     │
│  └──────────────┘                   ┌──────▼───────┐           ┌──────────────┐  │
│                                     │ bug-callback │───────────▶│ 📧 Email    │  │
│                                     │              │  Resend   │              │  │
│                                     │ if email:    │           │ "Your bug   │  │
│                                     │   send_email │           │  report is  │  │
│                                     │              │           │  resolved!" │  │
│                                     └──────────────┘           └──────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

*This intent was created by an Architect agent. It represents strategic direction, not implementation specification.*
