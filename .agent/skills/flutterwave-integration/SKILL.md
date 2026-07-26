# Flutterwave Integration Skill

Load this skill for any task that touches Flutterwave: creating payment links, verifying transactions, handling webhooks, or debugging payment flows. Do not write Flutterwave code from memory. Flutterwave's API changes, and this skill is the source of truth for how SellSnap uses it.

## What Flutterwave Does for SellSnap

Flutterwave is our payment gateway. It does three things for us:

1. **Hosts the checkout page.** When a buyer clicks "Pay Now," we hand them off to Flutterwave's hosted checkout. We never collect card details in our own UI. This keeps us out of PCI compliance scope.
2. **Processes the payment.** Flutterwave charges the card, handles 3D Secure, handles bank transfers, and settles the money.
3. **Notifies us via webhook.** When a payment succeeds or fails, Flutterwave sends a webhook to our server. The webhook is how we know the truth.

## The Payment Flow End to End

```
Buyer clicks "Pay Now"
        |
        v
POST /api/orders (creates pending Order, amount in kobo)
        |
        v
Server calls Flutterwave "create payment link" endpoint
        |
        v
Server returns hosted checkout URL to the browser
        |
        v
Browser redirects to Flutterwave
        |
        v
Buyer pays on Flutterwave's page
        |
        v
Flutterwave redirects buyer to /p/[slug]/success (untrusted, display only)
        |
        v
Flutterwave sends webhook to /api/webhooks/flutterwave (TRUSTED)
        |
        v
Webhook handler verifies signature, verifies transaction via API, marks Order paid
        |
        v
Seller notified via dashboard + email
```

The key insight: the browser redirect and the webhook are two different things. The browser redirect is just a UX signal to tell the buyer "we are checking your payment." The webhook is what actually updates the database.

## Environment Variables

Flutterwave needs three keys:

```
FLW_PUBLIC_KEY         Safe to expose. Used in client-side Flutterwave widgets if we ever use them.
FLW_SECRET_KEY        Server-only. Used to call the Flutterwave API.
FLW_WEBHOOK_SECRET    Server-only. Used to verify incoming webhooks.
```

Get the keys from the Flutterwave dashboard. In development, use test keys. In production, use live keys. The webhook secret is something you set yourself in the Flutterwave dashboard under Webhooks; choose a long random string and paste it into both the dashboard and your environment variables.

## Creating a Payment Link

When a buyer hits "Pay Now," we create a pending order and request a payment link from Flutterwave. The Flutterwave endpoint is `https://api.flutterwave.com/v3/payments`. We POST a JSON body:

```json
{
  "tx_ref": "sellsnap_order_<ORDER_ID>_<RANDOM>",
  "amount": 5000,
  "currency": "NGN",
  "redirect_url": "https://sellsnap.app/p/<slug>/success?tx_ref=<tx_ref>",
  "customer": {
    "email": "buyer@example.com",
    "name": "Buyer Name"
  },
  "customizations": {
    "title": "<Seller business name>",
    "description": "<Product name>",
    "logo": "https://sellsnap.app/logo.png"
  },
  "meta": {
    "order_id": "<ORDER_ID>",
    "product_id": "<PRODUCT_ID>",
    "seller_id": "<SELLER_ID>"
  }
}
```

With the header `Authorization: Bearer ${FLW_SECRET_KEY}`.

Notes:
- `tx_ref` must be unique per payment attempt. Include the order ID and a random suffix. Save it to the `Order` record before making the request.
- `amount` is in the major unit (naira), not kobo, for this specific Flutterwave endpoint. Convert from your internal kobo representation: `amount: order.amountKobo / 100`. This is the one place we go major-unit; everywhere else we stay in kobo. Double-check the conversion.
- `currency` is always `NGN` at launch.
- `meta` fields come back in the webhook, which makes reconciliation easier.
- `redirect_url` includes the `tx_ref` so the success page can show "verifying..." while waiting for the webhook.

The response looks like:

```json
{
  "status": "success",
  "message": "Hosted Link",
  "data": { "link": "https://checkout.flutterwave.com/v3/hosted/pay/..." }
}
```

Return `data.link` to the browser. Redirect the buyer there.

## Payment Initiation Route

