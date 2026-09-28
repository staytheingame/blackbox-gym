import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { joinUrl } from "@/lib/queries/join-links";
import { qrPng } from "@/lib/qr";

/**
 * KAYIT BAĞLANTISI QR İNDİRME — `/yonetim/kayit-linki/qr/<bağlantı-id>`.
 *
 * Yalnız yönetici indirir ve yalnız kendi salonunun bağlantısı için: QR'ın
 * içindeki adres herkese açıktır ama "hangi bağlantılar var" bilgisi değildir.
 * Dosya baskıya hazır 1024 px PNG'dir.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const { linkId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Oturum açılmamış" }, { status: 401 });
  }
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) {
    return NextResponse.json(
      { ok: false, error: "Yönetici yetkisi gerekli" },
      { status: 403 },
    );
  }

  const link = await prisma.memberJoinLink.findFirst({
    where: { id: linkId, organizationId: membership.organizationId },
    select: { slug: true },
  });
  if (!link) {
    return NextResponse.json({ ok: false, error: "Bağlantı bulunamadı" }, { status: 404 });
  }

  const png = await qrPng(await joinUrl(link.slug));

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="blackbox-kayit-${link.slug}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
