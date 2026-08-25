import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { isOrganizationWide, staffScopeFor } from "@/lib/auth/scope";
import { getMemberRadarBoard } from "@/lib/queries/radar";
import {
  RADAR_BANDS,
  RADAR_BAND_DESCRIPTION,
  RADAR_BAND_LABEL,
  RADAR_SIGNAL_KEYS,
  type RadarBand,
  type RadarSignalKey,
} from "@/domain/analysis/member-radar";
import { RadarList } from "@/components/panel/RadarList";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "Takip Radarı — BlackBox Panel" };

export const dynamic = "force-dynamic";

/** Sinyal anahtarının ekrandaki adı — dağılım kartında kullanılır. */
const SIGNAL_LABEL: Record<RadarSignalKey, string> = {
  "hic-baslamadi": "Hiç başlamadı",
  gelmiyor: "Gelmiyor",
  "gelmedi-cok": "Gelme oranı düşük",
  "kontrol-yok": "Kontrol göndermiyor",
  agri: "Ağrı bildirdi",
  "skor-dusuk": "Skor düşük",
  "uyelik-yok": "Üyeliksiz",
  "uyelik-bitiyor": "Üyeliği bitiyor",
  "hak-bitti": "Ders hakkı bitti/azaldı",
  "borc-gecikti": "Borcu gecikti",
  "onam-eksik": "Onamı eksik",
  "hesap-yok": "Hesabını kurmadı",
  antrenorsuz: "Antrenörü yok",
};

const chipClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";
const activeChipClass =
  "rounded-sm bg-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-black";

function isBand(value: string | undefined): value is RadarBand {
  return (RADAR_BANDS as readonly string[]).includes(value ?? "");
}

function isSignal(value: string | undefined): value is RadarSignalKey {
  return (RADAR_SIGNAL_KEYS as readonly string[]).includes(value ?? "");
}

/** Filtre bağlantısı — mevcut filtreleri koruyup tek anahtarı değiştirir. */
function filterHref(current: { bant?: string; sinyal?: string }): string {
  const params = new URLSearchParams();
  if (current.bant) params.set("bant", current.bant);
  if (current.sinyal) params.set("sinyal", current.sinyal);
  const query = params.toString();
  return query ? `/personel/icgoruler?${query}` : "/personel/icgoruler";
}

export default async function StaffRadarPage({
  searchParams,
}: {
  searchParams: Promise<{ bant?: string; sinyal?: string }>;
}) {
  const { bant, sinyal } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  // Antrenör YALNIZ kendi sporcularını görür; yönetici salonun tamamını.
  const scope = staffScopeFor(membership, user.id);
  const canSeeEveryone = isOrganizationWide(scope);

  const board = await getMemberRadarBoard(scope);

  const bandFilter = isBand(bant) ? bant : undefined;
  const signalFilter = isSignal(sinyal) ? sinyal : undefined;

  const visible = board.rows.filter((row) => {
    if (bandFilter && row.radar.band !== bandFilter) return false;
    if (
      signalFilter &&
      !row.radar.signals.some((signal) => signal.key === signalFilter)
    ) {
      return false;
    }
    return true;
  });

  const actionable = board.byBand.kritik + board.byBand.izle;

  return (
    <PanelPage
      title="Takip Radarı"
      description={
        canSeeEveryone
          ? "Salonun tüm aktif sporcuları, ilgilenme sırasına göre. Puan sporcunun notu değil — bugün kimden başlanacağını söyler."
          : "Sorumlusu olduğun sporcular, ilgilenme sırasına göre. Puan sporcunun notu değil — bugün kimden başlanacağını söyler."
      }
      action={
        <Link href="/personel/uyeler" className={chipClass}>
          Sporcu Listesi →
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {RADAR_BANDS.map((band) => (
          <StatCard
            key={band}
            label={RADAR_BAND_LABEL[band]}
            value={board.byBand[band]}
            highlight={band === "kritik" && board.byBand.kritik > 0}
            hint={RADAR_BAND_DESCRIPTION[band]}
          />
        ))}
      </div>

      <PanelCard
        title="Salonda En Sık Görülen Sinyaller"
        description="Aynı sinyal çok kişide çıkıyorsa sorun sporcuda değil, kuralda olabilir. Sayıya tıklayarak listeyi süz."
      >
        {board.bySignal.length === 0 ? (
          <EmptyState>
            Hiçbir sporcuda aksiyon gerektiren sinyal yok.
          </EmptyState>
        ) : (
          <div className="flex flex-wrap gap-2">
            {board.bySignal.map((row) => (
              <Link
                key={row.key}
                href={filterHref({
                  bant: bandFilter,
                  sinyal: signalFilter === row.key ? undefined : row.key,
                })}
                className={
                  signalFilter === row.key ? activeChipClass : chipClass
                }
              >
                {SIGNAL_LABEL[row.key]}: {row.count}
              </Link>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard
        title={`Sporcular (${visible.length}/${board.total})`}
        description="En acil üstte. Eşit puanda daha uzun süredir görünmeyen öne geçer."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={filterHref({ sinyal: signalFilter })}
              className={bandFilter ? chipClass : activeChipClass}
            >
              Hepsi
            </Link>
            {RADAR_BANDS.map((band) => (
              <Link
                key={band}
                href={filterHref({
                  bant: bandFilter === band ? undefined : band,
                  sinyal: signalFilter,
                })}
                className={bandFilter === band ? activeChipClass : chipClass}
              >
                {RADAR_BAND_LABEL[band]}
              </Link>
            ))}
          </div>
        }
      >
        {(bandFilter || signalFilter) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-brand-muted">
            <span>Süzülüyor:</span>
            {bandFilter && <Pill>{RADAR_BAND_LABEL[bandFilter]}</Pill>}
            {signalFilter && <Pill>{SIGNAL_LABEL[signalFilter]}</Pill>}
            <Link
              href="/personel/icgoruler"
              className="font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white"
            >
              Temizle
            </Link>
          </div>
        )}

        <RadarList
          rows={visible}
          showCoach={canSeeEveryone}
          empty={
            board.total === 0
              ? canSeeEveryone
                ? "Aktif sporcu yok."
                : "Sana atanmış aktif sporcu yok."
              : "Bu filtreye uyan sporcu yok."
          }
        />
      </PanelCard>

      <p className="text-xs leading-relaxed text-brand-muted">
        Radar yalnız sisteme girmiş kayıtları görür: salonda yapılıp yoklaması
        alınmamış ya da elle girilmemiş antrenman &quot;yok&quot; sayılır. Bu bir
        ölçüm değil, kayıt eksikliğidir —{" "}
        {actionable > 0
          ? `şu an ${actionable} sporcu aksiyon bekliyor.`
          : "şu an aksiyon bekleyen sporcu yok."}
      </p>
    </PanelPage>
  );
}
