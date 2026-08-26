import Link from "next/link";
import {
  activeChipClass,
  headerLinkClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/panel/form";

/**
 * Üye listesinin süzgeci. Bilinçli olarak **client component değil**:
 * düz bir `method="get"` formu ve bağlantılar, JavaScript kapalıyken de
 * çalışır ve durum URL'de durduğu için antrenör "kritik olanlar" görünümünü
 * kaydedip paylaşabilir.
 */

export type MemberListQuery = {
  q?: string;
  durum?: string;
  antrenor?: string;
  sirala?: string;
};

export const MEMBER_SORTS = ["risk", "ad", "yeni"] as const;
export type MemberSort = (typeof MEMBER_SORTS)[number];

export const MEMBER_SORT_LABEL: Record<MemberSort, string> = {
  risk: "Risk sırası",
  ad: "Ada göre",
  yeni: "Yeni kayıt",
};

export const MEMBER_STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  lead: "Aday",
  inactive: "Pasif",
  blocked: "Engelli",
};

/** Mevcut süzgeci koruyup tek anahtarı değiştiren bağlantı. */
export function memberListHref(query: MemberListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.durum) params.set("durum", query.durum);
  if (query.antrenor) params.set("antrenor", query.antrenor);
  if (query.sirala) params.set("sirala", query.sirala);
  const text = params.toString();
  return text ? `/personel/uyeler?${text}` : "/personel/uyeler";
}

export function MemberFilters({
  query,
  statuses,
  coaches,
  resultCount,
  totalCount,
}: {
  query: MemberListQuery;
  /** Listede fiilen bulunan durumlar — boş kategori gösterilmez. */
  statuses: { value: string; count: number }[];
  /** Yalnız yönetici görür; antrenör zaten kendi sporcularını görüyor. */
  coaches: { userId: string; displayName: string }[];
  resultCount: number;
  totalCount: number;
}) {
  const hasFilter = Boolean(
    query.q || query.durum || query.antrenor || query.sirala,
  );

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap gap-2">
        {/* Süzgeç değişince arama kutusu sıfırlanmasın diye gizli alanlar. */}
        {query.durum && <input type="hidden" name="durum" value={query.durum} />}
        {query.antrenor && (
          <input type="hidden" name="antrenor" value={query.antrenor} />
        )}
        {query.sirala && (
          <input type="hidden" name="sirala" value={query.sirala} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Ad, üye no ya da e-posta ara"
          aria-label="Sporcu ara"
          className="min-w-0 flex-1 rounded-sm border border-brand-border bg-brand-surface-2 px-3 py-2 text-base text-brand-white placeholder:text-brand-muted focus:border-brand-yellow focus:outline-none sm:text-sm"
        />
        <button
          type="submit"
          className={primaryButtonClass}
        >
          Ara
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href={memberListHref({ ...query, durum: undefined })}
          className={query.durum ? secondaryButtonClass : activeChipClass}
        >
          Tümü ({totalCount})
        </Link>
        {statuses.map((status) => (
          <Link
            key={status.value}
            href={memberListHref({
              ...query,
              durum: query.durum === status.value ? undefined : status.value,
            })}
            className={query.durum === status.value ? activeChipClass : secondaryButtonClass}
          >
            {MEMBER_STATUS_LABEL[status.value] ?? status.value} ({status.count})
          </Link>
        ))}
      </div>

      {coaches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs font-bold uppercase tracking-wide text-brand-muted">
            Antrenör
          </span>
          {coaches.map((coach) => (
            <Link
              key={coach.userId}
              href={memberListHref({
                ...query,
                antrenor:
                  query.antrenor === coach.userId ? undefined : coach.userId,
              })}
              className={
                query.antrenor === coach.userId ? activeChipClass : secondaryButtonClass
              }
            >
              {coach.displayName}
            </Link>
          ))}
          <Link
            href={memberListHref({ ...query, antrenor: "yok" })}
            className={query.antrenor === "yok" ? activeChipClass : secondaryButtonClass}
          >
            Atanmamış
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
          Sırala
        </span>
        {MEMBER_SORTS.map((sort) => (
          <Link
            key={sort}
            href={memberListHref({ ...query, sirala: sort })}
            className={
              (query.sirala ?? "risk") === sort ? activeChipClass : secondaryButtonClass
            }
          >
            {MEMBER_SORT_LABEL[sort]}
          </Link>
        ))}

        {hasFilter && (
          <>
            <span className="text-xs text-brand-muted">
              {resultCount}/{totalCount} sporcu
            </span>
            <Link
              href="/personel/uyeler"
              className={headerLinkClass}
            >
              Süzgeci temizle
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
