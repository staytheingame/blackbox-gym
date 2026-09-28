import { NextResponse } from "next/server";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { absoluteUrl } from "@/lib/app-url";
import { qrPng } from "@/lib/qr";

/**
 * BAŞVURU SAYFASI QR İNDİRME — `/personel/basvurular/qr`.
 * Yalnız personel; dosya baskıya hazır 1024 px PNG'dir.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Oturum açılmamış" }, { status: 401 });
  }
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) {
    return NextResponse.json(
      { ok: false, error: "Personel yetkisi gerekli" },
      { status: 403 },
    );
  }

  const png = await qrPng(await absoluteUrl("/basvuru"));

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'attachment; filename="blackbox-basvuru-qr.png"',
      "Cache-Control": "private, no-store",
    },
  });
}
