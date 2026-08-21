import { NextResponse } from "next/server";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { csvResponseHeaders } from "@/lib/export/csv";
import { buildExport, isExportKind } from "@/lib/export/datasets";
import { recordAudit } from "@/lib/queries/audit";

/**
 * CSV DIŞA AKTARMA UCU — `/api/export/sporcular`, `/api/export/yoklama` …
 *
 * Salonun defterini Excel'de açmak için. Yalnız personel/yönetici erişebilir;
 * her indirme denetim kaydına düşer (kim, neyi, ne zaman indirdi).
 *
 * Dosya Türkçe Excel'e göre üretilir: noktalı virgül ayracı + BOM
 * (bkz. `src/lib/export/csv.ts`).
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!isExportKind(kind)) {
    return NextResponse.json(
      { ok: false, error: "Bilinmeyen dışa aktarma türü" },
      { status: 404 },
    );
  }

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

  const file = await buildExport(kind, membership.organizationId);

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "veri.disa-aktarildi",
    entityType: "Export",
    entityId: kind,
    summary: `${file.fileName} indirildi.`,
  });

  return new NextResponse(file.csv, {
    headers: csvResponseHeaders(file.fileName),
  });
}
