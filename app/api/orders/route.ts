import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { rateLimit, getClientIp } from '@/lib/rate-limiter';
import crypto from 'crypto';
import { z } from 'zod';

const orderSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`order:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const formData = await req.formData();
  const rawInput = {
    productId: formData.get('productId') as string,
    email: formData.get('email') as string,
    name: formData.get('name') as string,
  };

  const parsed = orderSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input';
    return NextResponse.json({ ok: false, error: firstError }, { status: 400 });
  }

  const { productId, email, name } = parsed.data;

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { user: true }
  });

  if (!product || !product.isActive) {
    return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
  }

  const orderId = crypto.randomUUID();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const txRef = `sellsnap_order_${orderId}_${randomSuffix}`;
  const verifyToken = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const order = await db.order.create({
    data: {
      id: orderId,
      productId: product.id,
      amountKobo: product.priceKobo,
      buyerEmail: email,
      buyerName: name,
      transactionReference: txRef,
      verifyToken,
      expiresAt,
      status: 'pending',
      currency: 'NGN',
    }
  });

  const amountNGN = Number(order.amountKobo) / 100;
  const redirectUrl = `${env.NEXT_PUBLIC_APP_URL}/p/${product.uniqueSlug}/success?tx_ref=${txRef}`;

  const flutterwavePayload = {
    tx_ref: txRef,
    amount: amountNGN,
    currency: "NGN",
    redirect_url: redirectUrl,
    customer: {
      email,
      name,
    },
    customizations: {
      title: product.user.businessName,
      description: product.name,
    },
    meta: {
      order_id: order.id,
      product_id: product.id,
      seller_id: product.userId
    }
  };

  try {
    const fwResponse = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(flutterwavePayload)
    });

    const responseText = await fwResponse.text();
    let fwData;
    try {
      fwData = JSON.parse(responseText);
    } catch {
      console.error("Flutterwave returned non-JSON response:", responseText);
      return NextResponse.json({ ok: false, error: 'Invalid payment gateway response' }, { status: 500 });
    }

    if (fwData.status === 'success' && fwData.data?.link) {
      return NextResponse.json({
        ok: true,
        url: fwData.data.link,
        tx_ref: txRef,
        verifyToken,
        amount: amountNGN,
        customer: { email, name },
        redirect_url: redirectUrl,
        customizations: {
          title: product.user.businessName,
          description: product.name,
        }
      });
    } else {
      console.error("Flutterwave error:", fwData);
      const errorMsg = fwData.message || 'Payment gateway error';
      return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
    }
  } catch (error) {
    console.error("Payment initiation failed:", error);
    return NextResponse.json({ ok: false, error: 'Failed to initiate payment. Check console for details.' }, { status: 500 });
  }
}
