import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateUniqueSlug } from "@/lib/slug";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const MAGIC_BYTES: Record<string, Uint8Array> = {
  "image/jpeg": new Uint8Array([0xFF, 0xD8, 0xFF]),
  "image/png": new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  "image/gif": new Uint8Array([0x47, 0x49, 0x46]),
  "image/webp": new Uint8Array([0x52, 0x49, 0x46, 0x46]),
};

function detectMimeType(bytes: Uint8Array): string | null {
  for (const [mime, magic] of Object.entries(MAGIC_BYTES)) {
    if (mime === "image/webp") {
      if (bytes.length >= 12) {
        const riff = bytes.slice(0, 4);
        const webp = bytes.slice(8, 12);
        if (
          riff[0] === 0x52 && riff[1] === 0x49 && riff[2] === 0x46 && riff[3] === 0x46 &&
          webp[0] === 0x57 && webp[1] === 0x45 && webp[2] === 0x42 && webp[3] === 0x50
        ) {
          return "image/webp";
        }
      }
      continue;
    }
    const magicLen = magic.length;
    let match = true;
    for (let i = 0; i < magicLen; i++) {
      if (bytes[i] !== magic[i]) { match = false; break; }
    }
    if (match) return mime;
  }
  return null;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

  const name = formData.get("name") as string;
  const price = formData.get("price") as string;
  const description = formData.get("description") as string;
  const imageFile = formData.get("image") as File | null;

  const errors: Record<string, string> = {};

  if (!name?.trim()) errors.name = "This field cannot be empty";
  if (!description?.trim()) errors.description = "This field cannot be empty";
  if (!price?.trim()) errors.price = "This field cannot be empty";
  if (!imageFile || imageFile.size === 0) errors.image = "Please upload a product image";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const priceNum = Number(price);
  if (isNaN(priceNum) || priceNum <= 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  if (imageFile && imageFile.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Image must be less than 5MB" }, { status: 400 });
  }

  try {
    const priceKobo = Math.round(priceNum * 100);
    const uniqueSlug = await generateUniqueSlug(name);

    let imageUrl: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const bytes = new Uint8Array(await imageFile.arrayBuffer());

      if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
        return NextResponse.json({ error: "Invalid image type. Allowed: JPEG, PNG, WebP, GIF" }, { status: 400 });
      }

      const detectedMime = detectMimeType(bytes);
      if (!detectedMime || detectedMime !== imageFile.type) {
        return NextResponse.json({ error: "File contents do not match the declared image type" }, { status: 400 });
      }

      const ext = EXTENSIONS[detectedMime] || "bin";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const uploadDir = join(process.cwd(), "public", "uploads");
      const filePath = join(uploadDir, filename);

      await mkdir(uploadDir, { recursive: true });
      await writeFile(filePath, Buffer.from(bytes));

      imageUrl = `/uploads/${filename}`;
    }

    await db.product.create({
      data: {
        userId: user.id,
        name,
        priceKobo,
        description,
        imageUrl,
        uniqueSlug,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Failed to create product. Check server logs." },
      { status: 500 }
    );
  }
}
