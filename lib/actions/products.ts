'use server';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function deleteProduct(productId: string) {
  const user = await getSession();
  if (!user) redirect('/auth');

  const orders = await db.order.findMany({
    where: { product: { id: productId, userId: user.id } },
    select: { id: true },
  });

  const orderIds = orders.map((o: typeof orders[number]) => o.id);
  if (orderIds.length > 0) {
    await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  await db.product.delete({ where: { id: productId, userId: user.id } });

  revalidatePath('/products');
}

export async function toggleProductActive(productId: string) {
  const user = await getSession();
  if (!user) redirect('/auth');

  const product = await db.product.findUnique({
    where: { id: productId, userId: user.id },
    select: { isActive: true },
  });

  if (!product) throw new Error('Product not found');

  await db.product.update({
    where: { id: productId },
    data: { isActive: !product.isActive },
  });

  revalidatePath('/products');
}
