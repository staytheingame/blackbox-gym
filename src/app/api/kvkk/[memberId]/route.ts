import { NextResponse } from "next/server";
import {
  getCurrentMember,
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/roles";
import { buildMemberDataPackage } from "@/lib/queries/privacy";
import { recordAudit } from "@/lib/queries/audit";

/**
 * KVKK VERİ DÖKÜMÜ — `/api/kvkk/<memberId>`
 *
 * Sporcunun sistemdeki tüm kayıtlarını tek JSON dosyası olarak indirir.
 * İki kişi çağırabilir: sporcunun kendisi ve salonun personeli (aynı
 * organizasyondaki). Başkasının verisi 403 döner.
 *
 * Personel indirmesi denetim kaydına düşer; sporcunun kendi verisini
 * indirmesi düşmez — kendi verisine bakmak bir yönetim işlemi değildir.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Oturum açılmamış" }, { status: 401 });
  }

  const membership = await requireOrganizationMembership(user.id).catch(() => null);
  if (!membership) {
    return NextResponse.json(
      { ok: false, error: "Organizasyon üyeliği bulunamadı" },
      { status: 403 },
    );
  }

  const staff = isStaffRole(membership.role);
  const own = await getCurrentMember(user.id);
  const isSelf = own?.id === memberId;

  if (!staff && !isSelf) {
    return NextResponse.json(
      { ok: false, error: "Bu veriye erişim yetkin yok" },
      { status: 403 },
    );
  }

  const data = await buildMemberDataPackage(memberId);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Sporcu bulunamadı" }, { status: 404 });
  }

  // Personel başkasının verisini indiriyorsa iz bırak.
  if (staff && !isSelf) {
    await recordAudit({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      actorLabel: user.displayName,
      action: "veri.disa-aktarildi",
      entityType: "Member",
      entityId: memberId,
      summary: "Sporcunun KVKK veri dökümü indirildi.",
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="blackbox-veri-${memberId}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
