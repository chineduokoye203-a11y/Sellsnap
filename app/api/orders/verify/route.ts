import { NextRequest, NextResponse } from 'next/server';
import { processFlutterwavePayment } from '@/lib/payments';
import { rateLimit, getClientIp } from '@/lib/rate-limiter';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`verify:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    let body: { transaction_id?: string | number; tx_ref?: string; verifyToken?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const transactionId = body.transaction_id;
    const txRef = body.tx_ref;
    const verifyToken = body.verifyToken;

    if (!transactionId || !txRef) {
      return NextResponse.json({ ok: false, error: 'Missing transaction_id or tx_ref' }, { status: 400 });
    }

    if (verifyToken) {
      const order = await db.order.findUnique({
        where: { transactionReference: txRef },
        select: { verifyToken: true },
      });
      if (order?.verifyToken && order.verifyToken !== verifyToken) {
        return NextResponse.json({ ok: false, error: 'Invalid verify token' }, { status: 403 });
      }
    }

    const result = await processFlutterwavePayment(transactionId, txRef);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.message },
        { status: result.httpStatus || 500 }
      );
    }

    return NextResponse.json({ ok: true, data: { status: result.status } });

  } catch (error) {
    logger.error('verify.internal_error', { error });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
