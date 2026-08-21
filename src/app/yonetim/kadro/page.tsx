import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { listStaff } from "@/lib/queries/admin";
import { listCoachCompensations } from "@/lib/queries/finance";
import { describeCompensation } from "@/domain/finance/earnings";
import { ORG_ROLE_LABEL } from "@/lib/auth/roles";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { AddStaffForm } from "./AddStaffForm";
import { CompensationForm } from "./CompensationForm";
import { changeRoleAction, setStatusAction } from "./actions";

/** Kuruş → form alanında görünecek lira metni ("" = boş bırakılmış). */
function minorToInput(value: number | null): string {
  if (value == null) return "";
  return String(value / 100);
}

export const metadata: Metadata = { title: "Kadro — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

const rowButton =
  "rounded-sm border border-brand-border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

export default async function AdminStaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);

  const [staff, compensations] = await Promise.all([
    listStaff(membership.organizationId),
    listCoachCompensations(membership.organizationId),
  ]);
  const compensationByUser = new Map(
    compensations.map((row) => [row.coachUserId, row]),
  );
  const admins = staff.filter((row) => row.role === "admin");
  const coaches = staff.filter((row) => row.role === "coach");
  const disabled = staff.filter((row) => row.status !== "active");

  return (
    <PanelPage
      title="Kadro"
      description="Antrenör ve yönetici hesapları. Antrenör kendi ders saatlerini açar ve YALNIZ kendi sporcularını görür; yönetici ayrıca paket, kasa, rapor ve kadroya erişir. Her satırdaki 'Hakediş' bölümü o antrenörün nasıl kazandığını belirler."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Yönetici" value={admins.length} />
        <StatCard label="Antrenör" value={coaches.length} />
        <StatCard
          label="Kapalı Hesap"
          value={disabled.length}
          highlight={disabled.length > 0}
        />
      </div>

      <PanelCard title={`Kadro (${staff.length})`}>
        {staff.length === 0 ? (
          <EmptyState>Kadro kaydı yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {staff.map((row) => {
              const isSelf = row.userId === user.id;
              const active = row.status === "active";

              return (
                <li
                  key={row.organizationUserId}
                  className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {row.displayName}
                      {isSelf && (
                        <span className="ml-2 text-xs text-brand-muted">
                          (sen)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {row.email} · katılım {formatDateTR(row.createdAt)}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {row.upcomingSlots} yaklaşan seans açmış
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.role !== "admin" && (
                        <form
                          action={changeRoleAction.bind(
                            null,
                            row.organizationUserId,
                            "admin",
                          )}
                        >
                          <button type="submit" className={rowButton}>
                            Yönetici Yap
                          </button>
                        </form>
                      )}
                      {row.role !== "coach" && (
                        <form
                          action={changeRoleAction.bind(
                            null,
                            row.organizationUserId,
                            "coach",
                          )}
                        >
                          <button type="submit" className={rowButton}>
                            Antrenör Yap
                          </button>
                        </form>
                      )}
                      {!isSelf && (
                        <form
                          action={setStatusAction.bind(
                            null,
                            row.organizationUserId,
                            active ? "disabled" : "active",
                          )}
                        >
                          <button type="submit" className={rowButton}>
                            {active ? "Hesabı Kapat" : "Hesabı Aç"}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!active && <Pill tone="danger">Kapalı</Pill>}
                    <Pill tone={row.role === "admin" ? "yellow" : "neutral"}>
                      {ORG_ROLE_LABEL[row.role]}
                    </Pill>
                  </div>

                  <details className="w-full rounded-sm border border-brand-border bg-brand-surface-2 p-4">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-brand-yellow">
                      Hakediş —{" "}
                      <span className="normal-case text-brand-muted">
                        {describeCompensation(compensationByUser.get(row.userId))}
                      </span>
                    </summary>
                    <div className="mt-4">
                      <CompensationForm
                        defaults={{
                          coachUserId: row.userId,
                          coachName: row.displayName,
                          model:
                            compensationByUser.get(row.userId)?.model ?? "yok",
                          perSession: minorToInput(
                            compensationByUser.get(row.userId)?.perSessionMinor ??
                              null,
                          ),
                          revenueShare: String(
                            (compensationByUser.get(row.userId)
                              ?.revenueShareBps ?? 0) / 100 || "",
                          ),
                          monthlySalary: minorToInput(
                            compensationByUser.get(row.userId)
                              ?.monthlySalaryMinor ?? null,
                          ),
                          monthlyQuota: String(
                            compensationByUser.get(row.userId)
                              ?.monthlySessionQuota ?? "",
                          ),
                        }}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="Kadroya Ekle"
        description="Personel hesabı salonda yüz yüze kurulur; geçici şifreyi sen belirlersin. Sporcular ise davet bağlantısıyla kendi şifrelerini kurar."
      >
        <AddStaffForm />
      </PanelCard>
    </PanelPage>
  );
}
