import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }

  const target = await prisma.user.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  });
  if (!target) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }
  // Nelze smazat sebe ani jiného ownera
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Vlastníka účtu nelze smazat." },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