The payment initiation route lives at `app/api/orders/route.ts`. Below is a reference implementation:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { productId, buyerEmail, buyerName } = await req.json();

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { user: true },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Product not found or unavailable' }, { status: 404 });
    }

    const order = await prisma.order.create({
      data: {
        productId: product.id,
        amount: product.price,
        status: 'PENDING',
        buyerEmail,
        transactionReference: `sellsnap_${uuid().slice(0, 8)}`,
      },
    });

    const amountInNaira = product.price / 100;
    const txRef = order.transactionReference;

    const payload = {
      tx_ref: txRef,
      amount: amountInNaira,
      currency: 'NGN',
      redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/p/${product.uniqueSlug}/success?tx_ref=${txRef}`,
      customer: {
        email: buyerEmail,
        name: buyerName,
      },
      customizations: {
        title: product.user.businessName || product.user.name,
        description: product.name,
        logo: process.env.NEXT_PUBLIC_BASE_URL + '/logo.png',
      },
      meta: {
        order_id: order.id,
        product_id: product.id,
        seller_id: product.userId,
      },
    };

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl: data.data.link });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

## Verifying a Transaction

After receiving a webhook, call the Flutterwave verify endpoint to confirm the payload is real. Do not trust the webhook body alone, even after signature verification.

```
GET https://api.flutterwave.com/v3/transactions/{transaction_id}/verify
Authorization: Bearer ${FLW_SECRET_KEY}
```

The response includes the transaction's real status, amount, currency, and `tx_ref`. Compare them to what you have stored. Only mark the order paid if:

1. `data.status === 'successful'`
2. `data.currency === order.currency` (usually `'NGN'`)
3. `data.amount === order.amountKobo / 100` (Flutterwave reports amount in major unit here)
4. `data.tx_ref === order.txRef`

If any check fails, log a warning and do not mark the order paid. Respond 200 to the webhook anyway so Flutterwave does not keep retrying a known bad payload.

## Webhook Handling

The webhook handler lives at `app/api/webhooks/flutterwave/route.ts`. See `resources/webhook-handler.ts` in this skill folder for a reference implementation. Copy it into the project and adapt to the current Prisma schema; do not reinvent it.

The handler must:
1. Verify the `verif-hash` header equals `FLW_WEBHOOK_SECRET`. Reject with 401 if not.
2. Parse the payload.
3. Call the verify endpoint with the transaction ID.
4. Confirm status, currency, amount, and `tx_ref` against the stored order.
5. Update the order status inside a single transaction that also creates a `Payment` record with the `gateway_reference` (Flutterwave's transaction ID).
6. Let the unique constraint on `Payment.gatewayReference` catch duplicates. Catch the Prisma `P2002` error and respond 200 without reprocessing.
7. Respond 200 quickly. Heavy work like sending emails goes in a background job, not in the webhook response path.

## Testing

Flutterwave's test mode supports test cards documented at their developer docs. The two you need most often:
- Successful charge: `4187427415564246` (test PIN `3310`, OTP `12345`).
- Failed charge: `5258584131808179`.

Always verify end-to-end with the test keys before shipping any payment-related change. Do not rely on unit tests alone; the bug is almost always in the integration.

## Common Mistakes

- Storing amounts as floats. Stay in integer kobo in the database, convert to naira only when calling Flutterwave.
- Trusting the browser redirect. The redirect is not proof of payment.
- Skipping the verify API call. The webhook signature proves the request came from someone who knows the secret hash; calling verify proves the transaction actually exists and succeeded.
- Forgetting idempotency. Flutterwave can retry webhooks. Duplicates must be no-ops.
- Logging the secret key or the webhook body with sensitive fields. Strip before logging.
- Using Paystack patterns. SellSnap is on Flutterwave; ignore anything in old PRDs or references that say Paystack.

## Resources in This Skill

- `resources/webhook-handler.ts` — reference implementation of the webhook route handler. Copy and adapt to current schema.
- `resources/payment-initiator.ts` — reference implementation of the payment initiation route.

## Success Page

When a buyer completes payment, they are redirected to `/p/[slug]/success?tx_ref=<tx_ref>`. This page shows a success logo to confirm the payment was received. The page should:

1. Display the Flutterwave success confirmation (green checkmark, "Payment Successful" message)
2. Show the transaction reference (`tx_ref`) for the buyer's records
3. Show the product name and amount paid
4. Poll the order status via API or wait for webhook to update (the webhook is the source of truth)
5. Provide a "Return to [Seller Name]" button linking back to the product page

The success page is **untrusted** — it only displays information. The actual payment confirmation happens via webhook.

---
*Last updated: 2026-04-27*
