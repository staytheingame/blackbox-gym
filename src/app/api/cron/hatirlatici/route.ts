import { NextResponse } from "next/server";
import { runReminderJob } from "@/lib/jobs/reminders";
import { closeExpiredSubscriptions } from "@/lib/queries/memberships";

/**
 * ZAMANLANMIŞ HATIRLATMA UCU — `vercel.json` içindeki cron bunu çağırır.
 *
 * Önerilen ritim (Europe/Istanbul):
 *   - 20:00 → ertesi günün derslerini hatırlatır, antrenöre gün özeti çıkarır
 *   - 09:00 → o günün derslerini hatırlatır
 * Vercel cron UTC çalışır; `vercel.json` içindeki saatler buna göre yazılmıştır.
 *
 * GÜVENLİK: `CRON_SECRET` tanımlıysa `Authorization: Bearer <secret>` başlığı
 * zorunludur. Vercel Cron bu başlığı kendiliğinden gönderir. Secret tanımlı
 * değilse uç açık kalır — üretimde MUTLAKA tanımlayın.
 *
 * İş idempotenttir; uç birden çok kez çağrılırsa aynı hatırlatma tekrar
 * gönderilmez (bkz. `Notification.dedupeKey`).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function run() {
  // Süresi dolmuş üyelikleri önce kapat: paket uyarıları güncel durumu
  // görsün, bitmiş üyelik için "bitiyor" uyarısı çıkmasın.
  const closed = await closeExpiredSubscriptions();
  const result = await runReminderJob();

  return {
    ok: true,
    ranAt: result.ranAt.toISOString(),
    kapatilanUyelik: closed,
    dersHatirlatma: result.dersHatirlatma,
    paketUyarisi: result.paketUyarisi,
    kocUyarisi: result.kocUyarisi,
    kocGunOzeti: result.kocGunOzeti,
    hesapsizUye: result.hesapsizUye,
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  try {
    return NextResponse.json(await run());
  } catch (error) {
    // Cron hatası sessizce kaybolmasın: Vercel log'unda görünsün ve
    // 500 dönsün ki başarısız çalışma raporlansın.
    console.error("[cron/hatirlatici] başarısız", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 },
    );
  }
}

/** Elle tetikleme (ör. yönetim panelindeki düğme yerine curl) için. */
export const POST = GET;
