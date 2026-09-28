import { NextResponse } from "next/server";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { absoluteUrl } from "@/lib/app-url";
import { qrPng } from "@/lib/qr";

/**
 * FORM QR İNDİRME — `/personel/basvurular/qr?form=baslangic|basvuru`.
 * Yalnız personel; dosya baskıya hazır 1024 px PNG'dir. `form` yalnız bilinen
 * iki yoldan birini seçer: herhangi bir adresin QR'ını üreten açık bir uç değildir.
 */

const FORMS: Record<string, { path: string; file: string }> = {
  baslangic: { path: "/baslangic", file: "blackbox-baslangic-qr.png" },
  basvuru: { path: "/basvuru", file: "blackbox-basvuru-qr.png" },
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const requested = new URL(request.url).searchParams.get("form") ?? "baslangic";
  const form = FORMS[requested];
  if (!form) {
    return NextResponse.json({ ok: false, error: "Bilinmeyen form" }, { status: 404 });
  }

  const png = await qrPng(await absoluteUrl(form.path));

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${form.file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
