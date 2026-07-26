# API Route Scaffolder Skill

Load this skill when creating or modifying a Next.js route handler (`app/api/**/route.ts`) or a server action. It tells you the exact shape every route should have in SellSnap, so routes behave consistently whether they handle a login, an order creation, or a webhook.

## Before You Start

Read `.agent/rules/architecture.md` and `.agent/rules/security.md`. This skill assumes you know the difference between a server action and a route handler, and it assumes you will validate input and handle errors the way those rules describe.

Ask: should this be a server action or a route handler?
- **Server action** if the caller is our own dashboard UI and the action is a form submit or a UI-triggered mutation.
- **Route handler** if the caller is a public client (the product page), a third party (Flutterwave webhook), or another service.

Server actions are the default for internal writes. Route handlers are for external boundaries.

## Route Handler Template

```ts
// app/api/<resource>/<action>/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

const inputSchema = z.object({
  // Describe every field you expect from the client.
});

type Success<T> = { ok: true; data: T };
type Failure = { ok: false; error: { code: string; message: string } };

export async function POST(req: NextRequest) {
  try {
    // 1. Parse and validate.
    const body = await req.json().catch(() => null);
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<Failure>(
        { ok: false, error: { code: 'invalid_input', message: 'Check your input and try again.' } },
        { status: 400 }
      );
    }

    // 2. Authenticate if the route requires it.
    //    For public endpoints, apply rate limiting.
    const session = await getSession();
    if (!session) {
      return NextResponse.json<Failure>(
        { ok: false, error: { code: 'unauthorized', message: 'Please sign in.' } },
        { status: 401 }
      );
    }

    // 3. Authorize: does this user own the resource they are trying to touch?
    //    Example: ensuring user owns the product before allowing edit
    const product = await db.product.findUnique({ where: { id: parsed.data.id } });
    if (!product || product.userId !== session.userId) {
      return NextResponse.json<Failure>(
        { ok: false, error: { code: 'forbidden', message: 'You do not have permission.' } },
        { status: 403 }
      );
    }

    // 4. Do the work. Keep this block small; extract to lib/ if it gets long.
    const result = await /* ... */;

    // 5. Return a structured success response.
    return NextResponse.json<Success<typeof result>>({ ok: true, data: result });
  } catch (error) {
    logger.error('api.<resource>.<action>.failed', { error });
    return NextResponse.json<Failure>(
      { ok: false, error: { code: 'server_error', message: 'Something went wrong. Please try again.' } },
      { status: 500 }
    );
  }
}
```

## The Rules

**Always validate with zod.** The request body, query params, and path params all come from outside and cannot be trusted. Even if TypeScript thinks it knows the shape, zod is what actually enforces it at runtime.

**Always authenticate before authorizing.** Check the session exists, then check the session has permission to do the thing. Authorization is always per-resource. "Can this user edit this product?" means checking `product.userId === session.userId`, not just "is this user signed in?"

**Always return a consistent envelope.** Success is `{ ok: true, data }`. Failure is `{ ok: false, error: { code, message } }`. The client parses the same shape everywhere, which keeps error handling simple.

**Never return raw error messages.** Log the real error on the server, return a sanitized message to the client. A Prisma error message might reveal the database schema or the structure of your query. A stack trace is even worse.

**Use proper HTTP status codes.**
- `200` for success.
- `201` for resource creation if you want to be precise.
- `400` for validation errors (client sent garbage).
- `401` for unauthenticated (no session).
- `403` for unauthorized (session exists but lacks permission).
- `404` for resource not found.
- `409` for conflicts (duplicate slug, duplicate order).
- `429` for rate limit hits.
- `500` for server errors.

**Rate limit public endpoints.** Anything reachable without a session must have a rate limit. Use `lib/rate-limit.ts`. Lean on it for login, signup, password reset, and order creation on the public product page.

**Log structured data, not strings.** `logger.info('order.created', { orderId, productId })` beats `logger.info('Created order 123 for product 456')`. Structured logs can be queried; strings can only be grep'd.

## Server Action Template

```ts
// app/(dashboard)/<area>/actions.ts

'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

const inputSchema = z.object({
  // ...
});

type ActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: { code: string; message: string } };

export async function createSomething(formData: FormData): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { ok: false, error: { code: 'unauthorized', message: 'Please sign in.' } };
    }

    // Handle formData properly: convert to plain object, then parse with zod
    const rawData: Record<string, string | string[]> = {};
    for (const [key, value] of formData.entries()) {
      if (rawData[key]) {
        // Handle multiple values (checkboxes, multi-selects) - append to array
        const existing = rawData[key];
        rawData[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        rawData[key] = value;
      }
    }

    const parsed = inputSchema.safeParse(rawData);
    if (!parsed.success) {
      return { ok: false, error: { code: 'invalid_input', message: 'Please check your entries.' } };
    }

    const created = await db.something.create({
      data: { ...parsed.data, userId: session.userId },
    });

    revalidateTag('somethings');
    return { ok: true, data: created };
  } catch (error) {
    logger.error('action.create_something.failed', { error });
    return { ok: false, error: { code: 'server_error', message: 'Something went wrong.' } };
  }
}
```

Server actions that redirect on success do so at the end with `redirect(...)`. Actions that return data let the caller handle the response.

When mutating data, use the right revalidation strategy:
- `revalidateTag('resource')` — when caching by tag (preferred for list views)
- `revalidatePath('/dashboard/products')` — when invalidating a specific URL path

## Idempotency

Any route that creates something paid for must be idempotent. See `skills/flutterwave-integration/SKILL.md` for the pattern using unique constraints. Do not try to implement idempotency with application-level locking; the database is the source of truth.

## Request IDs

Every log line should include a request ID so you can trace a single request through the logs. The `logger` helper in `lib/logger.ts` adds this automatically when called from a route context.

## Common Mistakes

- Skipping zod validation and trusting TypeScript. TypeScript does not run at runtime.
- Authenticating but forgetting to authorize. Any signed-in user could edit anyone else's product if you skip the ownership check.
- Using a `GET` for a mutation. Stick to REST conventions: `POST` creates, `PATCH` updates, `DELETE` deletes, `GET` reads.
- Returning raw Prisma errors or exception messages.
- Forgetting to `revalidateTag` or `revalidatePath` after a server action mutates data. The cache will serve stale data until you do.
- Putting business logic inline in the route handler. If it is more than a few lines, move it to `lib/`.
- Not implementing pagination for list endpoints. Use `take`, `skip` with cursor-based pagination for large datasets.
