---
title: "Dashboard Setup"
description: "How to deploy and configure the Mentu web dashboard"
---

This guide walks you through setting up the Mentu dashboard from scratch — cloning the repo, configuring Supabase, and deploying to Vercel.

## Prerequisites

- A [Supabase](https://supabase.com) project (free tier works)
- A [Vercel](https://vercel.com) account
- Node.js 18+ and npm
- Git

## 1. Clone the Repository

```bash
git clone https://github.com/mentu-ai/mentu-web
cd mentu-web
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (found in Project Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key (found in Project Settings > API) |

## 4. Supabase Schema

The dashboard requires three core tables in your Supabase project. Apply the following schema (or run the provided migration):

### `operations` table

The append-only ledger. Every Mentu operation is stored here.

```sql
create table operations (
  id text primary key,
  op text not null,
  ts timestamptz not null default now(),
  actor text not null,
  workspace text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_operations_workspace on operations(workspace);
create index idx_operations_op on operations(op);
create index idx_operations_ts on operations(ts desc);
```

### `workspaces` table

Workspace registry for multi-tenant isolation.

```sql
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  settings jsonb not null default '{}'::jsonb
);
```

### `workspace_members` table

Maps users to workspaces with role-based access.

```sql
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);
```

### Enable Realtime

For live updates, enable Supabase Realtime on the `operations` table:

```sql
alter publication supabase_realtime add table operations;
```

## 5. Run Locally

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

## 6. Deploy to Vercel

### Via CLI

```bash
npx vercel --prod
```

When prompted, set the environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel dashboard under Project Settings > Environment Variables.

### Via Dashboard

1. Import the repository in the [Vercel Dashboard](https://vercel.com/new)
2. Set the environment variables in the project settings
3. Deploy

## 7. Custom Domain Setup

1. Go to your Vercel project Settings > Domains
2. Add your custom domain (e.g., `app.mentu.dev`)
3. Configure DNS:
   - **CNAME** record pointing to `cname.vercel-dns.com`
   - Or an **A** record pointing to Vercel's IP (`76.76.21.21`)
4. Wait for DNS propagation and SSL certificate provisioning (usually under 5 minutes)

## Verify

After deployment, visit your dashboard URL. You should see the login screen. Sign in with your Supabase credentials and verify that:

1. You can access your workspace
2. Operations appear in the Ledger view
3. Commitments and memories are populated (if any exist)
