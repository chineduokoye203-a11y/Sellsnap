/**
 * Reference implementation of the Flutterwave webhook handler for SellSnap.
 *
 * Drop this at: app/api/webhooks/flutterwave/route.ts
 *
 * This file is a REFERENCE. Adapt field names to match the current Prisma
 * schema before committing. The logic and the order of checks must be
 * preserved exactly.
 *
 * The handler does five things, in order:
 * 1. Verify the webhook signature header.
 * 2. Parse the payload.
 * 3. Independently verify the transaction by calling Flutterwave.
 * 4. Confirm the verified data matches our stored order.
 * 5. Update the order and create a payment record, idempotently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

const FLUTTERWAVE_VERIFY_URL = (id: string) =>
  `https://api.flutterwave.com/v3/transactions/${id}/verify`;

type FlutterwaveWebhookPayload = {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
    customer?: { email?: string };
    meta?: Record<string, string>;
  };
};

type FlutterwaveVerifyResponse = {
  status: string;
  message: string;
  data: {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
  };
};

export async function POST(req: NextRequest) {
  // 1. Signature verification. Reject anything that does not match.
  const signature = req.headers.get('verif-hash');
  if (!signature || signature !== env.FLUTTERWAVE_SECRET_HASH) {
    logger.warn('flutterwave.webhook.bad_signature');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 2. Parse. If the body is malformed, something is very wrong. Log and 400.
  let payload: FlutterwaveWebhookPayload;
  try {
    payload = (await req.json()) as FlutterwaveWebhookPayload;
  } catch (error) {
    logger.error('flutterwave.webhook.parse_failed', { error });
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Only process completed charge events. Flutterwave also sends transfer,
  // refund, and other events — ignore them rather than trying to match an order.
  const event = payload.event || payload['event.type'];
  if (event !== 'charge.completed' && event !== 'PaymentSuccessful') {
    logger.info('flutterwave.webhook.ignored_event', { event });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { data } = payload;
  if (!data?.id || !data.tx_ref) {
    logger.warn('flutterwave.webhook.missing_fields', { payload });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 3. Independently verify with Flutterwave. We do not trust the webhook
  //    body even after signature verification, because a leaked secret hash
  //    would otherwise be a catastrophic single point of failure.
  let verified: FlutterwaveVerifyResponse;
  try {
    const res = await fetch(FLUTTERWAVE_VERIFY_URL(String(data.id)), {
      headers: { Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}` },
    });
    // Bug fix: guard the HTTP status before parsing. A non-2xx from Flutterwave
    // (e.g. 401 or 429) would still produce parseable JSON but with an error
    // payload that would pass the `verified.status` check below.
    if (!res.ok) {
      logger.error('flutterwave.webhook.verify_http_error', {
        status: res.status,
        id: data.id,
      });
      return NextResponse.json({ ok: false }, { status: 502 });
    }
    verified = (await res.json()) as FlutterwaveVerifyResponse;
  } catch (error) {
    logger.error('flutterwave.webhook.verify_failed', { error, id: data.id });
    // Return 500 so Flutterwave retries. This is a transient issue on our end.
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (verified.status !== 'success' || verified.data.status !== 'successful') {
    logger.info('flutterwave.webhook.not_successful', {
      id: data.id,
      status: verified.data?.status,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 4. Find our order and cross-check every field that matters.
  const order = await db.order.findUnique({
    where: { transactionReference: verified.data.tx_ref },
  });

  if (!order) {
    logger.warn('flutterwave.webhook.order_not_found', {
      tx_ref: verified.data.tx_ref,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Amounts: Flutterwave returns the major unit (naira). Our DB stores kobo.
  // Bug fix: do NOT divide order.amountKobo by 100 and compare as a float.
  // Floating-point division can introduce precision errors (e.g. 10001 kobo
  // becomes 100.01000000000001 naira). Instead, convert the verified naira
  // amount back to kobo as an integer and compare integers.
  const verifiedAmountKobo = Math.round(Number(verified.data.amount) * 100);
  if (
    verifiedAmountKobo !== order.amountKobo ||
    verified.data.currency !== order.currency
  ) {
    logger.warn('flutterwave.webhook.amount_or_currency_mismatch', {
      orderId: order.id,
      expected: { amountKobo: order.amountKobo, currency: order.currency },
      actual: { amountKobo: verifiedAmountKobo, currency: verified.data.currency },
    });
    // Respond 200 so Flutterwave stops retrying; this is a problem for a human.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 5. Persist. Idempotency comes from the unique constraint on
  //    Payment.gatewayReference. If a duplicate webhook lands, the insert
  //    throws P2002 and we respond 200 without reprocessing.
  try {
    await db.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          gatewayReference: String(verified.data.id),
          status: 'paid',
          // paidAt omitted: the schema's @default(now()) handles this.
          // Setting it explicitly here would create a tiny clock skew between
          // the JS timestamp and the DB-generated timestamp on replicas.
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'paid' },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      logger.info('flutterwave.webhook.duplicate_ignored', {
        id: verified.data.id,
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    logger.error('flutterwave.webhook.persist_failed', { error });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Notifications (email, dashboard push) should be queued as a background
  // job, not awaited here. A slow email provider must not slow down the
  // webhook response. Example:
  //
  //   await jobs.enqueue('notify.order-paid', { orderId: order.id });

  return NextResponse.json({ ok: true }, { status: 200 });
}
