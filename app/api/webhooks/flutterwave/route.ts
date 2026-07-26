import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { processFlutterwavePayment } from '@/lib/payments';
import { timingSafeEqual } from 'crypto';

/**
 * Robust Flutterwave Webhook Handler (Production)
 * 
 * Delegates core payment processing to shared processFlutterwavePayment.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Signature verification (timing-safe)
    const signature = req.headers.get('verif-hash');
    if (!signature) {
      logger.warn('flutterwave.webhook.missing_signature');
      return NextResponse.json({ 
        ok: false, 
        error: { code: 'UNAUTHORIZED', message: 'Invalid signature' } 
      }, { status: 401 });
    }
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(env.FLUTTERWAVE_SECRET_HASH);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      logger.warn('flutterwave.webhook.invalid_signature');
      return NextResponse.json({ 
        ok: false, 
        error: { code: 'UNAUTHORIZED', message: 'Invalid signature' } 
      }, { status: 401 });
    }

    // 2. Parse payload
    let payload: any;
    try {
      payload = await req.json();
    } catch (err) {
      logger.error('flutterwave.webhook.invalid_json', { error: err });
      return NextResponse.json({ 
        ok: false, 
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } 
      }, { status: 400 });
    }

    // 3. Filter events (Flutterwave sends multiple event types)
    const event = payload.event || payload['event.type'];
    if (event !== 'charge.completed' && event !== 'PaymentSuccessful') {
      return NextResponse.json({ ok: true, data: { message: 'Ignored event' } }, { status: 200 });
    }

    const data = payload.data;
    if (!data?.id || !data?.tx_ref) {
      logger.warn('flutterwave.webhook.missing_data', { payload });
      return NextResponse.json({ ok: true, data: { message: 'Missing data' } }, { status: 200 });
    }

    // 4. Process payment through shared verification pipeline
    const result = await processFlutterwavePayment(data.id, data.tx_ref);

    if (!result.ok) {
      const httpStatus = result.httpStatus || 500;
      if (result.code) {
        return NextResponse.json({ 
          ok: false, 
          error: { code: result.code, message: result.message } 
        }, { status: httpStatus });
      }
      return NextResponse.json({ ok: true, data: { message: result.message } }, { status: 200 });
    }

    return NextResponse.json({ ok: true, data: { status: result.status } }, { status: 200 });

  } catch (error) {
    logger.error('flutterwave.webhook.internal_error', { error });
    return NextResponse.json({ 
      ok: false, 
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } 
    }, { status: 500 });
  }
}
