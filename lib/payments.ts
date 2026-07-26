import { Prisma } from '@prisma/client';
import { db } from './db';
import { env } from './env';
import { logger } from './logger';
import { sendOrderNotificationEmail, sendBuyerReceiptEmail } from './email';

export interface PaymentResult {
  ok: boolean;
  status?: string;
  message?: string;
  code?: string;
  httpStatus?: number;
}

type LogEvent =
  | 'verification_started'
  | 'order_not_found'
  | 'already_processed'
  | 'flutterwave_verify_called'
  | 'flutterwave_verify_failed'
  | 'verification_not_successful'
  | 'currency_mismatch'
  | 'amount_mismatch'
  | 'amount_overpaid'
  | 'payment_success'
  | 'payment_created'
  | 'duplicate_ignored'
  | 'email_sent'
  | 'email_failed'
  | 'internal_error';

async function logPaymentEvent(
  orderId: string,
  txRef: string,
  event: LogEvent,
  message?: string,
  metadata?: Record<string, unknown>,
  paymentId?: string,
) {
  try {
    await db.paymentLog.create({
      data: {
        paymentId: paymentId ?? null,
        orderId,
        txRef,
        event,
        message: message ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch {
    // Logging failure should not break payment processing
  }
}

export async function processFlutterwavePayment(
  transactionId: string | number,
  txRef: string
): Promise<PaymentResult> {
  try {
    const order = await db.order.findUnique({
      where: { transactionReference: txRef },
      include: { product: { include: { user: true } } },
    });

    if (!order) {
      logger.warn('payment.order_not_found', { txRef });
      await logPaymentEvent('unknown', txRef, 'order_not_found', `Order not found for txRef: ${txRef}`);
      return { ok: false, message: 'Order not found', httpStatus: 404 };
    }

    await logPaymentEvent(order.id, txRef, 'verification_started', 'Payment verification started', {
      transactionId,
    });

    if (order.status === 'paid') {
      logger.info('payment.already_processed', { txRef });
      await logPaymentEvent(order.id, txRef, 'already_processed', 'Order already marked as paid');
      return { ok: true, status: 'already_paid' };
    }

    await logPaymentEvent(order.id, txRef, 'flutterwave_verify_called', 'Calling Flutterwave verify API', {
      transactionId,
    });

    let verifyResponse: Response;
    try {
      verifyResponse = await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          headers: { Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}` },
        }
      );
    } catch (fetchError) {
      logger.error('payment.verification_network_error', {
        id: transactionId,
        error: String(fetchError),
      });
      await logPaymentEvent(order.id, txRef, 'flutterwave_verify_failed', 'Network error calling Flutterwave verify API', {
        error: String(fetchError),
      });
      return { ok: false, message: 'Could not reach payment verification service', httpStatus: 502 };
    }

    if (!verifyResponse.ok) {
      const responseText = await verifyResponse.text().catch(() => '');
      logger.error('payment.verification_request_failed', {
        status: verifyResponse.status,
        id: transactionId,
        body: responseText.slice(0, 500),
      });
      await logPaymentEvent(order.id, txRef, 'flutterwave_verify_failed', 'Flutterwave verify API returned non-OK', {
        httpStatus: verifyResponse.status,
        responseBody: responseText.slice(0, 200),
      });
      return { ok: false, message: 'Verification service unavailable', code: 'SERVICE_UNAVAILABLE', httpStatus: 502 };
    }

    let verifyData: any;
    try {
      verifyData = await verifyResponse.json();
    } catch {
      const rawText = await verifyResponse.text().catch(() => '');
      logger.error('payment.verification_invalid_json', {
        id: transactionId,
        body: rawText.slice(0, 500),
      });
      await logPaymentEvent(order.id, txRef, 'flutterwave_verify_failed', 'Invalid JSON from Flutterwave verify API', {
        body: rawText.slice(0, 200),
      });
      return { ok: false, message: 'Invalid response from payment gateway', httpStatus: 502 };
    }

    if (!verifyData.data) {
      logger.error('payment.verification_no_data', {
        id: transactionId,
        verifyData,
      });
      await logPaymentEvent(order.id, txRef, 'verification_not_successful', 'Flutterwave verify response missing data', {
        verifyData,
      });
      return { ok: false, message: 'Payment verification data missing', httpStatus: 400 };
    }

    if (verifyData.status !== 'success' || verifyData.data.status !== 'successful') {
      logger.info('payment.verification_not_successful', {
        id: transactionId,
        verifyStatus: verifyData.status,
        dataStatus: verifyData.data.status,
      });
      await logPaymentEvent(order.id, txRef, 'verification_not_successful', 'Flutterwave reports payment not successful', {
        verifyStatus: verifyData.status,
        dataStatus: verifyData.data.status,
      });
      return { ok: false, message: 'Payment not successful', httpStatus: 400 };
    }

    const verifiedAmountNaira = Number(verifyData.data.amount);
    if (isNaN(verifiedAmountNaira) || verifiedAmountNaira <= 0) {
      logger.error('payment.verification_invalid_amount', {
        id: transactionId,
        rawAmount: verifyData.data.amount,
      });
      await logPaymentEvent(order.id, txRef, 'internal_error', 'Invalid amount from Flutterwave verify', {
        rawAmount: verifyData.data.amount,
      });
      return { ok: false, message: 'Invalid payment amount', httpStatus: 400 };
    }

    const verifiedAmountKobo = BigInt(Math.round(verifiedAmountNaira * 100));

    if (verifyData.data.currency !== order.currency) {
      logger.error('payment.currency_mismatch', {
        expected: order.currency,
        actual: verifyData.data.currency,
      });
      await logPaymentEvent(order.id, txRef, 'currency_mismatch', 'Currency does not match order', {
        expected: order.currency,
        actual: verifyData.data.currency,
      });
      return { ok: false, message: 'Currency mismatch', httpStatus: 400 };
    }

    if (Number(verifiedAmountKobo) < order.amountKobo) {
      logger.error('payment.amount_mismatch', {
        expected: order.amountKobo.toString(),
        actual: verifiedAmountKobo.toString(),
      });
      await logPaymentEvent(order.id, txRef, 'amount_mismatch', 'Amount paid is less than the product price', {
        expectedKobo: order.amountKobo,
        actualKobo: Number(verifiedAmountKobo),
      });
      return { ok: false, message: 'Amount paid is less than the product price', httpStatus: 400 };
    }

    if (Number(verifiedAmountKobo) > order.amountKobo) {
      logger.warn('payment.amount_overpaid', {
        expected: order.amountKobo.toString(),
        actual: verifiedAmountKobo.toString(),
      });
      await logPaymentEvent(order.id, txRef, 'amount_overpaid', 'Amount paid exceeds product price', {
        expectedKobo: order.amountKobo,
        actualKobo: Number(verifiedAmountKobo),
      });
    }

    let paymentId: string | undefined;

    try {
      await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            gatewayReference: String(verifyData.data.id),
            status: 'paid',
            paidAt: new Date(),
          },
        });
        paymentId = payment.id;

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'paid' },
        });
      });
    } catch (error: any) {
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (isDuplicate) {
        logger.info('payment.duplicate_ignored', { txRef });
        await logPaymentEvent(order.id, txRef, 'duplicate_ignored', 'Duplicate payment attempt ignored');
        return { ok: true, status: 'already_paid' };
      }
      logger.error('payment.transaction_failed', { txRef, error: String(error) });
      await logPaymentEvent(order.id, txRef, 'internal_error', 'Transaction failed', { error: String(error) });
      return { ok: false, message: 'Payment could not be processed', httpStatus: 500 };
    }

    await logPaymentEvent(order.id, txRef, 'payment_created', 'Payment record created and order marked paid', {
      gatewayReference: String(verifyData.data.id),
      amountNaira: verifiedAmountNaira,
      currency: verifyData.data.currency,
    }, paymentId);

    sendOrderNotificationEmail(
      order.product.user.email,
      order.product.name,
      verifiedAmountNaira,
      order.buyerEmail
    )
      .then(() => logPaymentEvent(order.id, txRef, 'email_sent', 'Seller notification email sent', {}, paymentId))
      .catch(e => {
        logger.error('payment.email_failed', { error: e });
        logPaymentEvent(order.id, txRef, 'email_failed', 'Failed to send seller notification email', { error: String(e) }, paymentId);
      });

    sendBuyerReceiptEmail(
      order.buyerEmail,
      order.product.name,
      verifiedAmountNaira,
      (order.product.user.businessName ?? order.product.user.name) ?? 'Seller',
    )
      .then(() => logPaymentEvent(order.id, txRef, 'email_sent', 'Buyer receipt email sent', {}, paymentId))
      .catch(e => {
        logger.error('payment.buyer_email_failed', { error: e });
        logPaymentEvent(order.id, txRef, 'email_failed', 'Failed to send buyer receipt email', { error: String(e) }, paymentId);
      });

    logger.info('payment.success', { orderId: order.id, txRef });
    return { ok: true, status: 'paid' };

  } catch (error) {
    logger.error('payment.unhandled_error', { txRef, error: String(error) });
    await logPaymentEvent(
      txRef,
      txRef,
      'internal_error',
      'Unhandled payment processing error',
      { error: String(error) },
    );
    return { ok: false, message: 'Payment processing failed', httpStatus: 500 };
  }
}
