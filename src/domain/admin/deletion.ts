/**
 * Silme kuralları — saf fonksiyonlar, veritabanı bilmez.
 *
 * Neden kural gerekiyor: veritabanında bir sporcu silinince tahsilatları da
 * zincirleme silinir (`Payment → Member ON DELETE CASCADE`), bir antrenör
 * silinince de hakediş ve ödemeleri (`CoachEarning`, `CoachPayout`). Yani
 * "sil" düğmesi sessizce salonun muhasebesini bozabilir. Bu yüzden parayla
 * ilişkili kaydı olan hesap SİLİNMEZ; onun yerine kapatılır/pasife alınır
 * (kayıtlar yerinde kalır). Test hesabı ve hiç işlem görmemiş kayıt sorunsuz silinir.
 *
 * Her kural, kullanıcıya olduğu gibi gösterilecek bir gerekçe döndürür; `null`
 * "silinebilir" demektir.
 */

export type MemberDeleteFacts = {
  /** Sporcuya bağlı tahsilat kaydı sayısı. */
  paymentCount: number;
};

export function memberDeleteBlock(facts: MemberDeleteFacts): string | null {
  if (facts.paymentCount > 0) {
    return `Bu sporcunun ${facts.paymentCount} tahsilat kaydı var; silinirse muhasebe kaydı da gider. Silmek yerine durumunu "Pasif" yap.`;
  }
  return null;
}

export type StaffDeleteFacts = {
  /** Silmeyi yapan kişi, silinecek kişinin kendisi mi. */
  isSelf: boolean;
  /** Silinecek kişi salonun tek aktif yöneticisi mi. */
  isLastActiveAdmin: boolean;
  /** Açtığı seanslardan en az bir sporcusu olanların sayısı (geçmiş dahil). */
  slotsWithBookings: number;
  /** Hakediş kaydı sayısı. */
  earningCount: number;
  /** Yapılmış ödeme (hakediş ödemesi) sayısı. */
  payoutCount: number;
};

export function staffDeleteBlock(facts: StaffDeleteFacts): string | null {
  if (facts.isSelf) {
    return "Kendi hesabını silemezsin.";
  }
  if (facts.isLastActiveAdmin) {
    return "Salonun tek aktif yöneticisi bu — önce başka bir yönetici ata.";
  }
  if (facts.earningCount > 0 || facts.payoutCount > 0) {
    return 'Bu antrenörün hakediş/ödeme kaydı var; silinirse muhasebe kaydı da gider. Silmek yerine hesabını "Kapat".';
  }
  if (facts.slotsWithBookings > 0) {
    return `Bu antrenörün sporcu kaydı olan ${facts.slotsWithBookings} seansı var; silinirse ders geçmişi sahipsiz kalır. Silmek yerine hesabını "Kapat".`;
  }
  return null;
}

/** Silme onayı için sporcuya gösterilen soru. */
export function memberDeleteConfirmText(fullName: string): string {
  return `${fullName} kalıcı olarak silinecek: hesabı, antrenman/check-in geçmişi, rezervasyonları ve tüm kayıtları gider. Bu geri alınamaz. Devam edilsin mi?`;
}

export function staffDeleteConfirmText(fullName: string): string {
  return `${fullName} kalıcı olarak silinecek: hesabı kapanır ve panele bir daha giremez. Bu geri alınamaz. Devam edilsin mi?`;
}
