import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { getMemberAnalysis } from "@/lib/queries/analysis";
import { TREND_LABEL } from "@/domain/analysis/member-analysis";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { rowButtonClass } from "@/components/panel/form";

export const metadata: Metadata = { title: "Sporcu Analizi — BlackBox Panel" };

export const dynamic = "force-dynamic";

const CONFIDENCE_TEXT: Record<string, string> = {
  yok: "Yorum yapacak veri yok",
  dusuk: "Veri az — sayılar yanıltıcı olabilir",
  yeterli: "Veri yeterli",
};

/** Sayının nereden geldiğini gösteren küçük satır — her metriğin altında. */
function Source({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[0.7rem] leading-relaxed text-brand-muted">
      {children}
    </p>
  );
}

export default async function MemberAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);

  const result = await getMemberAnalysis(id, membership.organizationId);
  if (!result) notFound();

  const { member, analysis } = result;
  const { attendance, volume, checkIn, weight, package: pkg } = analysis;

  return (
    <PanelPage
      title={`${member.fullName} — Analiz`}
      description="Gözlenen davranış, kaynağıyla birlikte. Burada teşhis yoktur: yalnız kayıtlardaki sayılar ve bunların ne anlama geldiği yazar."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/personel/uyeler/${member.id}`} className={rowButtonClass}>
            ← Sporcu Kartı
          </Link>
          <Link href="/personel/icgoruler" className={rowButtonClass}>
            Tüm İçgörüler
          </Link>
        </div>
      }
    >
      <div
        className={`rounded-sm border p-5 ${
          analysis.confidence === "yeterli"
            ? "border-brand-border bg-brand-surface"
            : "border-brand-yellow/40 bg-brand-yellow/10"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
            Özet
          </span>
          <Pill tone={analysis.confidence === "yeterli" ? "neutral" : "yellow"}>
            {CONFIDENCE_TEXT[analysis.confidence]}
          </Pill>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-brand-white">
          {analysis.summary}
        </p>
        <Source>
          Üyelik başlangıcı: {formatDateTR(member.createdAt)} · Kayıt no{" "}
          {member.memberNo}
        </Source>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Devamlılık"
          value={analysis.continuityScore}
          suffix="/100"
          highlight={analysis.continuityScore >= 70}
          hint="Ölçülebilen boyutların ortalaması"
        />
        <StatCard
          label="Gelme Oranı"
          value={attendance.scheduled === 0 ? "—" : `%${attendance.showRate}`}
          hint={`${attendance.attended} geldi · ${attendance.missed} gelmedi`}
        />
        <StatCard
          label="Haftalık Ders"
          value={attendance.weeklyAverage}
          hint={`Son 4 hafta ortalaması · ${TREND_LABEL[attendance.trend]}`}
        />
        <StatCard
          label="Son Geliş"
          value={
            attendance.daysSinceLastVisit === null
              ? "—"
              : `${attendance.daysSinceLastVisit} gün`
          }
          highlight={
            attendance.daysSinceLastVisit !== null &&
            attendance.daysSinceLastVisit >= 14
          }
          hint={
            attendance.lastAttendedAt
              ? formatDateTR(attendance.lastAttendedAt)
              : "Katıldığı seans kaydı yok"
          }
        />
      </div>

      <PanelCard
        title={`Dikkat Gerektirenler (${analysis.flags.length})`}
        description="Her satır bir gözlem ve önerilen bir adım. Sıralama önem sırasına göre."
      >
        {analysis.flags.length === 0 ? (
          <EmptyState>
            Aksiyon gerektiren bir durum görünmüyor. Devamlılık, paket ve plan
            uyumu eşiklerin içinde.
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {analysis.flags.map((flag) => (
              <li
                key={flag.key}
                className={`rounded-sm border p-4 ${
                  flag.severity === "yuksek"
                    ? "border-red-400/40 bg-red-400/5"
                    : "border-brand-border bg-brand-surface-2"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-brand-white">
                    {flag.label}
                  </span>
                  <Pill tone={flag.severity === "yuksek" ? "danger" : "neutral"}>
                    {flag.severity === "yuksek" ? "Öncelikli" : "İzle"}
                  </Pill>
                </div>
                <p className="mt-2 text-xs text-brand-muted">
                  Kaynak: {flag.evidence}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-brand-white">
                  {flag.action}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard title="Ders Devamlılığı">
          <dl className="space-y-2 text-sm">
            <Row label="Yoklaması alınmış seans" value={attendance.scheduled} />
            <Row label="Katıldı" value={attendance.attended} />
            <Row label="Gelmedi" value={attendance.missed} />
            <Row label="Son 4 hafta" value={attendance.recentCount} />
            <Row label="Önceki 4 hafta" value={attendance.previousCount} />
            <Row label="Eğilim" value={TREND_LABEL[attendance.trend]} />
          </dl>
          <Source>
            Kaynak: rezervasyon kayıtlarının yoklama sonucu. Rezerve edilip
            iptal edilen seanslar bu sayıya girmez — ders yapılmadı.
          </Source>
        </PanelCard>

        <PanelCard title="Antrenman Hacmi">
          <dl className="space-y-2 text-sm">
            <Row label="Son 4 hafta" value={`${volume.recentMinutes} dk`} />
            <Row label="Önceki 4 hafta" value={`${volume.previousMinutes} dk`} />
            <Row label="Eğilim" value={TREND_LABEL[volume.trend]} />
            <Row
              label="Ortalama şiddet (RPE)"
              value={volume.averageIntensity ?? "—"}
            />
            <Row label="Kayıtlı antrenman" value={volume.sessionsLogged} />
          </dl>
          <Source>
            Kaynak: antrenman kayıtları (yoklamada &quot;geldi&quot; işaretlenen
            seanslar ve elle girilen kayıtlar).
          </Source>
        </PanelCard>

        <PanelCard title="Haftalık Kontrol">
          <dl className="space-y-2 text-sm">
            <Row label="Beklenen hafta" value={checkIn.expectedWeeks} />
            <Row label="Gönderilen" value={checkIn.submittedWeeks} />
            <Row label="Oran" value={`%${checkIn.percent}`} />
            <Row label="Kesintisiz seri" value={`${checkIn.streak} hafta`} />
          </dl>
          <Source>
            Kaynak: haftalık kontrol formu. Beklenen hafta sayısı üyelik
            süresine göre, en fazla 8 hafta geriye bakılır.
          </Source>
        </PanelCard>

        <PanelCard title="Kilo">
          {weight.measurements === 0 ? (
            <EmptyState>Tartı kaydı yok.</EmptyState>
          ) : (
            <>
              <dl className="space-y-2 text-sm">
                <Row label="İlk ölçüm" value={`${weight.first} kg`} />
                <Row label="Son ölçüm" value={`${weight.last} kg`} />
                <Row
                  label="Toplam değişim"
                  value={`${weight.deltaKg! > 0 ? "+" : ""}${weight.deltaKg} kg`}
                />
                <Row
                  label="Haftalık hız"
                  value={
                    weight.weeklyDeltaKg === null
                      ? "hesaplanamıyor"
                      : `${weight.weeklyDeltaKg > 0 ? "+" : ""}${weight.weeklyDeltaKg} kg/hafta`
                  }
                />
                <Row label="Ölçüm sayısı" value={weight.measurements} />
              </dl>
              <Source>
                Kaynak: tartı kayıtları. Haftalık hız yalnız ilk ve son ölçüm
                arasında en az bir hafta varsa hesaplanır.
              </Source>
            </>
          )}
        </PanelCard>
      </div>

      <PanelCard title="Paket Kullanımı">
        {!pkg ? (
          <EmptyState>
            Yürürlükte üyelik yok — sporcu rezervasyon yapamaz.
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Kalan Süre"
                value={pkg.daysLeft}
                suffix="gün"
                highlight={pkg.daysLeft <= 14}
              />
              <StatCard
                label="Kalan Ders"
                value={pkg.unlimited ? "Sınırsız" : (pkg.sessionsRemaining ?? "—")}
                highlight={
                  !pkg.unlimited &&
                  pkg.sessionsRemaining !== null &&
                  pkg.sessionsRemaining <= 3
                }
              />
              <StatCard
                label="Yakma Hızı"
                value={pkg.burnPerWeek}
                suffix="ders/hafta"
                hint="Son 4 haftanın ortalaması"
              />
              <StatCard
                label="Önce Biten"
                value={
                  pkg.bottleneck === "hak"
                    ? "Ders hakkı"
                    : pkg.bottleneck === "sure"
                      ? "Süre"
                      : "—"
                }
                hint={
                  pkg.weeksUntilCreditsOut === null
                    ? "Hak hesabı yapılamıyor"
                    : `Hak ~${pkg.weeksUntilCreditsOut} hafta sonra biter`
                }
              />
            </div>
            <Source>
              Kaynak: yürürlükteki üyelik kaydı ve bu dönemin rezervasyonları.
              Yakma hızı sıfırsa (hiç ders yapılmadıysa) hakkın ne zaman
              biteceği hesaplanmaz.
            </Source>
          </>
        )}
      </PanelCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard title="Program Uyumu">
          {analysis.planPercent === null ? (
            <EmptyState>Atanmış antrenman planı yok.</EmptyState>
          ) : (
            <>
              <div className="font-display text-3xl text-brand-white">
                %{analysis.planPercent}
              </div>
              <Source>
                Kaynak: atanan plandaki tamamlanmış gün sayısı / planın
                başlangıcından bugüne düşen gün sayısı. Tüm şablon değil, geçen
                süre esas alınır.
              </Source>
            </>
          )}
        </PanelCard>

        <PanelCard title="Beslenme Uyumu">
          {analysis.nutritionPercent === null ? (
            <EmptyState>Aktif beslenme planı yok.</EmptyState>
          ) : (
            <>
              <div className="font-display text-3xl text-brand-white">
                %{analysis.nutritionPercent}
              </div>
              <Source>
                Kaynak: son 7 günde işaretlenen öğün sayısı / beklenen öğün
                sayısı.{" "}
                <Link
                  href="/personel/beslenme"
                  className="font-semibold text-brand-yellow hover:underline"
                >
                  Beslenme planları
                </Link>
              </Source>
            </>
          )}
        </PanelCard>
      </div>
    </PanelPage>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-brand-border pb-2 last:border-0 last:pb-0">
      <dt className="text-brand-muted">{label}</dt>
      <dd className="font-semibold text-brand-white">{value}</dd>
    </div>
  );
}
