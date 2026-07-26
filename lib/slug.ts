import { db } from './db';
import crypto from 'crypto';

export async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  let slug = baseSlug;
  let exists = true;
  
  // We add a random suffix to ensure uniqueness right away, per the prompt example: "black-hoodie-8347"
  while (exists) {
    const randomSuffix = crypto.randomBytes(2).toString('hex');
    slug = `${baseSlug}-${randomSuffix}`;
    const product = await db.product.findUnique({
      where: { uniqueSlug: slug }
    });
    if (!product) {
      exists = false;
    }
  }

  return slug;
}
