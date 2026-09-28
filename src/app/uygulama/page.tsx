import { redirect } from "next/navigation";
import { getCurrentUser, getOrganizationMembership } from "@/lib/auth/guards";
import { homePathForRole } from "@/lib/auth/roles";

/**
 * UYGULAMA GİRİŞ KAPISI — ana ekrana eklenen uygulama buradan açılır
 * (`manifest.ts` → `start_url`).
 *
 * Neden `/giris` değil: oturumu açık biri uygulamayı her açışında giriş
 * formunu görürdü. Buradan oturum varsa rolünün ekranına (sporcu → `/uye`,
 * antrenör → `/personel`, yönetici → `/yonetim`), yoksa giriş ekranına gider.
 */
export const dynamic = "force-dynamic";

export default async function AppEntryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const membership = await getOrganizationMembership(user.id);
  redirect(membership ? homePathForRole(membership.role) : "/uye");
}
