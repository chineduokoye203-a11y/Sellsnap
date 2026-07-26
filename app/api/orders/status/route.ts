import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const txRef = req.nextUrl.searchParams.get('tx_ref');

    if (!txRef) {
      return NextResponse.json({ ok: false, error: 'Missing tx_ref' }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { transactionReference: txRef },
      include: { payment: true, product: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        status: order.status,
        productName: order.product.name,
        amountNaira: order.amountKobo / 100,
        paidAt: order.payment?.paidAt || null,
      },
    });
  } catch (error) {
    logger.error('status.query_failed', { error });
    return NextResponse.json({ ok: false, error: 'Could not verify payment status' }, { status: 500 });
  }
}
