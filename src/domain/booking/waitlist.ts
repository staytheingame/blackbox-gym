/**
 * Bekleme listesi — saf fonksiyonlar, veritabanı bilmez.
 *
 * Dolu bir saate katılmak isteyen sporcu `bekliyor` durumunda kuyruğa girer
 * (bkz. `credits.ts`). O kuyruk şimdiye kadar yalnız **antrenör onayı**
 * bekliyordu: onay kontenjanı bir kişilik büyütüp seansı grup dersine
 * çeviriyordu.
 *
 * Buraya ikinci bir yol eklendi: seansta yer **açılırsa** (biri iptal etti,
 * antrenör kontenjanı artırdı) kuyruğun başındaki sporcu antrenör onayı
 * beklemeden yerini alır. Sıra ilk gelen ilk alır — istek zamanına göre.
 *
 * Kural: promosyon yalnız *boş yer kadar* çalışır ve kontenjanı ASLA
 * büyütmez. Kontenjan büyütmek antrenörün kararıdır (grup dersi onayı).
 */

export type WaitlistEntry = {
  bookingId: string;
  memberId: string;
  requestedAt: Date;
};

/** Kuyruğu ilk gelen ilk alır sırasına dizer. */
export function orderWaitlist(entries: WaitlistEntry[]): WaitlistEntry[] {
  return [...entries].sort(
    (a, b) => a.requestedAt.getTime() - b.requestedAt.getTime(),
  );
}

/** Sporcunun kuyruktaki sırası (1 = ilk). Kuyrukta değilse `null`. */
export function waitlistPosition(
  entries: WaitlistEntry[],
  bookingId: string,
): number | null {
  const index = orderWaitlist(entries).findIndex(
    (entry) => entry.bookingId === bookingId,
  );
  return index === -1 ? null : index + 1;
}

/**
 * Yer açıldığında kuyruktan kimler yükselir? Boş yer sayısı kadar, sıraya
 * göre. Seans geçmişse ya da iptalse kimse yükselmez — geçmiş bir saate
 * kimseyi kaydetmek anlamsız.
 */
export function promotableFromWaitlist(input: {
  capacity: number;
  /** Yer tutan kayıt sayısı (onaylı + yoklaması alınmış). */
  takenSeats: number;
  waitlist: WaitlistEntry[];
  slotStartsAt: Date;
  slotStatus: string;
  now: Date;
}): WaitlistEntry[] {
  if (input.slotStatus !== "acik") return [];
  if (input.slotStartsAt.getTime() <= input.now.getTime()) return [];

  const freeSeats = input.capacity - input.takenSeats;
  if (freeSeats <= 0) return [];

  return orderWaitlist(input.waitlist).slice(0, freeSeats);
}
