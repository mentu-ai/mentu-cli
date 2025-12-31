# @warrantyos/utl-sdk

TypeScript SDK for the Universal Ticket Layer (UTL) API.

## Installation

```bash
npm install @warrantyos/utl-sdk
# or
pnpm add @warrantyos/utl-sdk
# or
yarn add @warrantyos/utl-sdk
```

## Quick Start

```typescript
import { UTLClient } from '@warrantyos/utl-sdk';

const utl = new UTLClient({
  apiUrl: 'https://your-project.supabase.co/functions/v1',
  apiKey: 'your-api-key',
});

// Create a ticket
const ticket = await utl.tickets.create({
  source: 'api',
  type: 'bug',
  title: 'Login button not working',
  description: 'Users cannot click the login button on Safari',
  priority: 'high',
});

console.log(`Created ticket: ${ticket.id}`);
```

## API Reference

### UTLClient

```typescript
const utl = new UTLClient({
  apiUrl: string;       // Required: UTL API base URL
  apiKey: string;       // Required: API key for authentication
  timeout?: number;     // Optional: Request timeout in ms (default: 30000)
});
```

### Tickets

#### Create Ticket

```typescript
const ticket = await utl.tickets.create({
  source: 'api',                    // Required
  description: 'Issue description', // Required
  type: 'bug',                      // Optional (default: 'bug')
  title: 'Short summary',           // Optional
  priority: 'high',                 // Optional (default: 'medium')
  page_url: 'https://...',          // Optional
  environment: {...},               // Optional
  payload: {...},                   // Optional
});
```

#### List Tickets

```typescript
const { tickets, total, count } = await utl.tickets.list({
  type: 'bug',
  status: 'submitted',
  priority: 'high',
  limit: 10,
  offset: 0,
  order_by: 'created_at',
  order: 'desc',
  search: 'login',
});
```

#### Get Ticket

```typescript
const ticket = await utl.tickets.get('ticket-uuid');
```

#### Update Ticket

```typescript
const ticket = await utl.tickets.update('ticket-uuid', {
  status: 'in_progress',
  assigned_to: 'user-uuid',
});
```

#### Delete Ticket

```typescript
await utl.tickets.delete('ticket-uuid');
```

## Types

### TicketSource

```typescript
type TicketSource =
  | 'bug_reporter'
  | 'email'
  | 'slack'
  | 'api'
  | 'manual'
  | 'zapier'
  | 'webhook';
```

### TicketType

```typescript
type TicketType =
  | 'bug'
  | 'feature'
  | 'support'
  | 'task'
  | 'question';
```

### TicketPriority

```typescript
type TicketPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';
```

### TicketStatus

```typescript
type TicketStatus =
  | 'submitted'
  | 'triaged'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'wont_fix';
```

## Error Handling

```typescript
try {
  const ticket = await utl.tickets.create({...});
} catch (error) {
  if (error instanceof Error) {
    console.error('Failed to create ticket:', error.message);
  }
}
```

## License

MIT
