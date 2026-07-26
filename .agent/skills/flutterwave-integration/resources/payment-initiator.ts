import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { productId, buyerEmail, buyerName } = await req.json();

    if (!productId || !buyerEmail || !buyerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { user: true },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Product not found or unavailable' }, { status: 404 });
    }

    const txRef = `sellsnap_${uuid().slice(0, 8)}`;

    const order = await prisma.order.create({
      data: {
        productId: product.id,
        amount: product.price,
        status: 'PENDING',
        buyerEmail,
        transactionReference: txRef,
      },
    });

    const amountInNaira = product.price / 100;

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
      console.error('Flutterwave error:', data);
      return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl: data.data.link });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}