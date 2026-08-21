/** Verilen tarihin (UTC) ait olduğu haftanın Pazartesi'sini, saat 00:00 UTC olarak döner. */
export function getWeekStart(date: Date): Date {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay(); // 0 = Pazar, 1 = Pazartesi ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  utcDate.setUTCDate(utcDate.getUTCDate() + diffToMonday);
  return utcDate;
}

export function formatDateTR(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
