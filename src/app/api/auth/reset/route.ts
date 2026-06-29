import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(10).max(200),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Heslo musí mít alespoň 10 znaků." },
      { status: 400 },
    );
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");

  const rec = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!rec || rec.usedAt || rec.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Odkaz je neplatný nebo vypršel. Požádejte o nový." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: rec.userId },
    data: { passwordHash, failedLogins: 0, lockedUntil: null },
  });
  // Spotřebovat token + zneplatnit ostatní nepoužité tokeny uživatele
  await prisma.passwordResetToken.update({
    where: { id: rec.id },
    data: { usedAt: new Date() },
  });
  await prisma.passwordResetToken
    .updateMany({
      where: { userId: rec.userId, usedAt: null },
      data: { usedAt: new Date() },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
