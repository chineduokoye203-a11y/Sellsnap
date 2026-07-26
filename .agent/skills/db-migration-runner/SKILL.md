# Database Migration Runner Skill

Load this skill when changing the database schema, creating a new model, adding a column, adding an index, or backfilling data. Migrations are the scariest kind of change because they are the hardest to undo and they can take the app down if done wrong. Treat every schema change as a serious commit.

## The Stack

SellSnap uses PostgreSQL with Prisma. The schema lives at `prisma/schema.prisma`. Migrations live at `prisma/migrations/`. The Prisma client is regenerated on every migration and imported from `@/lib/db`.

## The Workflow

Schema changes always follow the same sequence:

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name <descriptive_name>` to generate a migration locally.
3. Run `npx prisma generate` to regenerate the client.
4. Read the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` end to end. Do not skip this. Prisma is usually right, but "usually" is not "always."
5. Run the app locally, hit the affected pages, and confirm nothing broke.
6. Commit the schema change and the migration file together.
7. Deploy. In CI or on the deployment target, `npx prisma migrate deploy` applies the migration to production.

Never edit a migration file that has already been applied anywhere. If you need to fix a mistake, write a new migration that corrects it.

## Naming

Migrations are named in snake_case, describing the change:
- `add_unique_slug_to_product`
- `add_payment_gateway_reference_index`
- `add_order_currency_column`

Good names make `git log` readable. Bad names like `update_schema` or `fix_stuff` are useless when you are reading history six months later.

## Common Schema Patterns

### Adding a nullable column (safe)

```prisma
model Product {
  // ...
  archivedAt DateTime?
}
```

Nullable columns are additive and safe. Existing rows just get `NULL`. No backfill needed.

### Adding a non-nullable column (careful)

You cannot add a `NOT NULL` column to a table with existing rows without a default or a backfill. Do it in two migrations:

1. Add the column as nullable.
2. Backfill existing rows in a data migration or application code.
3. In a second migration, set the column to `NOT NULL`.

On a fresh database this does not matter, but on production it does.

### Adding a unique constraint

Unique constraints are how we prevent things like duplicate product slugs and duplicate payment references. They are the safety net for idempotency.

```prisma
model Payment {
  // ...
  gatewayReference String @unique
}
```

Before adding a unique constraint to an existing column with data, make sure the existing data does not already contain duplicates. The migration will fail if it does.

### Adding an index

Add an index when a query gets slow. The signal is usually a specific query in logs taking longer as the table grows. Do not speculatively index every column; each index costs write performance.

```prisma
model Order {
  // ...
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([userId, createdAt])
}
```

### Renaming a column

**Option 1: Using `@map`** (preferred for new columns)

If you want to change the API-facing name but keep the database column the same, use `@map`:

```prisma
model Product {
  // ...
  @@map("old_column_name")
  displayName String @map("display_name")
}
```

This renames the public-facing field in Prisma without touching the database column.

**Option 2: Manual rename** (for actual database column rename)

Prisma treats a pure rename as a drop + add, which loses data. If you really need to rename:

1. Add the new column.
2. Backfill from the old column.
3. Deploy the app reading/writing both.
4. Switch the app to the new column.
5. Drop the old column.

For SellSnap at this stage, prefer to just pick the right name the first time. Renames are more trouble than they are worth.

## Data Migrations

Schema changes and data migrations are different. Prisma handles schema; data migrations are regular code. If you need to backfill or transform data, write a one-off script that uses the Prisma client and is invoked manually or via a deploy hook. Test on a local copy of production data before running against production. Never run ad-hoc SQL against production; always through a versioned script.

## Environments

- **Development:** `npx prisma migrate dev` creates the migration and applies it locally. This can also reset the DB if you confirm the prompt. Never run `prisma migrate dev` against production.
- **Production:** `npx prisma migrate deploy` applies pending migrations without prompting. This is what runs on deploy.

The two commands are not interchangeable. `migrate dev` can reset the database. `migrate deploy` cannot, which is why it is the safe one for production.

## Rollback

Prisma does not generate down migrations. Rolling forward by writing a new migration that reverses the change is the official answer. In practice this means: before shipping a risky migration, think about how you would undo it.

For truly risky changes (dropping a column with data, transforming money amounts, changing uniqueness constraints), do the change in the order least likely to cause downtime:

1. Deploy the app with code that works against both the old and new schema.
2. Run the migration.
3. Deploy the app with code that only uses the new schema.

This is called the expand-contract pattern. Use it whenever a migration would be impossible to roll back cleanly.

## Money Columns

Amounts are stored as integers in the smallest currency unit (kobo for NGN). The Prisma type is `BigInt`, never `Int`, `Float` or `Decimal` for amounts. `BigInt` handles large transactions without overflow.

If you are adding a column that holds money, its name should make the unit clear: `amountKobo`, not `amount`. The extra few characters prevent years of bugs.

## Common Mistakes

- Editing a migration file after it has been applied somewhere. Always write a new one.
- Adding a non-nullable column to an existing table without a default or a backfill, then being surprised when the migration fails on production.
- Renaming via Prisma's default drop-and-add behavior, losing data.
- Running `prisma migrate reset` on anything other than a local dev database. It drops and recreates the whole thing.
- Committing a `prisma/schema.prisma` change without the generated migration file. The schema file alone does not migrate anything.
- Storing money as floats.
- Adding indexes speculatively. Indexes are not free.