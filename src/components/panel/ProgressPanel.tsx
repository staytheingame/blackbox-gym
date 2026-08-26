import type { ProgressSummary } from "@/domain/performance/progress";
import { PanelCard, StatCard } from "@/components/panel/ui";

/**
 * Gelişim paneli — üye ve personel aynı bileşeni görür, aynı sayılar.
 *
 * Grafik yerine bilinçli olarak CSS sütunları: veri seyrek (haftada birkaç
 * kayıt), kütüphane getirmeye değmez ve sunucu bileşeni olarak kalır.
 */
function weekLabel(weekStart: string): string {
  const [, month, day] = weekStart.split("-");
  return `${day}.${month}`;
}

export function ProgressPanel({
  progress,
  title = "Gelişim",
  description = "Devamlılık, hacim ve skor — üçü ayrı okunur.",
}: {
  progress: ProgressSummary;
  title?: string;
  description?: string;
}) {
  const { attendance, volume, score } = progress;
  const peak = Math.max(...volume.map((week) => week.minutes), 1);
  const changeLabel =
    progress.volumeChangePercent === null
      ? "Kıyas için yeterli geçmiş yok"
      : `Önceki 4 haftaya göre ${progress.volumeChangePercent > 0 ? "+" : ""}${progress.volumeChangePercent}%`;

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Katılım Oranı"
          value={
            attendance.ratePercent === null ? "—" : `%${attendance.ratePercent}`
          }
          hint={`${attendance.attended} geldi · ${attendance.missed} gelmedi`}
          highlight={
            attendance.ratePercent !== null && attendance.ratePercent < 70
          }
        />
        <StatCard
          label="Haftalık Ortalama"
          value={progress.averageWeeklyMinutes}
          suffix="dk"
          hint="Son 4 hafta"
        />
        <StatCard
          label="Hacim Değişimi"
          value={
            progress.volumeChangePercent === null
              ? "—"
              : `${progress.volumeChangePercent > 0 ? "+" : ""}${progress.volumeChangePercent}%`
          }
          hint={changeLabel}
          highlight={
            progress.volumeChangePercent !== null &&
            progress.volumeChangePercent < -25
          }
        />
        <StatCard
          label="Skor"
          value={score ? score.last : "—"}
          suffix={score ? "/ 100" : undefined}
          hint={
            score
              ? `İlk ${score.first} → şimdi ${score.last} (en iyi ${score.best})`
              : "Henüz check-in yok"
          }
          highlight={score !== null && score.delta < 0}
        />
      </div>

      <PanelCard title={title} description={description}>
        <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
          Haftalık antrenman hacmi (son 8 hafta)
        </div>

        {/* Sütunun ayrıntısı `title` ile gelirdi — dokunmatikte `title`
            erişilemez, o yüzden aynı cümle `aria-label` olarak da duruyor ve
            seans sayısı sütunun altında görünür kalıyor. */}
        <ul className="mt-4 flex items-end gap-2">
          {volume.map((week) => {
            const detail = `${weekLabel(week.weekStart)} haftası · ${week.minutes} dk · ${week.sessions} seans`;
            return (
              <li
                key={week.weekStart}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-[10px] text-brand-muted">
                  {week.minutes > 0 ? week.minutes : ""}
                </span>
                <div
                  role="img"
                  aria-label={detail}
                  title={detail}
                  className="w-full rounded-sm bg-brand-yellow/80"
                  style={{
                    height: `${Math.max((week.minutes / peak) * 96, week.minutes > 0 ? 4 : 2)}px`,
                    opacity: week.minutes > 0 ? 1 : 0.25,
                  }}
                />
                <span aria-hidden className="text-[10px] text-brand-muted">
                  {weekLabel(week.weekStart)}
                </span>
                <span aria-hidden className="text-[10px] text-brand-muted/70">
                  {week.sessions > 0 ? `${week.sessions}×` : ""}
                </span>
              </li>
            );
          })}
        </ul>

        {score && score.points.length > 1 && (
          <div className="mt-6 border-t border-brand-border pt-4">
            <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
              Performans kartı geçmişi
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {score.points.map((point) => (
                <span
                  key={`${point.date}-${point.score}`}
                  className="rounded-sm border border-brand-border bg-brand-surface-2 px-2 py-1 text-xs text-brand-white"
                  title={point.date}
                >
                  {point.score}
                </span>
              ))}
            </div>
          </div>
        )}
      </PanelCard>
    </>
  );
}
