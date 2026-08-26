/**
 * Form ve aksiyon sınıflarının TEK doğru kaynağı — üye, personel, yönetim.
 *
 * Bu dosyadan önce aynı sınıf dizesi 24 ayrı bileşende `const inputClass = …`
 * olarak kopyalanmıştı; mobil için tek bir düzeltme 24 dosyaya dokunmayı
 * gerektiriyordu. Yeni form yazarken buradan import et, yeniden yazma.
 *
 * Mobil kuralları (ölçüldü, tahmin değil):
 *
 *  - **16px yazı**: iOS Safari, yazı boyutu 16px'in altındaki bir alana
 *    odaklanınca sayfayı otomatik yakınlaştırır ve geri uzaklaştırmaz —
 *    kullanıcı yatay kaydırmaya mahkûm kalır. Alanlar mobilde `text-base`
 *    (16px), `sm:` üstünde eski görünüm olan `text-sm` (14px).
 *  - **44px dokunma hedefi**: parmakla güvenli en küçük hedef (Apple HIG 44pt,
 *    Material 48dp). Mobilde `min-h-11`, masaüstünde fare hassasiyeti yettiği
 *    için `sm:min-h-8` ile eski kompakt görünüme döner.
 *  - `min-h-*` yüksekliği yalnız kutuyu büyütür; yazının ortada kalması için
 *    butonlarda `inline-flex items-center justify-center` var.
 */

/**
 * Metin/sayı/tarih alanı ve `<select>`.
 *
 * `mt-1` dâhildir: her çağrı yerinde alan, etiketinin hemen altında duruyor.
 */
export const inputClass =
  "mt-1 min-h-11 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-base text-brand-white outline-none transition-colors focus:border-brand-yellow disabled:opacity-60 sm:min-h-8 sm:text-sm";

/** Çok satırlı alan — `min-h-11` yerine kendi satır sayısı yüksekliği verir. */
export const textareaClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-base text-brand-white outline-none transition-colors focus:border-brand-yellow disabled:opacity-60 sm:text-sm";

/** Alan etiketi. */
export const labelClass =
  "text-xs font-bold uppercase tracking-wide text-brand-muted";

/** Etiket altı açıklama — "kg cinsinden", "boş bırakılırsa …" gibi. */
export const hintClass = "mt-1 text-[0.7rem] text-brand-muted";

/** Formun ana eylemi: kaydet, gönder, ata. */
export const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60 sm:min-h-8";

/** İkincil eylem: iptal, geri, ayrıntı. */
export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-60 sm:min-h-8";

/**
 * Liste satırının içindeki dar eylem — "Geldi", "Düzenle", "Kaldır".
 *
 * Masaüstünde satırı şişirmemek için kompakt kalır; mobilde bunlar en sık
 * yanlış basılan hedefler olduğu için tam 44px'e çıkar.
 */
export const rowButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-60 sm:min-h-7 sm:text-[0.65rem]";

/** Satır içi eylemin vurgulu hâli — "Geldi" gibi beklenen cevap. */
export const rowPrimaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm bg-brand-yellow px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60 sm:min-h-7 sm:text-[0.65rem]";

/** Seçili filtre/dönem çipi — seçili olmayanı `secondaryButtonClass`. */
export const activeChipClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm bg-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-black sm:min-h-8";

/** Yıkıcı eylem: sil, iptal et, anonimleştir. */
export const dangerButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-sm border border-red-400/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300 transition-colors hover:border-red-400 hover:text-red-200 disabled:opacity-60 sm:min-h-8";

/**
 * Liste satırındaki sporcu adı bağlantısı.
 *
 * Satırın tamamı bağlantı olmadığında sporcuya gitmenin tek yolu ada dokunmak
 * — mobilde adın çevresinde 44px'lik bir şerit açılır. `inline-block` bilerek:
 * `inline-flex` olsaydı adın yanındaki üye numarası ayrı bir kutu olur ve dar
 * ekranda satır sonuna sarmazdı.
 */
export const rowNameLinkClass =
  "inline-block py-3 text-sm font-semibold text-brand-white transition-colors hover:text-brand-yellow sm:py-0";

/**
 * Kart/sayfa başlığındaki metin bağlantısı ("Tümü →", "Lig").
 *
 * Görsel olarak düz metin ama tıklanabilir: mobilde çevresine 44px'lik dokunma
 * alanı açılır, masaüstünde satır yüksekliğine geri döner ki başlık şişmesin.
 */
export const headerLinkClass =
  "inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:text-brand-white sm:min-h-0";
