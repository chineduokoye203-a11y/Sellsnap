---
trigger: always_on
---

# Architecture Rules

These rules describe how SellSnap is put together. Every agent building features must follow this architecture. Do not introduce new patterns without discussing them with the developer first.

## The Stack

SellSnap is a Next.js application using the App Router, written in TypeScript, backed by PostgreSQL through Prisma. Payments run through Flutterwave. Styling is handled through CSS Modules with design tokens. There is no separate backend service. Everything lives in the Next.js app, using server components, server actions, and route handlers.

## Directory Layout

```
app/
├── (marketing)/               public landing pages, logged-out experience
├── (dashboard)/               authenticated seller dashboard, grouped by layout
│   ├── products/
│   ├── orders/
│   └── settings/
├── p/[slug]/                  public product page - the shareable link target
├── api/
│   ├── auth/                  login, signup, logout route handlers
│   ├── products/              product CRUD
│   ├── orders/                order creation and status
│   └── webhooks/
│       └── flutterwave/       Flutterwave webhook receiver
└── layout.tsx                 root layout

components/
├── ui/                        primitive components (Button, Input, Card, etc.)
├── product/                   product-specific components
├── dashboard/                 dashboard-specific components
└── shared/                    shared across the app

lib/
├── db.ts                      Prisma client singleton
├── auth.ts                    session and auth helpers
├── flutterwave.ts             Flutterwave SDK wrapper
├── slug.ts                    unique slug generation
└── validators/                zod schemas for input validation

prisma/
├── schema.prisma              database models - source of truth for all data types
└── migrations/              generated migration files

tokens/
├── tokens.css                CSS custom properties - source of truth for all design tokens
├── design-tokens.tokens.json
└── color-tokens.json

public/                        static assets
```

## Rendering Rules

Product pages at `/p/[slug]` must be server-rendered. They are the single most important page in the product because they are what buyers land on from WhatsApp. They must load fast, work without JavaScript enabled, and produce good Open Graph previews.

The seller dashboard can use client components where interactivity is needed, but data fetching happens on the server. Do not fetch from API routes inside client components when a server component can pass the data down directly.

## Data Flow

There are three kinds of writes in this app:

1. **User-initiated writes from the dashboard** go through server actions. Form submits call a server action, the action validates input with zod, writes to the database through Prisma, and revalidates the relevant cache tags.

2. **Public-facing writes from the checkout** go through route handlers under `app/api/`. The product page is public, so when a buyer hits "Pay Now," the client calls a route handler which creates a pending order and returns a Flutterwave payment link.

3. **Payment confirmations** come in through the Flutterwave webhook at `app/api/webhooks/flutterwave/route.ts`. This is the only place that marks an order as paid. The success redirect in the browser is not trusted.

## State Management

There is no global state library. React state and server data are enough. If you feel the urge to add Redux, Zustand, or Jotai, stop and reconsider. The dashboard is simple enough that `useState` and server actions cover every case.

## Database Access

All database access goes through Prisma. Raw SQL is only allowed in migration files. Every query that takes user input must use Prisma's parameterized query builder, never string interpolation.

The Prisma client is imported from `lib/db.ts`, which exports a singleton. Do not instantiate `new PrismaClient()` anywhere else; creating multiple clients exhausts the connection pool in development.

## Authentication

Sessions are cookie-based. Cookies are `httpOnly`, `secure` in production, and `sameSite: lax`. The session helper in `lib/auth.ts` exposes `getSession()` for server components and server actions. Client components that need auth state receive it as a prop from their parent server component.

## Error Handling

Server actions and route handlers return structured responses. Success is `{ ok: true, data }` and failure is `{ ok: false, error: { code, message } }`. The client never receives raw exception messages, stack traces, or Prisma error objects. Log the full error on the server, return a sanitized message to the user.

## Environments

- `development` runs locally against a local PostgreSQL and Flutterwave test keys.
- `production` runs on the deployment target with production Flutterwave keys and the production database.

There is no staging environment yet. When we add one, it will use Flutterwave test keys against a separate production-shaped database.

## Design Tokens

All styling uses CSS custom properties from `tokens/tokens.css`. Never hardcode color, font, or spacing values. See `desin-system.md` for the complete design system rules.

## Environment Variables

Required variables (see `security.md` for the full list):
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `NEXT_PUBLIC_APP_URL` - Public URL for the app
- `FLUTTERWAVE_PUBLIC_KEY` - Flutterwave public key
- `FLUTTERWAVE_SECRET_KEY` - Flutterwave secret key
- `FLUTTERWAVE_SECRET_HASH` - Webhook verification hash
- `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET` - Object storage

Never commit secrets. Validate on startup with `lib/env.ts`.

## What Not to Do

- Do not add GraphQL. REST route handlers and server actions are enough.
- Do not add a separate Node or Express backend. Everything stays in Next.js.
- Do not reach for microservices. This is one app.
- Do not build a custom auth system from scratch if a standard library fits. Check with the developer before introducing auth libraries.
- Do not store uploaded product images on the filesystem. Use the configured storage provider (set up in `lib/storage.ts`). The filesystem is ephemeral on most deployment targets.
- Do not use Tailwind CSS. Use CSS Modules with design tokens (see `desin-system.md`).

## Related Rules

- `security.md` - Security requirements and payment handling
- `code-style.md` - Code style and naming conventions
- `desin-system.md` - Design tokens, component styling, and mobile-first rules
- `AGENTS.md` - Product context and core features